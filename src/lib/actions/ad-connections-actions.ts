"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { encryptBindPassword, loadAdConnectionConfig } from "@/lib/ad/connection";
import { testAdConnection } from "@/lib/ad/client";
import { listOrganizationalUnits, type AdOrganizationalUnit } from "@/lib/ad/ou";
import { AdOperationError } from "@/lib/ad/types";
import type { AdConnectionConfig } from "@/lib/ad/types";

export type ActionState =
  | { error?: string; success?: string; test?: { success: boolean; latencyMs: number; error?: string } }
  | undefined;

export type OuListState = { error?: string; ous?: AdOrganizationalUnit[] } | undefined;

const encryptionEnum = z.enum(["NONE", "STARTTLS", "LDAPS"]);

const connectionSchema = z.object({
  name: z.string().min(2, "Informe um nome para a conexão."),
  host: z.string().min(1, "Informe o host."),
  port: z.coerce.number().int().min(1).max(65535),
  baseDN: z.string().min(3, "Informe a Base DN (ex: DC=empresa,DC=local)."),
  bindDN: z.string().min(3, "Informe a conta de serviço para bind."),
  bindPassword: z.string().optional(),
  encryption: encryptionEnum,
  rejectUnauthorized: z.coerce.boolean().default(true),
  usersOU: z.string().optional(),
  groupsOU: z.string().optional(),
  computersOU: z.string().optional(),
});

function draftConfigFromForm(data: z.infer<typeof connectionSchema>, fallbackPassword = ""): AdConnectionConfig {
  return {
    host: data.host,
    port: data.port,
    baseDN: data.baseDN,
    bindDN: data.bindDN,
    bindPassword: data.bindPassword || fallbackPassword,
    encryption: data.encryption,
    rejectUnauthorized: data.rejectUnauthorized,
    usersOU: data.usersOU || null,
    groupsOU: data.groupsOU || null,
    computersOU: data.computersOU || null,
  };
}

function parseForm(formData: FormData) {
  const obj = Object.fromEntries(formData);
  return connectionSchema.safeParse({
    ...obj,
    rejectUnauthorized: formData.get("rejectUnauthorized") === "on" || formData.get("rejectUnauthorized") === "true",
  });
}

/** Testa parâmetros de conexão direto do formulário, sem gravar nada no banco. */
export async function testAdConnectionDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.bindPassword) return { error: "Informe a senha da conta de serviço para testar." };

  const result = await testAdConnection(draftConfigFromForm(parsed.data));
  return { test: result };
}

/**
 * Descobre as OUs (unidades organizacionais) existentes abaixo da Base DN, usando os dados
 * atuais do formulário — usado para preencher os seletores de OU padrão de usuários/grupos.
 * Se a senha de bind estiver em branco e um `connectionId` for informado, reaproveita a senha
 * já salva daquela conexão (mesmo comportamento de "deixe em branco para manter" do formulário).
 */
export async function listAdConnectionOusDraftAction(
  _prev: OuListState,
  formData: FormData
): Promise<OuListState> {
  await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  let fallbackPassword = "";
  const connectionId = formData.get("id");
  if (!parsed.data.bindPassword && typeof connectionId === "string" && connectionId) {
    const existing = await db.adConnection.findUnique({ where: { id: connectionId } });
    if (existing) fallbackPassword = (await loadAdConnectionConfig(existing.id)).bindPassword;
  }
  if (!parsed.data.bindPassword && !fallbackPassword) {
    return { error: "Informe a senha da conta de serviço para buscar as OUs." };
  }

  try {
    const ous = await listOrganizationalUnits(draftConfigFromForm(parsed.data, fallbackPassword));
    return { ous };
  } catch (err) {
    return { error: err instanceof AdOperationError ? err.message : "Falha ao buscar OUs no AD." };
  }
}

export async function createAdConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.bindPassword) return { error: "Informe a senha da conta de serviço." };

  const exists = await db.adConnection.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: "Já existe uma conexão com esse nome." };

  const created = await db.adConnection.create({
    data: {
      name: parsed.data.name,
      host: parsed.data.host,
      port: parsed.data.port,
      baseDN: parsed.data.baseDN,
      bindDN: parsed.data.bindDN,
      bindPasswordEncrypted: encryptBindPassword(parsed.data.bindPassword),
      encryption: parsed.data.encryption,
      rejectUnauthorized: parsed.data.rejectUnauthorized,
      usersOU: parsed.data.usersOU || null,
      groupsOU: parsed.data.groupsOU || null,
      computersOU: parsed.data.computersOU || null,
      createdById: actor.id,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_connection.create",
    entityType: "AD_CONNECTION",
    entityId: created.id,
    entityLabel: created.name,
    description: `Conexão AD "${created.name}" (${created.host}:${created.port}) cadastrada`,
    metadata: { host: created.host, port: created.port, baseDN: created.baseDN, encryption: created.encryption },
    status: "SUCCESS",
  });

  revalidatePath("/ad/conexoes");
  return { success: "Conexão criada com sucesso." };
}

const updateSchema = connectionSchema.extend({ id: z.string().uuid() });

export async function updateAdConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const obj = Object.fromEntries(formData);
  const parsed = updateSchema.safeParse({
    ...obj,
    rejectUnauthorized: formData.get("rejectUnauthorized") === "on" || formData.get("rejectUnauthorized") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const before = await db.adConnection.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "Conexão não encontrada." };

  const updated = await db.adConnection.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      host: parsed.data.host,
      port: parsed.data.port,
      baseDN: parsed.data.baseDN,
      bindDN: parsed.data.bindDN,
      ...(parsed.data.bindPassword ? { bindPasswordEncrypted: encryptBindPassword(parsed.data.bindPassword) } : {}),
      encryption: parsed.data.encryption,
      rejectUnauthorized: parsed.data.rejectUnauthorized,
      usersOU: parsed.data.usersOU || null,
      groupsOU: parsed.data.groupsOU || null,
      computersOU: parsed.data.computersOU || null,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_connection.update",
    entityType: "AD_CONNECTION",
    entityId: updated.id,
    entityLabel: updated.name,
    description: `Conexão AD "${updated.name}" atualizada${parsed.data.bindPassword ? " (senha de bind alterada)" : ""}`,
    status: "SUCCESS",
  });

  revalidatePath("/ad/conexoes");
  revalidatePath(`/ad/conexoes/${updated.id}`);
  return { success: "Conexão atualizada com sucesso." };
}

export async function deleteAdConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.adConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  await db.adConnection.delete({ where: { id: connectionId } });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_connection.delete",
    entityType: "AD_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: `Conexão AD "${conn.name}" removida`,
    status: "SUCCESS",
  });

  revalidatePath("/ad/conexoes");
  return { success: "Conexão removida." };
}

/** Testa uma conexão já salva (usa a senha de bind gravada) e atualiza o status exibido na listagem. */
export async function testSavedAdConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.adConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  const config = await loadAdConnectionConfig(connectionId);
  const result = await testAdConnection(config);

  await db.adConnection.update({
    where: { id: connectionId },
    data: {
      lastTestAt: new Date(),
      lastTestStatus: result.success ? "SUCCESS" : "FAILURE",
      lastTestError: result.success ? null : result.error,
      lastTestLatencyMs: result.latencyMs,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_connection.test",
    entityType: "AD_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: result.success
      ? `Teste de conexão com "${conn.name}" bem-sucedido (${result.latencyMs}ms)`
      : `Teste de conexão com "${conn.name}" falhou: ${result.error}`,
    status: result.success ? "SUCCESS" : "FAILURE",
  });

  revalidatePath("/ad/conexoes");
  revalidatePath(`/ad/conexoes/${connectionId}`);
  return { test: result };
}
