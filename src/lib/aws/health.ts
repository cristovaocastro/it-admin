import "server-only";
import { loadAwsConnectionConfig } from "@/lib/aws/connection";
import { listEc2Instances } from "@/lib/aws/ec2";
import { listRecentBackupJobs } from "@/lib/aws/backup";
import { listVpnConnections, listVpcEndpoints } from "@/lib/aws/network";

export type AwsHealthStats = {
  totalInstances: number;
  runningInstances: number;
  stoppedInstances: number;
  backupFailures7d: number;
  vpnTunnelsDown: number;
  endpointsUnavailable: number;
  /** Nomes das conexões que falharam ao consultar (o widget ainda mostra o resto). */
  connectionErrors: string[];
};

/** Agrega indicadores de saúde da AWS (instâncias, backup, VPN, endpoints) para o dashboard. */
export async function getAwsHealthStats(connections: { id: string; name: string }[]): Promise<AwsHealthStats> {
  const stats: AwsHealthStats = {
    totalInstances: 0,
    runningInstances: 0,
    stoppedInstances: 0,
    backupFailures7d: 0,
    vpnTunnelsDown: 0,
    endpointsUnavailable: 0,
    connectionErrors: [],
  };

  for (const conn of connections) {
    try {
      const config = await loadAwsConnectionConfig(conn.id);
      const [instances, backupJobs, vpnConnections, endpoints] = await Promise.all([
        listEc2Instances(config),
        listRecentBackupJobs(config, 7),
        listVpnConnections(config),
        listVpcEndpoints(config),
      ]);

      stats.totalInstances += instances.length;
      for (const i of instances) {
        if (i.state === "running") stats.runningInstances++;
        if (i.state === "stopped") stats.stoppedInstances++;
      }

      stats.backupFailures7d += backupJobs.filter((j) => j.state === "FAILED" || j.state === "ABORTED").length;

      for (const vpn of vpnConnections) {
        if (vpn.state !== "available") continue;
        for (const tunnel of vpn.tunnels) {
          if (tunnel.status !== "UP") stats.vpnTunnelsDown++;
        }
      }

      stats.endpointsUnavailable += endpoints.filter((e) => e.state !== "available").length;
    } catch {
      stats.connectionErrors.push(conn.name);
    }
  }

  return stats;
}
