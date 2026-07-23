"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { encryptAdminPassword, loadFirewallConnectionConfig } from "@/lib/firewall/connection";
import { testFirewallConnection } from "@/lib/firewall/client";
import type { FirewallConnectionConfig } from "@/lib/firewall/types";

export type ActionState =
  | { error?: string; success?: string; test?: { success: boolean; latencyMs: number; error?: string } }
  | undefined;

const connectionSchema = z.object({
  name: z.string().min(2, "Informe um nome para a conexão."),
  host: z.string().min(1, "Informe o host."),
  port: z.coerce.number().int().min(1).max(65535),
  adminUsername: z.string().min(1, "Informe o usuário admin."),
  adminPassword: z.string().optional(),
  rejectUnauthorized: z.coerce.boolean().default(true),
});

function draftConfigFromForm(
  data: z.infer<typeof connectionSchema>,
  fallbackPassword = ""
): FirewallConnectionConfig {
  return {
    host: data.host,
    port: data.port,
    adminUsername: data.adminUsername,
    adminPassword: data.adminPassword || fallbackPassword,
    rejectUnauthorized: data.rejectUnauthorized,
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
export async function testFirewallConnectionDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.adminPassword) return { error: "Informe a senha do admin para testar." };

  const result = await testFirewallConnection(draftConfigFromForm(parsed.data));
  return { test: result };
}

export async function createFirewallConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.adminPassword) return { error: "Informe a senha do admin." };

  const exists = await db.firewallConnection.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: "Já existe uma conexão com esse nome." };

  const created = await db.firewallConnection.create({
    data: {
      name: parsed.data.name,
      host: parsed.data.host,
      port: parsed.data.port,
      adminUsername: parsed.data.adminUsername,
      adminPasswordEncrypted: encryptAdminPassword(parsed.data.adminPassword),
      rejectUnauthorized: parsed.data.rejectUnauthorized,
      createdById: actor.id,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "firewall_connection.create",
    entityType: "FIREWALL_CONNECTION",
    entityId: created.id,
    entityLabel: created.name,
    description: `Conexão de firewall "${created.name}" (${created.host}:${created.port}) cadastrada`,
    metadata: { host: created.host, port: created.port },
    status: "SUCCESS",
  });

  revalidatePath("/firewall/conexoes");
  return { success: "Conexão criada com sucesso." };
}

const updateSchema = connectionSchema.extend({ id: z.string().uuid() });

export async function updateFirewallConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const obj = Object.fromEntries(formData);
  const parsed = updateSchema.safeParse({
    ...obj,
    rejectUnauthorized: formData.get("rejectUnauthorized") === "on" || formData.get("rejectUnauthorized") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const before = await db.firewallConnection.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "Conexão não encontrada." };

  const updated = await db.firewallConnection.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      host: parsed.data.host,
      port: parsed.data.port,
      adminUsername: parsed.data.adminUsername,
      ...(parsed.data.adminPassword ? { adminPasswordEncrypted: encryptAdminPassword(parsed.data.adminPassword) } : {}),
      rejectUnauthorized: parsed.data.rejectUnauthorized,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "firewall_connection.update",
    entityType: "FIREWALL_CONNECTION",
    entityId: updated.id,
    entityLabel: updated.name,
    description: `Conexão de firewall "${updated.name}" atualizada${parsed.data.adminPassword ? " (senha alterada)" : ""}`,
    status: "SUCCESS",
  });

  revalidatePath("/firewall/conexoes");
  revalidatePath(`/firewall/conexoes/${updated.id}`);
  return { success: "Conexão atualizada com sucesso." };
}

export async function deleteFirewallConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.firewallConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  await db.firewallConnection.delete({ where: { id: connectionId } });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "firewall_connection.delete",
    entityType: "FIREWALL_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: `Conexão de firewall "${conn.name}" removida`,
    status: "SUCCESS",
  });

  revalidatePath("/firewall/conexoes");
  return { success: "Conexão removida." };
}

/** Testa uma conexão já salva (usa a senha gravada) e atualiza o status exibido na listagem. */
export async function testSavedFirewallConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.firewallConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  const config = await loadFirewallConnectionConfig(connectionId);
  const result = await testFirewallConnection(config);

  await db.firewallConnection.update({
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
    action: "firewall_connection.test",
    entityType: "FIREWALL_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: result.success
      ? `Teste de conexão com "${conn.name}" bem-sucedido (${result.latencyMs}ms)`
      : `Teste de conexão com "${conn.name}" falhou: ${result.error}`,
    status: result.success ? "SUCCESS" : "FAILURE",
  });

  revalidatePath("/firewall/conexoes");
  revalidatePath(`/firewall/conexoes/${connectionId}`);
  return { test: result };
}
