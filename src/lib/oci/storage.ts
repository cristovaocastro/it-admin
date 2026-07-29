import "server-only";
import { getBlockstorageClient } from "@/lib/oci/client";
import { toIsoString } from "@/lib/oci/types";
import type { OciConnectionConfig } from "@/lib/oci/types";

export type OciVolume = {
  id: string;
  kind: "block" | "boot";
  name?: string;
  sizeInGBs?: number;
  vpusPerGB?: number;
  state: string; // PROVISIONING | RESTORING | AVAILABLE | TERMINATING | TERMINATED | FAULTY
  availabilityDomain: string;
  compartmentId: string;
  region: string;
  timeCreated?: string;
};

/** Lista block volumes e boot volumes (discos de sistema das instâncias) em todas as regiões/compartments monitorados. */
export async function listOciVolumes(config: OciConnectionConfig): Promise<OciVolume[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getBlockstorageClient(config, region);
      const perCompartment = await Promise.all(
        config.compartments.map(async (compartmentId) => {
          const volumes: OciVolume[] = [];

          let page: string | undefined;
          do {
            const result = await client.listVolumes({ compartmentId, page });
            for (const v of result.items ?? []) {
              volumes.push({
                id: v.id,
                kind: "block",
                name: v.displayName,
                sizeInGBs: v.sizeInGBs,
                vpusPerGB: v.vpusPerGB,
                state: v.lifecycleState,
                availabilityDomain: v.availabilityDomain,
                compartmentId,
                region,
                timeCreated: toIsoString(v.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);

          page = undefined;
          do {
            // availabilityDomain é opcional no tipo, mas algumas versões da API exigem o parâmetro —
            // se a OCI passar a rejeitar sem ele, precisaremos enumerar ADs via oci-identity antes deste loop.
            const result = await client.listBootVolumes({ compartmentId, page });
            for (const v of result.items ?? []) {
              volumes.push({
                id: v.id,
                kind: "boot",
                name: v.displayName,
                sizeInGBs: v.sizeInGBs,
                vpusPerGB: v.vpusPerGB,
                state: v.lifecycleState,
                availabilityDomain: v.availabilityDomain,
                compartmentId,
                region,
                timeCreated: toIsoString(v.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);

          return volumes;
        })
      );
      return perCompartment.flat();
    })
  );
  return perRegion.flat();
}
