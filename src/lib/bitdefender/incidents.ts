import "server-only";
import { callJsonRpc } from "@/lib/bitdefender/client";
import type { BitdefenderConnectionConfig, BitdefenderIncident } from "@/lib/bitdefender/types";

// Serviço `incidents` (EDR/XDR) — só responde se a licença GravityZone cobrir o addon.

type RawIncident = {
  id: string;
  name?: string | null;
  severity?: string;
  status?: string | null;
  endpointName?: string | null;
  detectedAt?: string | null;
};
type ListIncidentsResult = { total: number; page: number; perPage: number; pagesCount: number; items: RawIncident[] };

const PAGE_SIZE = 100;

function mapIncident(raw: RawIncident): BitdefenderIncident {
  return {
    id: raw.id,
    name: raw.name ?? null,
    severity: (raw.severity as BitdefenderIncident["severity"]) ?? "low",
    status: raw.status ?? null,
    endpointName: raw.endpointName ?? null,
    detectedAt: raw.detectedAt ?? null,
  };
}

export async function listBitdefenderIncidents(config: BitdefenderConnectionConfig): Promise<BitdefenderIncident[]> {
  const incidents: BitdefenderIncident[] = [];
  let page = 1;
  for (;;) {
    const result = await callJsonRpc<ListIncidentsResult>(config, "incidents", "getIncidentsList", {
      page,
      perPage: PAGE_SIZE,
    });
    incidents.push(...result.items.map(mapIncident));
    if (page >= result.pagesCount) break;
    page++;
  }
  return incidents;
}

export async function getBitdefenderIncidentDetails(
  config: BitdefenderConnectionConfig,
  incidentId: string
): Promise<BitdefenderIncident> {
  const raw = await callJsonRpc<RawIncident>(config, "incidents", "getIncidentDetails", { incidentId });
  return mapIncident(raw);
}
