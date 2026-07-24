"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadAwsConnectionConfig } from "@/lib/aws/connection";
import { setEc2InstanceState } from "@/lib/aws/ec2";
import { withAwsErrorHandling } from "@/lib/aws/error-handling";
import type { Ec2InstanceAction } from "@/lib/aws/ec2";

export type ActionState = { error?: string; success?: string } | undefined;

const ACTION_LABEL: Record<Ec2InstanceAction, string> = {
  start: "iniciada",
  stop: "parada",
  reboot: "reiniciada",
};

export async function setEc2InstanceStateAction(params: {
  connectionId: string;
  region: string;
  instanceId: string;
  label: string;
  action: Ec2InstanceAction;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadAwsConnectionConfig(params.connectionId);

  const result = await withAwsErrorHandling(() =>
    setEc2InstanceState(config, params.region, params.instanceId, params.action)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: `aws_ec2_instance.${params.action}`,
    entityType: "AWS_EC2_INSTANCE",
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
  revalidatePath("/aws/instancias");
  return { success: `Instância ${ACTION_LABEL[params.action]}.` };
}
