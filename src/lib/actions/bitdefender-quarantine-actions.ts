"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { restoreBitdefenderQuarantineItem, removeBitdefenderQuarantineItem } from "@/lib/bitdefender/quarantine";
import { withBitdefenderErrorHandling } from "@/lib/bitdefender/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

async function runQuarantineAction(params: {
  connectionId: string;
  itemId: string;
  label: string;
  action: "restore" | "remove";
  fn: (config: Awaited<ReturnType<typeof loadBitdefenderConnectionConfig>>, itemId: string) => Promise<void>;
  successLabel: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadBitdefenderConnectionConfig(params.connectionId);

  const result = await withBitdefenderErrorHandling(() => params.fn(config, params.itemId));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: `bitdefender_quarantine_item.${params.action}`,
    entityType: "BITDEFENDER_QUARANTINE_ITEM",
    entityId: params.itemId,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao ${params.action === "restore" ? "restaurar" : "remover"} item de quarentena "${params.label}": ${result.error}`
        : `Item de quarentena "${params.label}" ${params.successLabel}`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/bitdefender/quarentena");
  return { success: `Item ${params.successLabel}.` };
}

export async function restoreBitdefenderQuarantineItemAction(params: {
  connectionId: string;
  itemId: string;
  label: string;
}): Promise<ActionState> {
  return runQuarantineAction({
    ...params,
    action: "restore",
    fn: restoreBitdefenderQuarantineItem,
    successLabel: "restaurado",
  });
}

export async function removeBitdefenderQuarantineItemAction(params: {
  connectionId: string;
  itemId: string;
  label: string;
}): Promise<ActionState> {
  return runQuarantineAction({
    ...params,
    action: "remove",
    fn: removeBitdefenderQuarantineItem,
    successLabel: "removido",
  });
}
