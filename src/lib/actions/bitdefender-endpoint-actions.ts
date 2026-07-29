"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import {
  runBitdefenderEndpointScan,
  isolateBitdefenderEndpoint,
  restoreBitdefenderEndpointFromIsolation,
  uninstallBitdefenderEndpointProtection,
  invalidateBitdefenderEndpointsCache,
} from "@/lib/bitdefender/endpoints";
import { withBitdefenderErrorHandling } from "@/lib/bitdefender/error-handling";
import type { BitdefenderEndpointAction } from "@/lib/bitdefender/types";

export type ActionState = { error?: string; success?: string } | undefined;

const ACTION_LABEL: Record<BitdefenderEndpointAction, string> = {
  scan_quick: "scan rápido disparado",
  scan_full: "scan completo disparado",
  isolate: "isolado da rede",
  restore: "restaurado da isolação",
  uninstall: "desinstalação disparada",
};

export async function runBitdefenderEndpointAction(params: {
  connectionId: string;
  endpointId: string;
  label: string;
  action: BitdefenderEndpointAction;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadBitdefenderConnectionConfig(params.connectionId);

  const result = await withBitdefenderErrorHandling(async () => {
    switch (params.action) {
      case "scan_quick":
        return runBitdefenderEndpointScan(config, params.endpointId, "quick");
      case "scan_full":
        return runBitdefenderEndpointScan(config, params.endpointId, "full");
      case "isolate":
        return isolateBitdefenderEndpoint(config, params.endpointId);
      case "restore":
        return restoreBitdefenderEndpointFromIsolation(config, params.endpointId);
      case "uninstall":
        return uninstallBitdefenderEndpointProtection(config, params.endpointId);
    }
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: `bitdefender_endpoint.${params.action}`,
    entityType: "BITDEFENDER_ENDPOINT",
    entityId: params.endpointId,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao executar "${params.action}" no endpoint "${params.label}": ${result.error}`
        : `Endpoint "${params.label}": ${ACTION_LABEL[params.action]}`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  invalidateBitdefenderEndpointsCache(params.connectionId);
  revalidatePath("/bitdefender/endpoints");
  revalidatePath(`/bitdefender/endpoints/${params.endpointId}`);
  revalidatePath("/bitdefender/saude");
  return { success: `Endpoint ${ACTION_LABEL[params.action]}.` };
}
