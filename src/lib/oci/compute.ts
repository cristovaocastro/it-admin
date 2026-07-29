import "server-only";
import type { ComputeClient, VirtualNetworkClient } from "oci-core";
import { getComputeClient, getVirtualNetworkClient } from "@/lib/oci/client";
import { toIsoString } from "@/lib/oci/types";
import type { OciConnectionConfig } from "@/lib/oci/types";

export type OciInstance = {
  id: string;
  name?: string;
  shape: string;
  state: string; // PROVISIONING | RUNNING | STARTING | STOPPING | STOPPED | MOVING | TERMINATING | TERMINATED | CREATING_IMAGE
  availabilityDomain: string;
  faultDomain?: string;
  publicIp?: string;
  privateIp?: string;
  compartmentId: string;
  region: string;
  timeCreated?: string;
};

/** Resolve o IP público/privado da VNIC primária da instância. Best-effort: sem permissão de rede, a instância ainda aparece na lista, só sem IP. */
async function resolvePrimaryIps(
  computeClient: ComputeClient,
  vnClient: VirtualNetworkClient,
  compartmentId: string,
  instanceId: string
): Promise<{ publicIp?: string; privateIp?: string }> {
  try {
    const attachments = await computeClient.listVnicAttachments({ compartmentId, instanceId });
    for (const attachment of attachments.items ?? []) {
      if (!attachment.vnicId || attachment.lifecycleState !== "ATTACHED") continue;
      const { vnic } = await vnClient.getVnic({ vnicId: attachment.vnicId });
      if (vnic.isPrimary) return { publicIp: vnic.publicIp, privateIp: vnic.privateIp };
    }
  } catch {
    return {};
  }
  return {};
}

/** Lista instâncias de computação em todas as regiões/compartments monitorados pela conexão. */
export async function listOciInstances(config: OciConnectionConfig): Promise<OciInstance[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const computeClient = getComputeClient(config, region);
      const vnClient = getVirtualNetworkClient(config, region);
      const perCompartment = await Promise.all(
        config.compartments.map(async (compartmentId) => {
          const instances: OciInstance[] = [];
          let page: string | undefined;
          do {
            const result = await computeClient.listInstances({ compartmentId, page });
            for (const instance of result.items ?? []) {
              const ips = await resolvePrimaryIps(computeClient, vnClient, compartmentId, instance.id);
              instances.push({
                id: instance.id,
                name: instance.displayName,
                shape: instance.shape,
                state: instance.lifecycleState,
                availabilityDomain: instance.availabilityDomain,
                faultDomain: instance.faultDomain,
                publicIp: ips.publicIp,
                privateIp: ips.privateIp,
                compartmentId,
                region,
                timeCreated: toIsoString(instance.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);
          return instances;
        })
      );
      return perCompartment.flat();
    })
  );
  return perRegion.flat();
}

export type OciInstanceAction = "start" | "stop" | "reboot";

const ACTION_MAP: Record<OciInstanceAction, string> = {
  start: "START",
  stop: "SOFTSTOP", // desligamento gracioso (envia shutdown ao SO, aguarda até 15min antes de forçar)
  reboot: "SOFTRESET", // reboot gracioso, mesmo princípio do SOFTSTOP
};

export async function setOciInstanceState(
  config: OciConnectionConfig,
  region: string,
  instanceId: string,
  action: OciInstanceAction
): Promise<void> {
  const client = getComputeClient(config, region);
  await client.instanceAction({ instanceId, action: ACTION_MAP[action] });
}
