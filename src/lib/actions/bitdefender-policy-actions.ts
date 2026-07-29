"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { assignBitdefenderPolicy } from "@/lib/bitdefender/policies";
import { withBitdefenderErrorHandling } from "@/lib/bitdefender/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

export async function assignBitdefenderPolicyAction(params: {
  connectionId: string;
  endpointIds: string[];
  policyId: string;
  policyLabel: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  if (params.endpointIds.length === 0) return { error: "Selecione ao menos um endpoint." };

  const config = await loadBitdefenderConnectionConfig(params.connectionId);
  const result = await withBitdefenderErrorHandling(() =>
    assignBitdefenderPolicy(config, params.endpointIds, params.policyId)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "bitdefender_policy.assign",
    entityType: "BITDEFENDER_POLICY",
    entityId: params.policyId,
    entityLabel: params.policyLabel,
    description:
      "error" in result
        ? `Falha ao atribuir política "${params.policyLabel}" a ${params.endpointIds.length} endpoint(s): ${result.error}`
        : `Política "${params.policyLabel}" atribuída a ${params.endpointIds.length} endpoint(s)`,
    metadata: { connectionId: params.connectionId, endpointIds: params.endpointIds },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/bitdefender/endpoints");
  revalidatePath("/bitdefender/politicas");
  return { success: "Política atribuída." };
}
