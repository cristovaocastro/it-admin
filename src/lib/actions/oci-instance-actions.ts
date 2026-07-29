"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadOciConnectionConfig } from "@/lib/oci/connection";
import { setOciInstanceState } from "@/lib/oci/compute";
import { withOciErrorHandling } from "@/lib/oci/error-handling";
import type { OciInstanceAction } from "@/lib/oci/compute";

export type ActionState = { error?: string; success?: string } | undefined;

const ACTION_LABEL: Record<OciInstanceAction, string> = {
  start: "iniciada",
  stop: "parada",
  reboot: "reiniciada",
};

export async function setOciInstanceStateAction(params: {
  connectionId: string;
  region: string;
  instanceId: string;
  label: string;
  action: OciInstanceAction;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadOciConnectionConfig(params.connectionId);

  const result = await withOciErrorHandling(() =>
    setOciInstanceState(config, params.region, params.instanceId, params.action)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: `oci_instance.${params.action}`,
    entityType: "OCI_INSTANCE",
    entityId: params.instanceId,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao ${params.action === "reboot" ? "reiniciar" : params.action === "start" ? "iniciar" : "parar"} a instância "${params.label}" (${params.region}): ${result.error}`
        : `Instância "${params.label}" (${params.region}) ${ACTION_LABEL[params.action]}`,
    metadata: { connectionId: params.connectionId, region: params.region },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/oci/instancias");
  return { success: `Instância ${ACTION_LABEL[params.action]}.` };
}
