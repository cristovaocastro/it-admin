"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import {
  setAdComputerEnabled,
  updateAdComputerDescription,
  moveAdComputer,
  deleteAdComputer,
} from "@/lib/ad/computers";
import { withAdErrorHandling } from "@/lib/ad/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

function pathFor(connectionId: string) {
  return `/ad/computadores?conexao=${connectionId}`;
}

export async function setAdComputerEnabledAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  enabled: boolean;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => setAdComputerEnabled(config, params.dn, params.enabled));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: params.enabled ? "ad_computer.enable" : "ad_computer.disable",
    entityType: "AD_COMPUTER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao ${params.enabled ? "habilitar" : "desabilitar"} computador AD "${params.label}": ${result.error}`
        : `Computador AD "${params.label}" ${params.enabled ? "habilitado" : "desabilitado"}`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: `Computador ${params.enabled ? "habilitado" : "desabilitado"}.` };
}

const updateSchema = z.object({
  connectionId: z.string().uuid(),
  dn: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export async function updateAdComputerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() =>
    updateAdComputerDescription(config, parsed.data.dn, parsed.data.description ?? "")
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_computer.update",
    entityType: "AD_COMPUTER",
    entityId: parsed.data.dn,
    entityLabel: parsed.data.label,
    description:
      "error" in result
        ? `Falha ao atualizar computador AD "${parsed.data.label}": ${result.error}`
        : `Descrição do computador AD "${parsed.data.label}" atualizada para: "${parsed.data.description ?? ""}"`,
    metadata: { connectionId: parsed.data.connectionId, newDescription: parsed.data.description ?? "" },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: "Computador atualizado." };
}

export async function moveAdComputerAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  newOuDn: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => moveAdComputer(config, params.dn, params.newOuDn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_computer.move",
    entityType: "AD_COMPUTER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao mover computador AD "${params.label}": ${result.error}`
        : `Computador AD "${params.label}" movido para ${params.newOuDn}`,
    metadata: { connectionId: params.connectionId, newOuDn: params.newOuDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Computador movido." };
}

export async function deleteAdComputerAction(params: {
  connectionId: string;
  dn: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => deleteAdComputer(config, params.dn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_computer.delete",
    entityType: "AD_COMPUTER",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao excluir computador AD "${params.label}": ${result.error}`
        : `Computador AD "${params.label}" excluído`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Computador excluído." };
}
