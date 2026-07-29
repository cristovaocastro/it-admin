"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { encryptOciPrivateKey, encryptOciPassphrase, loadOciConnectionConfig } from "@/lib/oci/connection";
import { testOciConnection } from "@/lib/oci/client";
import type { OciConnectionConfig } from "@/lib/oci/types";

export type ActionState =
  | { error?: string; success?: string; test?: { success: boolean; latencyMs: number; error?: string } }
  | undefined;

const REGION_RE = /^[a-z]{2}-[a-z]+-\d$/;
const OCID_RE = /^ocid1\.[a-z0-9_-]+\.[a-z0-9-]*\.[a-z0-9-]*\.[a-z0-9-]+$/i;
const FINGERPRINT_RE = /^([0-9a-f]{2}:){15}[0-9a-f]{2}$/i;

function commaList(message: string) {
  return z
    .string()
    .min(1, message)
    .transform((v) =>
      v
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
    );
}

const connectionSchema = z.object({
  name: z.string().min(2, "Informe um nome para a conexão."),
  tenancyId: z.string().regex(OCID_RE, "OCID de tenancy inválido (ex: ocid1.tenancy.oc1..aaaa...)."),
  userId: z.string().regex(OCID_RE, "OCID de usuário inválido (ex: ocid1.user.oc1..aaaa...)."),
  fingerprint: z.string().regex(FINGERPRINT_RE, "Fingerprint inválido (ex: aa:bb:cc:...:zz, 16 pares hexadecimais)."),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  defaultRegion: z.string().regex(REGION_RE, "Região padrão inválida (ex: sa-saopaulo-1)."),
  regions: commaList("Informe ao menos uma região para monitorar.").refine(
    (list) => list.every((r) => REGION_RE.test(r)),
    "Regiões inválidas (ex: sa-saopaulo-1, us-ashburn-1)."
  ),
  compartments: commaList("Informe ao menos um compartment (OCID) para monitorar.").refine(
    (list) => list.every((c) => OCID_RE.test(c)),
    "Compartments inválidos — use OCIDs completos (ex: ocid1.compartment.oc1..aaaa...)."
  ),
});

function draftConfigFromForm(
  data: z.infer<typeof connectionSchema>,
  fallbackPrivateKey = "",
  fallbackPassphrase: string | null = null
): OciConnectionConfig {
  return {
    tenancyId: data.tenancyId,
    userId: data.userId,
    fingerprint: data.fingerprint,
    privateKey: data.privateKey || fallbackPrivateKey,
    passphrase: data.passphrase || fallbackPassphrase,
    defaultRegion: data.defaultRegion,
    regions: data.regions,
    compartments: data.compartments,
  };
}

function parseForm(formData: FormData) {
  return connectionSchema.safeParse(Object.fromEntries(formData));
}

/** Testa parâmetros de conexão direto do formulário, sem gravar nada no banco. */
export async function testOciConnectionDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.privateKey) return { error: "Informe a chave privada para testar." };

  const result = await testOciConnection(draftConfigFromForm(parsed.data));
  return { test: result };
}

export async function createOciConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (!parsed.data.privateKey) return { error: "Informe a chave privada." };

  const exists = await db.ociConnection.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { error: "Já existe uma conexão com esse nome." };

  const created = await db.ociConnection.create({
    data: {
      name: parsed.data.name,
      tenancyId: parsed.data.tenancyId,
      userId: parsed.data.userId,
      fingerprint: parsed.data.fingerprint,
      privateKeyEncrypted: encryptOciPrivateKey(parsed.data.privateKey),
      passphraseEncrypted: parsed.data.passphrase ? encryptOciPassphrase(parsed.data.passphrase) : null,
      defaultRegion: parsed.data.defaultRegion,
      regions: parsed.data.regions,
      compartments: parsed.data.compartments,
      createdById: actor.id,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "oci_connection.create",
    entityType: "OCI_CONNECTION",
    entityId: created.id,
    entityLabel: created.name,
    description: `Conexão OCI "${created.name}" cadastrada (regiões: ${created.regions.join(", ")}; compartments: ${created.compartments.length})`,
    metadata: { regions: created.regions, compartments: created.compartments, defaultRegion: created.defaultRegion },
    status: "SUCCESS",
  });

  revalidatePath("/oci/conexoes");
  return { success: "Conexão criada com sucesso." };
}

const updateSchema = connectionSchema.extend({ id: z.string().uuid() });

export async function updateOciConnectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const before = await db.ociConnection.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "Conexão não encontrada." };

  const updated = await db.ociConnection.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      tenancyId: parsed.data.tenancyId,
      userId: parsed.data.userId,
      fingerprint: parsed.data.fingerprint,
      ...(parsed.data.privateKey ? { privateKeyEncrypted: encryptOciPrivateKey(parsed.data.privateKey) } : {}),
      ...(parsed.data.passphrase ? { passphraseEncrypted: encryptOciPassphrase(parsed.data.passphrase) } : {}),
      defaultRegion: parsed.data.defaultRegion,
      regions: parsed.data.regions,
      compartments: parsed.data.compartments,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "oci_connection.update",
    entityType: "OCI_CONNECTION",
    entityId: updated.id,
    entityLabel: updated.name,
    description: `Conexão OCI "${updated.name}" atualizada${parsed.data.privateKey ? " (chave privada alterada)" : ""}`,
    status: "SUCCESS",
  });

  revalidatePath("/oci/conexoes");
  revalidatePath(`/oci/conexoes/${updated.id}`);
  return { success: "Conexão atualizada com sucesso." };
}

export async function deleteOciConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.ociConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  await db.ociConnection.delete({ where: { id: connectionId } });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "oci_connection.delete",
    entityType: "OCI_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: `Conexão OCI "${conn.name}" removida`,
    status: "SUCCESS",
  });

  revalidatePath("/oci/conexoes");
  return { success: "Conexão removida." };
}

/** Testa uma conexão já salva (usa a chave privada gravada) e atualiza o status exibido na listagem. */
export async function testSavedOciConnectionAction(connectionId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const conn = await db.ociConnection.findUnique({ where: { id: connectionId } });
  if (!conn) return { error: "Conexão não encontrada." };

  const config = await loadOciConnectionConfig(connectionId);
  const result = await testOciConnection(config);

  await db.ociConnection.update({
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
    action: "oci_connection.test",
    entityType: "OCI_CONNECTION",
    entityId: connectionId,
    entityLabel: conn.name,
    description: result.success
      ? `Teste de conexão com "${conn.name}" bem-sucedido (${result.latencyMs}ms)`
      : `Teste de conexão com "${conn.name}" falhou: ${result.error}`,
    status: result.success ? "SUCCESS" : "FAILURE",
  });

  revalidatePath("/oci/conexoes");
  revalidatePath(`/oci/conexoes/${connectionId}`);
  return { test: result };
}
