import "server-only";
import { getBlockstorageClient, getDatabaseClient } from "@/lib/oci/client";
import { toIsoString } from "@/lib/oci/types";
import type { OciConnectionConfig } from "@/lib/oci/types";
import type { OciBackup } from "@/lib/oci/backup-shared";

export type { OciBackup } from "@/lib/oci/backup-shared";
export { resourceKindLabel, resourceDisplayName } from "@/lib/oci/backup-shared";

/** Lista backups de volumes, boot volumes, DB Systems e Autonomous Databases em todas as regiões/compartments monitorados. */
export async function listOciBackups(config: OciConnectionConfig): Promise<OciBackup[]> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const blockClient = getBlockstorageClient(config, region);
      const dbClient = getDatabaseClient(config, region);

      const perCompartment = await Promise.all(
        config.compartments.map(async (compartmentId) => {
          const backups: OciBackup[] = [];

          let page: string | undefined;
          do {
            const result = await blockClient.listVolumeBackups({ compartmentId, page });
            for (const b of result.items ?? []) {
              backups.push({
                id: b.id,
                kind: "volume",
                name: b.displayName,
                state: b.lifecycleState,
                type: b.type,
                sizeLabel: b.sizeInGBs ? `${b.sizeInGBs} GB` : undefined,
                sourceResourceId: b.volumeId,
                compartmentId,
                region,
                timeCreated: toIsoString(b.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);

          page = undefined;
          do {
            const result = await blockClient.listBootVolumeBackups({ compartmentId, page });
            for (const b of result.items ?? []) {
              backups.push({
                id: b.id,
                kind: "boot_volume",
                name: b.displayName,
                state: b.lifecycleState,
                type: b.type,
                sizeLabel: b.sizeInGBs ? `${b.sizeInGBs} GB` : undefined,
                sourceResourceId: b.bootVolumeId,
                compartmentId,
                region,
                timeCreated: toIsoString(b.timeCreated),
              });
            }
            page = result.opcNextPage;
          } while (page);

          // Backups de DB System: listBackups({compartmentId}) só retorna backups manuais —
          // os automáticos (os que precisam ser monitorados no dia a dia) só aparecem quando
          // consultados por databaseId. Por isso enumeramos DB Homes -> Databases -> backups
          // de cada database, em vez de confiar na listagem por compartment.
          let dbHomePage: string | undefined;
          do {
            const dbHomesResult = await dbClient.listDbHomes({ compartmentId, page: dbHomePage });
            for (const dbHome of dbHomesResult.items ?? []) {
              if (!dbHome.id) continue;
              let databasePage: string | undefined;
              do {
                const databasesResult = await dbClient.listDatabases({
                  compartmentId,
                  dbHomeId: dbHome.id,
                  page: databasePage,
                });
                for (const database of databasesResult.items ?? []) {
                  if (!database.id) continue;
                  let backupPage: string | undefined;
                  do {
                    const backupsResult = await dbClient.listBackups({ databaseId: database.id, page: backupPage });
                    for (const b of backupsResult.items ?? []) {
                      if (!b.id) continue;
                      backups.push({
                        id: b.id,
                        kind: "db_system",
                        name: b.displayName,
                        state: b.lifecycleState ?? "UNKNOWN",
                        type: b.type,
                        sizeLabel: b.databaseSizeInGBs ? `${b.databaseSizeInGBs} GB` : undefined,
                        sourceResourceId: b.databaseId,
                        compartmentId,
                        region,
                        timeCreated: toIsoString(b.timeStarted ?? b.timeEnded),
                      });
                    }
                    backupPage = backupsResult.opcNextPage;
                  } while (backupPage);
                }
                databasePage = databasesResult.opcNextPage;
              } while (databasePage);
            }
            dbHomePage = dbHomesResult.opcNextPage;
          } while (dbHomePage);

          // Mesma observação vale para Autonomous Database — enumeramos por autonomousDatabaseId.
          let adbPage: string | undefined;
          do {
            const adbResult = await dbClient.listAutonomousDatabases({ compartmentId, page: adbPage });
            for (const adb of adbResult.items ?? []) {
              if (!adb.id) continue;
              let backupPage: string | undefined;
              do {
                const backupsResult = await dbClient.listAutonomousDatabaseBackups({
                  autonomousDatabaseId: adb.id,
                  page: backupPage,
                });
                for (const b of backupsResult.items ?? []) {
                  backups.push({
                    id: b.id,
                    kind: "autonomous",
                    name: b.displayName,
                    state: b.lifecycleState,
                    type: b.type,
                    sizeLabel: b.databaseSizeInTBs ? `${b.databaseSizeInTBs} TB` : undefined,
                    sourceResourceId: b.autonomousDatabaseId,
                    compartmentId,
                    region,
                    timeCreated: toIsoString(b.timeStarted ?? b.timeEnded),
                  });
                }
                backupPage = backupsResult.opcNextPage;
              } while (backupPage);
            }
            adbPage = adbResult.opcNextPage;
          } while (adbPage);

          return backups;
        })
      );
      return perCompartment.flat();
    })
  );
  return perRegion.flat().sort((a, b) => (b.timeCreated ?? "").localeCompare(a.timeCreated ?? ""));
}
