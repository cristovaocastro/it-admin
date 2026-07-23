"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import {
  createAdUser,
  setAdUserPassword,
  setAdUserEnabled,
  unlockAdUser,
  updateAdUser,
  deleteAdUser,
  moveAdUser,
} from "@/lib/ad/users";
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

const resetPasswordSchema = z.object({
  connectionId: z.string().uuid(),
  dn: z.string().min(1),
  label: z.string().min(1),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  forceChangeAtNextLogon: z.coerce.boolean().default(true),
});

export async function resetAdUserPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = resetPasswordSchema.safeParse({
    ...Object.fromEntries(formData),
    forceChangeAtNextLogon: formData.get("forceChangeAtNextLogon") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() =>
    setAdUserPassword(config, parsed.data.dn, parsed.data.password, parsed.data.forceChangeAtNextLogon)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.password_reset",
    entityType: "AD_USER",
    entityId: parsed.data.dn,
    entityLabel: parsed.data.label,
    description:
      "error" in result
        ? `Falha ao redefinir senha do usuário AD "${parsed.data.label}": ${result.error}`
        : `Senha do usuário AD "${parsed.data.label}" redefinida`,
    metadata: { connectionId: parsed.data.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: "Senha redefinida com sucesso." };
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
});

export async function updateAdUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const { connectionId, dn, ...fields } = parsed.data;
  const result = await withAdErrorHandling(() => updateAdUser(config, dn, fields));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_user.update",
    entityType: "AD_USER",
    entityId: dn,
    entityLabel: fields.displayName || dn,
    description:
      "error" in result
        ? `Falha ao atualizar atributos do usuário AD: ${result.error}`
        : `Atributos do usuário AD atualizados`,
    metadata: { connectionId, fields },
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
