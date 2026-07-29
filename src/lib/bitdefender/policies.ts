import "server-only";
import { callJsonRpc } from "@/lib/bitdefender/client";
import type { BitdefenderConnectionConfig, BitdefenderPolicy } from "@/lib/bitdefender/types";

type RawPolicy = { id: string; name?: string; type?: string | null };
type ListPoliciesResult = { total: number; page: number; perPage: number; pagesCount: number; items: RawPolicy[] };

const PAGE_SIZE = 100;

export async function listBitdefenderPolicies(config: BitdefenderConnectionConfig): Promise<BitdefenderPolicy[]> {
  const policies: BitdefenderPolicy[] = [];
  let page = 1;
  for (;;) {
    const result = await callJsonRpc<ListPoliciesResult>(config, "policies", "getPoliciesList", {
      page,
      perPage: PAGE_SIZE,
    });
    policies.push(...result.items.map((raw) => ({ id: raw.id, name: raw.name ?? raw.id, type: raw.type ?? null })));
    if (page >= result.pagesCount) break;
    page++;
  }
  return policies;
}

export async function assignBitdefenderPolicy(
  config: BitdefenderConnectionConfig,
  endpointIds: string[],
  policyId: string
): Promise<void> {
  await callJsonRpc(config, "network", "setEndpointsPolicy", { endpointIds, policyId });
}
