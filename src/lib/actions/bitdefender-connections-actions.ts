"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { encryptBitdefenderApiKey, loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { testBitdefenderConnection } from "@/lib/bitdefender/client";
import type { BitdefenderConnectionConfig } from "@/lib/bitdefender/types";

export type ActionState =
  | { error?: string; success?: string; test?: { success: boolean; latencyMs: number; error?: string } }
  | undefined;

const connectionSchema = z.object({
  name: z.string().min(2, "Informe um nome para a conexão."),
  apiUrl: z.string().url("Informe uma URL válida (ex: https://cloud.gravityzone.bitdefender.com)."),
  apiKey: z.string().optional(),
  companyId: z.string().optional(),
});

function draftConfigFromForm(
  data: z.infer<typeof connectionSchema>,
  fallbackApiKey = ""
): BitdefenderConnectionConfig {
  return {
    name: data.name,
    apiUrl: data.apiUrl,
    apiKey: data.apiKey || fallbackApiKey,
    companyId: data.companyId || null,
  };
}

function parseForm(formData: FormData) {
  return connectionSchema.safeParse(Object.fromEntries(formData));
}

/** Testa parâmetros de conexão direto do formulário, sem gravar nada no banco. */
export async function testBitdefenderConnectionDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.apiKey) return { error: "Informe a API Key para testar." };

  const result = await testBitdefenderConnection(draftConfigFromForm(parsed.data));
  return { test: result };
}

export async function createBitdefenderConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.apiKey) return { error: "Informe a API Key." };

  const exists = await db.bitdefenderConnection.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: "Já existe uma conexão com esse nome." };

  const created = await db.bitdefenderConnection.create({
    data: {
      name: parsed.data.name,
      apiUrl: parsed.data.apiUrl,
      apiKeyEncrypted: encryptBitdefenderApiKey(parsed.data.apiKey),
      companyId: parsed.data.companyId || null,
      createdById: actor.id,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "bitdefender_connection.create",
    entityType: "BITDEFENDER_CONNECTION",
    entityId: created.id,
    entityLabel: created.name,
    description: `Conexão Bitdefender GravityZone "${created.name}" cadastrada (${created.apiUrl})`,
    metadata: { apiUrl: created.apiUrl },
    status: "SUCCESS",
  });

  revalidatePath("/bitdefender/conexoes");
  return { success: "Conexão criada com sucesso." };
}

const updateSchema = connectionSchema.extend({ id: z.string().uuid() });

export async function updateBitdefenderConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const before = await db.bitdefenderConnection.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "Conexão não encontrada." };

  const updated = await db.bitdefenderConnection.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      apiUrl: parsed.data.apiUrl,
      ...(parsed.data.apiKey ? { apiKeyEncrypted: encryptBitdefenderApiKey(parsed.data.apiKey) } : {}),
      companyId: parsed.data.companyId || null,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "bitdefender_connection.update",
    entityType: "BITDEFENDER_CONNECTION",
    entityId: updated.id,
    entityLabel: updated.name,
    description: `Conexão Bitdefender GravityZone "${updated.name}" atualizada${parsed.data.apiKey ? " (API Key alterada)" : ""}`,
    status: "SUCCESS",
  });

  revalidatePath("/bitdefender/conexoes");
  revalidatePath(`/bitdefender/conexoes/${updated.id}`);
  return { success: "Conexão atualizada com sucesso." };
}

export async function deleteBitdefenderConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.bitdefenderConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  await db.bitdefenderConnection.delete({ where: { id: connectionId } });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "bitdefender_connection.delete",
    entityType: "BITDEFENDER_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: `Conexão Bitdefender GravityZone "${conn.name}" removida`,
    status: "SUCCESS",
  });

  revalidatePath("/bitdefender/conexoes");
  return { success: "Conexão removida." };
}

/** Testa uma conexão já salva (usa a API Key gravada) e atualiza o status exibido na listagem. */
export async function testSavedBitdefenderConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.bitdefenderConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  const config = await loadBitdefenderConnectionConfig(connectionId);
  const result = await testBitdefenderConnection(config);

  await db.bitdefenderConnection.update({
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
    action: "bitdefender_connection.test",
    entityType: "BITDEFENDER_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: result.success
      ? `Teste de conexão com "${conn.name}" bem-sucedido (${result.latencyMs}ms)`
      : `Teste de conexão com "${conn.name}" falhou: ${result.error}`,
    status: result.success ? "SUCCESS" : "FAILURE",
  });

  revalidatePath("/bitdefender/conexoes");
  revalidatePath(`/bitdefender/conexoes/${connectionId}`);
  return { test: result };
}
