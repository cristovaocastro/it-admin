import "server-only";
import { getDatabaseClient } from "@/lib/oci/client";
import { toIsoString } from "@/lib/oci/types";
import type { OciConnectionConfig } from "@/lib/oci/types";

export type OciDatabase = {
  id: string;
  kind: "db_system" | "autonomous";
  name?: string;
  shape?: string; // só db_system
  workload?: string; // só autonomous (OLTP, DW, AJD, APEX...)
  dbVersion?: string;
  cpuCoreCount?: number;
  storageSize?: string; // resumo legível (GB para db_system, TB para autonomous)
  state: string;
  availabilityDomain?: string; // só db_system — autonomous não é atrelado a uma única AD
  compartmentId: string;
  region: string;
  timeCreated?: string;
};

/** Lista DB Systems e Autonomous Databases em todas as regiões/compartments monitorados. */
export async function listOciDatabases(config: OciConnectionConfig): Promise<OciDatabase[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getDatabaseClient(config, region);
      const perCompartment = await Promise.all(
        config.compartments.map(async (compartmentId) => {
          const databases: OciDatabase[] = [];

          let page: string | undefined;
          do {
            const result = await client.listDbSystems({ compartmentId, page });
            for (const d of result.items ?? []) {
              databases.push({
                id: d.id,
                kind: "db_system",
                name: d.displayName,
                shape: d.shape,
                dbVersion: d.version,
                cpuCoreCount: d.cpuCoreCount,
                storageSize: d.dataStorageSizeInGBs ? `${d.dataStorageSizeInGBs} GB` : undefined,
                state: d.lifecycleState,
                availabilityDomain: d.availabilityDomain,
                compartmentId,
                region,
                timeCreated: toIsoString(d.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);

          page = undefined;
          do {
            const result = await client.listAutonomousDatabases({ compartmentId, page });
            for (const d of result.items ?? []) {
              databases.push({
                id: d.id,
                kind: "autonomous",
                name: d.displayName,
                workload: d.dbWorkload,
                dbVersion: d.dbVersion,
                cpuCoreCount: d.cpuCoreCount ?? d.ocpuCount,
                storageSize: `${d.dataStorageSizeInTBs} TB`,
                state: d.lifecycleState,
                compartmentId,
                region,
                timeCreated: toIsoString(d.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);

          return databases;
        })
      );
      return perCompartment.flat();
    })
  );
  return perRegion.flat();
}
