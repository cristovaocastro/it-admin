"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { encryptAwsSecretKey, loadAwsConnectionConfig } from "@/lib/aws/connection";
import { testAwsConnection } from "@/lib/aws/client";
import type { AwsConnectionConfig } from "@/lib/aws/types";

export type ActionState =
  | { error?: string; success?: string; test?: { success: boolean; latencyMs: number; error?: string; accountId?: string } }
  | undefined;

const REGION_RE = /^[a-z]{2}(-gov)?-[a-z]+-\d$/;

const connectionSchema = z.object({
  name: z.string().min(2, "Informe um nome para a conexão."),
  accessKeyId: z.string().min(1, "Informe a Access Key ID."),
  secretAccessKey: z.string().optional(),
  defaultRegion: z.string().regex(REGION_RE, "Região padrão inválida (ex: us-east-1)."),
  regions: z
    .string()
    .min(1, "Informe ao menos uma região para monitorar.")
    .transform((v) =>
      v
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
    )
    .refine((list) => list.every((r) => REGION_RE.test(r)), "Regiões inválidas (ex: us-east-1, sa-east-1)."),
});

function draftConfigFromForm(
  data: z.infer<typeof connectionSchema>,
  fallbackSecret = ""
): AwsConnectionConfig {
  return {
    accessKeyId: data.accessKeyId,
    secretAccessKey: data.secretAccessKey || fallbackSecret,
    defaultRegion: data.defaultRegion,
    regions: data.regions,
  };
}

function parseForm(formData: FormData) {
  return connectionSchema.safeParse(Object.fromEntries(formData));
}

/** Testa parâmetros de conexão direto do formulário, sem gravar nada no banco. */
export async function testAwsConnectionDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.secretAccessKey) return { error: "Informe a Secret Access Key para testar." };

  const result = await testAwsConnection(draftConfigFromForm(parsed.data));
  return { test: result };
}

export async function createAwsConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.secretAccessKey) return { error: "Informe a Secret Access Key." };

  const exists = await db.awsConnection.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: "Já existe uma conexão com esse nome." };

  const created = await db.awsConnection.create({
    data: {
      name: parsed.data.name,
      accessKeyId: parsed.data.accessKeyId,
      secretAccessKeyEncrypted: encryptAwsSecretKey(parsed.data.secretAccessKey),
      defaultRegion: parsed.data.defaultRegion,
      regions: parsed.data.regions,
      createdById: actor.id,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "aws_connection.create",
    entityType: "AWS_CONNECTION",
    entityId: created.id,
    entityLabel: created.name,
    description: `Conexão AWS "${created.name}" cadastrada (regiões: ${created.regions.join(", ")})`,
    metadata: { regions: created.regions, defaultRegion: created.defaultRegion },
    status: "SUCCESS",
  });

  revalidatePath("/aws/conexoes");
  return { success: "Conexão criada com sucesso." };
}

const updateSchema = connectionSchema.extend({ id: z.string().uuid() });

export async function updateAwsConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const before = await db.awsConnection.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "Conexão não encontrada." };

  const updated = await db.awsConnection.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      accessKeyId: parsed.data.accessKeyId,
      ...(parsed.data.secretAccessKey ? { secretAccessKeyEncrypted: encryptAwsSecretKey(parsed.data.secretAccessKey) } : {}),
      defaultRegion: parsed.data.defaultRegion,
      regions: parsed.data.regions,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "aws_connection.update",
    entityType: "AWS_CONNECTION",
    entityId: updated.id,
    entityLabel: updated.name,
    description: `Conexão AWS "${updated.name}" atualizada${parsed.data.secretAccessKey ? " (secret key alterada)" : ""}`,
    status: "SUCCESS",
  });

  revalidatePath("/aws/conexoes");
  revalidatePath(`/aws/conexoes/${updated.id}`);
  return { success: "Conexão atualizada com sucesso." };
}

export async function deleteAwsConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.awsConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  await db.awsConnection.delete({ where: { id: connectionId } });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "aws_connection.delete",
    entityType: "AWS_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: `Conexão AWS "${conn.name}" removida`,
    status: "SUCCESS",
  });

  revalidatePath("/aws/conexoes");
  return { success: "Conexão removida." };
}

/** Testa uma conexão já salva (usa a secret key gravada) e atualiza o status exibido na listagem. */
export async function testSavedAwsConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.awsConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  const config = await loadAwsConnectionConfig(connectionId);
  const result = await testAwsConnection(config);

  await db.awsConnection.update({
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
    action: "aws_connection.test",
    entityType: "AWS_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: result.success
      ? `Teste de conexão com "${conn.name}" bem-sucedido (${result.latencyMs}ms, conta ${result.accountId})`
      : `Teste de conexão com "${conn.name}" falhou: ${result.error}`,
    status: result.success ? "SUCCESS" : "FAILURE",
  });

  revalidatePath("/aws/conexoes");
  revalidatePath(`/aws/conexoes/${connectionId}`);
  return { test: result };
}
