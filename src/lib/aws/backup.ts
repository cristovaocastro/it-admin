import "server-only";
import { ListBackupJobsCommand, ListBackupVaultsCommand, ListBackupPlansCommand } from "@aws-sdk/client-backup";
import { getBackupClient } from "@/lib/aws/client";
import type { AwsConnectionConfig } from "@/lib/aws/types";
import type { AwsBackupJob, AwsBackupVault, AwsBackupPlan } from "@/lib/aws/backup-shared";

export type { AwsBackupJob, AwsBackupVault, AwsBackupPlan } from "@/lib/aws/backup-shared";
export { resourceTypeLabel, resourceDisplayName } from "@/lib/aws/backup-shared";

/** Lista os jobs de backup criados nos últimos `days` dias, em todas as regiões monitoradas. */
export async function listRecentBackupJobs(config: AwsConnectionConfig, days = 7): Promise<AwsBackupJob[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getBackupClient(config, region);
      const jobs: AwsBackupJob[] = [];
      let nextToken: string | undefined;
      do {
        const result = await client.send(
          new ListBackupJobsCommand({ ByCreatedAfter: since, NextToken: nextToken, MaxResults: 100 })
        );
        for (const job of result.BackupJobs ?? []) {
          if (!job.BackupJobId) continue;
          jobs.push({
            jobId: job.BackupJobId,
            state: job.State ?? "UNKNOWN",
            resourceType: job.ResourceType,
            resourceArn: job.ResourceArn,
            resourceName: job.ResourceName,
            vaultName: job.BackupVaultName,
            backupPlanId: job.CreatedBy?.BackupPlanId,
            backupPlanName: job.CreatedBy?.BackupPlanName,
            creationDate: job.CreationDate?.toISOString(),
            completionDate: job.CompletionDate?.toISOString(),
            statusMessage: job.StatusMessage,
            region,
          });
        }
        nextToken = result.NextToken;
      } while (nextToken);
      return jobs;
    })
  );
  return perRegion.flat().sort((a, b) => (b.creationDate ?? "").localeCompare(a.creationDate ?? ""));
}

export async function listBackupVaultsAndPlans(
  config: AwsConnectionConfig
): Promise<{ vaults: AwsBackupVault[]; plans: AwsBackupPlan[] }> {
  const perRegion = await Promise.all(
    config.regions.map(async (region) => {
      const client = getBackupClient(config, region);
      const [vaultsResult, plansResult] = await Promise.all([
        client.send(new ListBackupVaultsCommand({})),
        client.send(new ListBackupPlansCommand({})),
      ]);
      const vaults: AwsBackupVault[] = (vaultsResult.BackupVaultList ?? []).map((v) => ({
        name: v.BackupVaultName ?? "—",
        recoveryPoints: v.NumberOfRecoveryPoints ?? 0,
        region,
      }));
      const plans: AwsBackupPlan[] = (plansResult.BackupPlansList ?? []).map((p) => ({
        id: p.BackupPlanId ?? "—",
        name: p.BackupPlanName ?? "—",
        region,
      }));
      return { vaults, plans };
    })
  );
  return {
    vaults: perRegion.flatMap((r) => r.vaults),
    plans: perRegion.flatMap((r) => r.plans),
  };
}
