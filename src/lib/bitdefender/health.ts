import "server-only";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { listBitdefenderEndpoints } from "@/lib/bitdefender/endpoints";
import { listBitdefenderQuarantineItems } from "@/lib/bitdefender/quarantine";
import { listBitdefenderIncidents } from "@/lib/bitdefender/incidents";
import type { BitdefenderEndpoint, BitdefenderEndpointIssue, BitdefenderSecurityHealth } from "@/lib/bitdefender/types";

const STALE_HOURS = 24;
/** Módulo desativado em quase toda a frota (licença não contratada / padrão de política) não é sinal de problema pontual. */
const FLEET_WIDE_DISABLED_THRESHOLD = 0.9;

/** Nomes de módulo desativados em >= `FLEET_WIDE_DISABLED_THRESHOLD` dos endpoints gerenciados — ruído, não anomalia. */
function moduleNamesDisabledFleetWide(endpoints: BitdefenderEndpoint[]): Set<string> {
  const managed = endpoints.filter((e) => e.isManaged);
  if (managed.length === 0) return new Set();
  const disabledCount = new Map<string, number>();
  for (const e of managed) {
    for (const [name, enabled] of Object.entries(e.modules)) {
      if (!enabled) disabledCount.set(name, (disabledCount.get(name) ?? 0) + 1);
    }
  }
  const result = new Set<string>();
  for (const [name, count] of disabledCount) {
    if (count / managed.length >= FLEET_WIDE_DISABLED_THRESHOLD) result.add(name);
  }
  return result;
}

/** Endpoint sem contato recente com o GravityZone — sinal de agente travado/rede bloqueada/máquina desligada há muito tempo. */
function isStale(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  const hours = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60);
  return hours > STALE_HOURS;
}

/**
 * Agrupa o inventário de endpoints nas 5 categorias do painel de saúde: atualização, segurança,
 * comunicação, módulos e políticas — espelha os widgets de status nativos do Control Center do
 * GravityZone.
 */
export function summarizeBitdefenderHealth(endpoints: BitdefenderEndpoint[]): BitdefenderSecurityHealth {
  const updateIssues: BitdefenderEndpointIssue[] = [];
  const securityIssues: BitdefenderEndpointIssue[] = [];
  const communicationIssues: BitdefenderEndpointIssue[] = [];
  const moduleIssues: BitdefenderEndpointIssue[] = [];
  const policyIssues: BitdefenderEndpointIssue[] = [];
  const fleetWideDisabledModules = moduleNamesDisabledFleetWide(endpoints);

  for (const e of endpoints) {
    if (e.productOutdated || e.signatureOutdated) {
      const reasons = [
        e.productOutdated && "produto desatualizado",
        e.signatureOutdated && "assinaturas de malware desatualizadas",
      ].filter(Boolean);
      updateIssues.push({ id: e.id, name: e.name, reason: reasons.join(" · ") });
    }

    if (!e.isManaged) {
      // Máquina descoberta na rede pelo GravityZone mas sem o agente instalado — sem proteção alguma.
      securityIssues.push({ id: e.id, name: e.name, reason: "Sem agente instalado (não gerenciado)" });
    } else if (e.malwareStatus === "infected") {
      securityIssues.push({ id: e.id, name: e.name, reason: "Malware detectado" });
    } else if (e.isolated) {
      securityIssues.push({ id: e.id, name: e.name, reason: "Isolado da rede (contenção ativa)" });
    }

    if (e.online === false) {
      communicationIssues.push({ id: e.id, name: e.name, reason: "Offline" });
    } else if (isStale(e.lastSeen)) {
      communicationIssues.push({
        id: e.id,
        name: e.name,
        reason: `Sem contato há mais de ${STALE_HOURS}h`,
      });
    }

    for (const [moduleName, enabled] of Object.entries(e.modules)) {
      if (!enabled && !fleetWideDisabledModules.has(moduleName)) {
        moduleIssues.push({ id: e.id, name: e.name, reason: `Módulo "${moduleName}" desativado` });
      }
    }

    if (!e.policyName) {
      policyIssues.push({ id: e.id, name: e.name, reason: "Nenhuma política atribuída" });
    } else if (e.policyStatus === "not_applied") {
      policyIssues.push({ id: e.id, name: e.name, reason: "Política não aplicada" });
    }
  }

  return {
    totalEndpoints: endpoints.length,
    updateIssues,
    securityIssues,
    communicationIssues,
    moduleIssues,
    policyIssues,
  };
}

export type BitdefenderHealthStats = {
  totalEndpoints: number;
  /** Descobertos na rede pelo GravityZone mas sem o agente instalado — sem proteção alguma. */
  unmanagedEndpoints: number;
  infectedEndpoints: number;
  isolatedEndpoints: number;
  quarantineItems: number;
  activeIncidents: number;
  /** Nomes das conexões que falharam ao consultar (o widget ainda mostra o resto). */
  connectionErrors: string[];
};

/** Agrega indicadores de saúde do GravityZone (endpoints, quarentena, incidentes EDR) para o dashboard. */
export async function getBitdefenderHealthStats(
  connections: { id: string; name: string }[]
): Promise<BitdefenderHealthStats> {
  const stats: BitdefenderHealthStats = {
    totalEndpoints: 0,
    unmanagedEndpoints: 0,
    infectedEndpoints: 0,
    isolatedEndpoints: 0,
    quarantineItems: 0,
    activeIncidents: 0,
    connectionErrors: [],
  };

  for (const conn of connections) {
    try {
      const config = await loadBitdefenderConnectionConfig(conn.id);
      const [endpoints, quarantineItems, incidents] = await Promise.all([
        listBitdefenderEndpoints(config),
        listBitdefenderQuarantineItems(config),
        listBitdefenderIncidents(config).catch(() => []), // EDR pode não estar licenciado
      ]);

      stats.totalEndpoints += endpoints.length;
      stats.unmanagedEndpoints += endpoints.filter((e) => !e.isManaged).length;
      stats.infectedEndpoints += endpoints.filter((e) => e.malwareStatus === "infected").length;
      stats.isolatedEndpoints += endpoints.filter((e) => e.isolated).length;
      stats.quarantineItems += quarantineItems.length;
      stats.activeIncidents += incidents.filter((i) => i.status !== "resolved" && i.status !== "closed").length;
    } catch {
      stats.connectionErrors.push(conn.name);
    }
  }

  return stats;
}
