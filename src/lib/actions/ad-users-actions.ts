"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import {
  createAdUser,
  getAdUser,
  setAdUserPassword,
  setAdUserEnabled,
  setAdUserPasswordNeverExpires,
  setAdUserAccountExpires,
  unlockAdUser,
  updateAdUser,
  deleteAdUser,
  moveAdUser,
} from "@/lib/ad/users";
import { addAdGroupMember } from "@/lib/ad/groups";
import { parentOf, rdnOf, generateRandomPassword } from "@/lib/ad/util";
import { AdOperationError } from "@/lib/ad/types";
import { withAdErrorHandling } from "@/lib/ad/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

function pathFor(connectionId: string) {
  return `/ad/usuarios?conexao=${connectionId}`;
}

const createSchema = z.object({
  connectionId: z.string().uuid(),
  sAMAccountName: z.string().min(1, "Informe o login (sAMAccountName)."),
  userPrincipalName: z.string().email("UPN precisa ter o formato de e-mail (usuario@dominio)."),
  givenName: z.string().min(1, "Informe o primeiro nome."),
  sn: z.string().min(1, "Informe o sobrenome."),
  mail: z.string().email().optional().or(z.literal("")),
  ou: z.string().optional(),
  password: z.string().min(8, "A senha inicial precisa ter ao menos 8 caracteres."),
  mustChangePasswordAtLogon: z.coerce.boolean().default(true),
  enabled: z.coerce.boolean().default(true),
});

export async function createAdUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const obj = Object.fromEntries(formData);
  const parsed = createSchema.safeParse({
    ...obj,
    mustChangePasswordAtLogon: formData.get("mustChangePasswordAtLogon") === "on",
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() =>
    createAdUser(config, {
      sAMAccountName: parsed.data.sAMAccountName,
      userPrincipalName: parsed.data.userPrincipalName,
      givenName: parsed.data.givenName,
      sn: parsed.data.sn,
      mail: parsed.data.mail || undefined,
      ou: parsed.data.ou || undefined,
      password: parsed.data.password,
      mustChangePasswordAtLogon: parsed.data.mustChangePasswordAtLogon,
      enabled: parsed.data.enabled,
    })
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.create",
    entityType: "AD_USER",
    entityId: "error" in result ? null : result.ok,
    entityLabel: parsed.data.sAMAccountName,
    description:
      "error" in result
        ? `Falha ao criar usuário AD "${parsed.data.sAMAccountName}": ${result.error}`
        : `Usuário AD "${parsed.data.sAMAccountName}" criado`,
    metadata: { connectionId: parsed.data.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: "Usuário AD criado com sucesso." };
}

const cloneSchema = z.object({
  connectionId: z.string().uuid(),
  sourceDn: z.string().min(1, "Selecione o usuário de origem."),
  sourceLabel: z.string().min(1),
  sAMAccountName: z.string().min(1, "Informe o login (sAMAccountName)."),
  userPrincipalName: z.string().email("UPN precisa ter o formato de e-mail (usuario@dominio)."),
  givenName: z.string().min(1, "Informe o primeiro nome."),
  sn: z.string().min(1, "Informe o sobrenome."),
  mail: z.string().email().optional().or(z.literal("")),
  ou: z.string().optional(),
  password: z.string().min(8, "A senha inicial precisa ter ao menos 8 caracteres."),
  mustChangePasswordAtLogon: z.coerce.boolean().default(true),
  enabled: z.coerce.boolean().default(true),
  copyGroups: z.coerce.boolean().default(true),
});

/** Clona um usuário AD existente: cria uma conta nova (login/senha próprios) copiando
 * departamento, cargo, descrição, telefone e os grupos do usuário de origem. */
export async function cloneAdUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = cloneSchema.safeParse({
    ...Object.fromEntries(formData),
    mustChangePasswordAtLogon: formData.get("mustChangePasswordAtLogon") === "on",
    enabled: formData.get("enabled") === "on",
    copyGroups: formData.get("copyGroups") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);

  const result = await withAdErrorHandling(async () => {
    const source = await getAdUser(config, parsed.data.sourceDn);
    const ou = parsed.data.ou || parentOf(source.dn);

    const newDn = await createAdUser(config, {
      sAMAccountName: parsed.data.sAMAccountName,
      userPrincipalName: parsed.data.userPrincipalName,
      givenName: parsed.data.givenName,
      sn: parsed.data.sn,
      mail: parsed.data.mail || undefined,
      ou,
      password: parsed.data.password,
      mustChangePasswordAtLogon: parsed.data.mustChangePasswordAtLogon,
      enabled: parsed.data.enabled,
    });

    await updateAdUser(config, newDn, {
      department: source.department,
      title: source.title,
      description: source.description,
      telephoneNumber: source.telephoneNumber,
    });

    const groupsCopied: string[] = [];
    const groupsFailed: { groupDn: string; error: string }[] = [];
    if (parsed.data.copyGroups) {
      for (const groupDn of source.memberOf) {
        try {
          await addAdGroupMember(config, groupDn, newDn);
          groupsCopied.push(groupDn);
        } catch (err) {
          groupsFailed.push({
            groupDn,
            error: err instanceof AdOperationError ? err.message : "Falha desconhecida.",
          });
        }
      }
    }

    return { newDn, ou, groupsCopied, groupsFailed };
  });

  const groupNames = (dns: string[]) => dns.map((dn) => rdnOf(dn).replace(/^CN=/, "")).join(", ");
  const cloneDetails =
    "ok" in result
      ? [
          result.ok.groupsCopied.length ? `grupos copiados: ${groupNames(result.ok.groupsCopied)}` : null,
          result.ok.groupsFailed.length
            ? `falha ao copiar ${result.ok.groupsFailed.length} grupo(s): ${groupNames(result.ok.groupsFailed.map((g) => g.groupDn))}`
            : null,
        ]
          .filter(Boolean)
          .join("; ")
      : "";

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.clone",
    entityType: "AD_USER",
    entityId: "error" in result ? null : result.ok.newDn,
    entityLabel: parsed.data.sAMAccountName,
    description:
      "error" in result
        ? `Falha ao clonar usuário AD "${parsed.data.sourceLabel}" para "${parsed.data.sAMAccountName}": ${result.error}`
        : `Usuário AD "${parsed.data.sAMAccountName}" criado como cópia de "${parsed.data.sourceLabel}"${cloneDetails ? ` — ${cloneDetails}` : ""}`,
    metadata: {
      connectionId: parsed.data.connectionId,
      sourceDn: parsed.data.sourceDn,
      sourceLabel: parsed.data.sourceLabel,
      copyGroups: parsed.data.copyGroups,
      groupsCopied: "ok" in result ? result.ok.groupsCopied : [],
      groupsFailed: "ok" in result ? result.ok.groupsFailed : [],
    },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  const failureNote = result.ok.groupsFailed.length
    ? ` (${result.ok.groupsFailed.length} grupo(s) não puderam ser copiados — veja a auditoria)`
    : "";
  return { success: `Usuário clonado com sucesso.${failureNote}` };
}

const resetPasswordSchema = z.object({
  connectionId: z.string().uuid(),
  dn: z.string().min(1),
  label: z.string().min(1),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  forceChangeAtNextLogon: z.coerce.boolean().default(true),
  unlockAccount: z.coerce.boolean().default(false),
});

export async function resetAdUserPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = resetPasswordSchema.safeParse({
    ...Object.fromEntries(formData),
    forceChangeAtNextLogon: formData.get("forceChangeAtNextLogon") === "on",
    unlockAccount: formData.get("unlockAccount") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(async () => {
    await setAdUserPassword(config, parsed.data.dn, parsed.data.password, parsed.data.forceChangeAtNextLogon);
    if (parsed.data.unlockAccount) {
      await unlockAdUser(config, parsed.data.dn);
    }
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.password_reset",
    entityType: "AD_USER",
    entityId: parsed.data.dn,
    entityLabel: parsed.data.label,
    description:
      "error" in result
        ? `Falha ao redefinir senha do usuário AD "${parsed.data.label}": ${result.error}`
        : `Senha do usuário AD "${parsed.data.label}" redefinida${parsed.data.unlockAccount ? " e conta desbloqueada" : ""}`,
    metadata: { connectionId: parsed.data.connectionId, unlockAccount: parsed.data.unlockAccount },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: "Senha redefinida com sucesso." };
}

/** Redefine a senha de um usuário como parte de uma ação em lote. Se `password` não for informado,
 * gera uma senha aleatória por usuário e a retorna (não persistida em nenhum lugar além da resposta). */
export async function resetAdUserPasswordBulkAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  password?: string;
  forceChangeAtNextLogon: boolean;
  unlockAccount: boolean;
}): Promise<ActionState & { password?: string }> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const password = params.password || generateRandomPassword();

  const result = await withAdErrorHandling(async () => {
    await setAdUserPassword(config, params.dn, password, params.forceChangeAtNextLogon);
    if (params.unlockAccount) await unlockAdUser(config, params.dn);
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.password_reset",
    entityType: "AD_USER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao redefinir senha do usuário AD "${params.label}" (ação em lote): ${result.error}`
        : `Senha do usuário AD "${params.label}" redefinida em lote${params.unlockAccount ? " e conta desbloqueada" : ""}`,
    metadata: {
      connectionId: params.connectionId,
      bulk: true,
      generated: !params.password,
      forceChangeAtNextLogon: params.forceChangeAtNextLogon,
      unlockAccount: params.unlockAccount,
    },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Senha redefinida.", password };
}

export async function setAdUserEnabledAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  enabled: boolean;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => setAdUserEnabled(config, params.dn, params.enabled));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: params.enabled ? "ad_user.enable" : "ad_user.disable",
    entityType: "AD_USER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao ${params.enabled ? "habilitar" : "desabilitar"} usuário AD "${params.label}": ${result.error}`
        : `Usuário AD "${params.label}" ${params.enabled ? "habilitado" : "desabilitado"}`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: `Usuário ${params.enabled ? "habilitado" : "desabilitado"}.` };
}

export async function unlockAdUserAction(params: {
  connectionId: string;
  dn: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => unlockAdUser(config, params.dn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.unlock",
    entityType: "AD_USER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao desbloquear usuário AD "${params.label}": ${result.error}`
        : `Usuário AD "${params.label}" desbloqueado`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Usuário desbloqueado." };
}

const updateSchema = z.object({
  connectionId: z.string().uuid(),
  dn: z.string().min(1),
  displayName: z.string().optional(),
  givenName: z.string().optional(),
  sn: z.string().optional(),
  mail: z.string().email().optional().or(z.literal("")),
  telephoneNumber: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  passwordNeverExpires: z.coerce.boolean().default(false),
  accountExpires: z.string().optional(), // "" ou ausente = nunca expira; senão data YYYY-MM-DD
});

export async function updateAdUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = updateSchema.safeParse({
    ...Object.fromEntries(formData),
    passwordNeverExpires: formData.get("passwordNeverExpires") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const { connectionId, dn, passwordNeverExpires, accountExpires, ...fields } = parsed.data;
  const expiresAt = accountExpires ? new Date(`${accountExpires}T23:59:59`) : null;

  const result = await withAdErrorHandling(async () => {
    await updateAdUser(config, dn, fields);
    await setAdUserPasswordNeverExpires(config, dn, passwordNeverExpires);
    await setAdUserAccountExpires(config, dn, expiresAt);
  });

  const fieldSummary = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const extraSummary = [
    passwordNeverExpires ? "senha nunca expira" : null,
    accountExpires ? `conta expira em ${accountExpires}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const changeSummary = [fieldSummary, extraSummary].filter(Boolean).join("; ");

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.update",
    entityType: "AD_USER",
    entityId: dn,
    entityLabel: fields.displayName || dn,
    description:
      "error" in result
        ? `Falha ao atualizar atributos do usuário AD "${fields.displayName || dn}": ${result.error}`
        : `Atributos do usuário AD "${fields.displayName || dn}" atualizados${changeSummary ? ` — ${changeSummary}` : ""}`,
    metadata: { connectionId, fields, passwordNeverExpires, accountExpires: accountExpires || null },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(connectionId));
  return { success: "Usuário atualizado." };
}

export async function moveAdUserAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  newOuDn: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => moveAdUser(config, params.dn, params.newOuDn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.move",
    entityType: "AD_USER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao mover usuário AD "${params.label}": ${result.error}`
        : `Usuário AD "${params.label}" movido para ${params.newOuDn}`,
    metadata: { connectionId: params.connectionId, newOuDn: params.newOuDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Usuário movido." };
}

export async function deleteAdUserAction(params: {
  connectionId: string;
  dn: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => deleteAdUser(config, params.dn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.delete",
    entityType: "AD_USER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao excluir usuário AD "${params.label}": ${result.error}`
        : `Usuário AD "${params.label}" excluído`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Usuário excluído." };
}
