import "server-only";
import { callJsonRpc } from "@/lib/bitdefender/client";
import type { BitdefenderConnectionConfig, BitdefenderEndpoint, BitdefenderModuleMap } from "@/lib/bitdefender/types";

// Nomes de método/campos conferidos contra uma conta GravityZone real em 2026-07-28 (ver
// scripts/debug-bitdefender.ts no histórico do projeto). Duas descobertas importantes:
//
// 1. `network.getEndpointsList` (a API "óbvia" de listagem) NÃO é recursiva — ela só devolve os
//    endpoints de um único grupo/pasta (o "padrão" da conta), não a árvore inteira. Numa conta com
//    296 endpoints gerenciados espalhados em várias pastas, ela devolvia só 98. A única forma de
//    enumerar o inventário completo é andar recursivamente pela árvore de grupos com
//    `network.getNetworkInventoryItems` (mesma navegação que a aba "Rede" do Control Center usa),
//    entrando em cada pasta (`type === 4`) e coletando as folhas (endpoints).
// 2. `getNetworkInventoryItems` só devolve `pagesCount`/`total` na 1ª página de uma pasta — da 2ª
//    em diante esses campos vêm `undefined`. Se o loop de paginação parar quando `pagesCount` some,
//    ele corta o restante da pasta (foi exatamente isso: sumiam 48 máquinas só da pasta
//    "Computadores", que tem 3 páginas). Por isso guardamos o `pagesCount` da 1ª resposta e usamos
//    esse valor fixo pro resto da paginação daquela pasta.
//
// Cada folha da árvore já vem com `details` (fqdn, ip, isManaged, política, módulos) — não precisa
// de N chamadas extras só pra montar o roster. Mas `malwareStatus`, atualização de produto/
// assinatura, `lastSeen` e comunicação (`state`) só existem em `network.getManagedEndpointDetails`
// (que também só existe na v1.0 do endpoint JSON-RPC, não na v1.1) — uma chamada por endpoint
// *gerenciado* (endpoints sem agente instalado fazem esse método responder "Invalid params").

const GROUP_TYPE = 4;
const INVENTORY_PAGE_SIZE = 100;
const DETAILS_CONCURRENCY = 9; // rate limit do GravityZone é 10 req/s por API key

type RawInventoryItem = {
  id: string;
  name?: string;
  type: number;
  parentId?: string;
  details?: {
    fqdn?: string | null;
    ip?: string | null;
    isManaged?: boolean;
    operatingSystemVersion?: string | null;
    policy?: { name?: string | null; applied?: boolean } | null;
    modules?: Record<string, boolean> | null;
  } | null;
};

type InventoryPage = { pagesCount?: number; hasMoreRecords: boolean; items: RawInventoryItem[] };

type RawEndpointDetails = {
  id: string;
  name?: string;
  operatingSystem?: string | null;
  ip?: string | null;
  policy?: { name?: string | null; applied?: boolean } | null;
  malwareStatus?: { infected?: boolean; detection?: boolean } | null;
  isManaged?: boolean;
  isolated?: boolean;
  lastSeen?: string | null;
  /** 0 = desconhecido, 1 = online, 2 = offline, 3 = suspenso. */
  state?: 0 | 1 | 2 | 3;
  agent?: { productOutdated?: boolean; signatureOutdated?: boolean } | null;
  modules?: Record<string, boolean> | null;
};

/** Busca os filhos diretos de uma pasta (ou da raiz, se `parentId` for omitido), paginando corretamente. */
async function listInventoryChildren(
  config: BitdefenderConnectionConfig,
  parentId: string | undefined
): Promise<RawInventoryItem[]> {
  const items: RawInventoryItem[] = [];
  let page = 1;
  let pagesCount: number | undefined;
  for (;;) {
    const params: Record<string, unknown> = { page, perPage: INVENTORY_PAGE_SIZE };
    if (parentId) params.parentId = parentId;
    const result = await callJsonRpc<InventoryPage>(config, "network", "getNetworkInventoryItems", params);
    items.push(...result.items);
    if (result.pagesCount !== undefined) pagesCount = result.pagesCount;
    if (!pagesCount || page >= pagesCount) break;
    page++;
  }
  return items;
}

/** Endpoint (folha) descoberto na árvore, com o nome da pasta em que está. */
type InventoryLeaf = { item: RawInventoryItem; groupName: string | null };

/**
 * Anda recursivamente pela árvore de grupos do GravityZone e devolve todos os endpoints
 * (gerenciados e não gerenciados). Pula a pasta de sistema "Deleted" na raiz — são máquinas
 * removidas/descomissionadas, não fazem parte do inventário ativo.
 */
async function walkInventory(config: BitdefenderConnectionConfig): Promise<InventoryLeaf[]> {
  const leaves: InventoryLeaf[] = [];

  async function walk(parentId: string | undefined, groupName: string | null) {
    const children = await listInventoryChildren(config, parentId);
    for (const item of children) {
      if (item.type === GROUP_TYPE) {
        if (parentId === undefined && item.name === "Deleted") continue;
        await walk(item.id, item.name ?? groupName);
      } else {
        leaves.push({ item, groupName });
      }
    }
  }

  await walk(undefined, null);
  return leaves;
}

function mapEndpoint(leaf: InventoryLeaf, details: RawEndpointDetails | null): BitdefenderEndpoint {
  const roster = leaf.item.details;
  return {
    id: leaf.item.id,
    name: details?.name ?? leaf.item.name ?? leaf.item.id,
    fqdn: roster?.fqdn ?? null,
    ip: details?.ip ?? roster?.ip ?? null,
    operatingSystem: details?.operatingSystem ?? roster?.operatingSystemVersion ?? null,
    groupName: leaf.groupName,
    policyName: details?.policy?.name ?? roster?.policy?.name ?? null,
    malwareStatus: details?.malwareStatus?.infected ? "infected" : details?.malwareStatus ? "clean" : "unknown",
    isManaged: roster?.isManaged ?? true,
    // Nenhum endpoint isolado disponível na conta usada para validar — sem confirmação de que
    // `isolated` é de fato omitido (não `false`) quando não isolado. Revalidar se aparecer um caso real.
    isolated: details?.isolated ?? false,
    lastSeen: details?.lastSeen ?? null,
    online: details?.state === undefined ? null : details.state === 1,
    productOutdated: details?.agent?.productOutdated ?? false,
    signatureOutdated: details?.agent?.signatureOutdated ?? false,
    modules: (details?.modules ?? roster?.modules ?? {}) as BitdefenderModuleMap,
    policyStatus: (details?.policy ?? roster?.policy)
      ? (details?.policy ?? roster?.policy)!.applied
        ? "applied"
        : "not_applied"
      : "unknown",
  };
}

async function fetchDetails(config: BitdefenderConnectionConfig, endpointId: string): Promise<RawEndpointDetails> {
  return callJsonRpc<RawEndpointDetails>(config, "network", "getManagedEndpointDetails", { endpointId }, "v1.0");
}

/**
 * Busca o detalhe de cada endpoint *gerenciado* (com agente) em lotes de `DETAILS_CONCURRENCY`
 * (respeita o limite de 10 req/s do GravityZone). Endpoints não gerenciados (`isManaged: false`
 * — descobertos na rede mas sem agente instalado) são pulados: `getManagedEndpointDetails` rejeita
 * esses IDs com "Invalid params". Falhas pontuais (rede, endpoint removido entre a listagem e a
 * consulta) não derrubam o restante — o endpoint fica com dados de saúde "unknown" em vez de zerar
 * o painel inteiro.
 */
async function fetchDetailsInBatches(
  config: BitdefenderConnectionConfig,
  leaves: InventoryLeaf[]
): Promise<Map<string, RawEndpointDetails>> {
  const managed = leaves.filter((leaf) => leaf.item.details?.isManaged !== false);
  const result = new Map<string, RawEndpointDetails>();
  for (let i = 0; i < managed.length; i += DETAILS_CONCURRENCY) {
    const batch = managed.slice(i, i + DETAILS_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((leaf) => fetchDetails(config, leaf.item.id)));
    settled.forEach((outcome, idx) => {
      if (outcome.status === "fulfilled") result.set(batch[idx].item.id, outcome.value);
    });
  }
  return result;
}

async function fetchBitdefenderEndpointsUncached(config: BitdefenderConnectionConfig): Promise<BitdefenderEndpoint[]> {
  const leaves = await walkInventory(config);
  const detailsById = await fetchDetailsInBatches(config, leaves);
  return leaves.map((leaf) => mapEndpoint(leaf, detailsById.get(leaf.item.id) ?? null));
}

const ENDPOINTS_CACHE_TTL_MS = 3 * 60 * 1000;
const endpointsCache = new Map<string, { expiresAt: number; result: Promise<BitdefenderEndpoint[]> }>();

/**
 * Lista todos os endpoints do inventário (gerenciados e não gerenciados), com dados de saúde.
 * Isso anda a árvore de grupos inteira + 1 chamada por endpoint gerenciado — numa conta com
 * centenas de máquinas isso pode levar dezenas de segundos, então o resultado fica em cache por
 * `ENDPOINTS_CACHE_TTL_MS` por conexão (em memória do processo — não precisa ficar atual a cada
 * clique, e evita martelar a API do GravityZone a cada carregamento do dashboard/saúde/endpoints).
 */
export async function listBitdefenderEndpoints(config: BitdefenderConnectionConfig): Promise<BitdefenderEndpoint[]> {
  const cacheKey = config.id ?? config.apiUrl;
  const cached = endpointsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = fetchBitdefenderEndpointsUncached(config);
  endpointsCache.set(cacheKey, { expiresAt: Date.now() + ENDPOINTS_CACHE_TTL_MS, result });
  result.catch(() => endpointsCache.delete(cacheKey)); // não guarda falha em cache
  return result;
}

/** Invalida o cache de endpoints de uma conexão — chamar depois de ações que mudam o estado do endpoint (scan, isolar, desinstalar). */
export function invalidateBitdefenderEndpointsCache(connectionId: string): void {
  endpointsCache.delete(connectionId);
}

export async function getBitdefenderEndpointDetails(
  config: BitdefenderConnectionConfig,
  endpointId: string
): Promise<BitdefenderEndpoint> {
  const details = await fetchDetails(config, endpointId);
  return mapEndpoint({ item: { id: endpointId, type: 5 }, groupName: null }, details);
}

/** Cria uma tarefa de scan assíncrona — a API confirma só a criação da tarefa, não a conclusão do scan. */
export async function runBitdefenderEndpointScan(
  config: BitdefenderConnectionConfig,
  endpointId: string,
  type: "quick" | "full"
): Promise<void> {
  await callJsonRpc(config, "network", "createScanTask", { endpointIds: [endpointId], type });
}

export async function isolateBitdefenderEndpoint(config: BitdefenderConnectionConfig, endpointId: string): Promise<void> {
  await callJsonRpc(config, "network", "createIsolateEndpointTask", { endpointIds: [endpointId] });
}

export async function restoreBitdefenderEndpointFromIsolation(
  config: BitdefenderConnectionConfig,
  endpointId: string
): Promise<void> {
  await callJsonRpc(config, "network", "createRestoreEndpointFromIsolationTask", { endpointIds: [endpointId] });
}

export async function uninstallBitdefenderEndpointProtection(
  config: BitdefenderConnectionConfig,
  endpointId: string
): Promise<void> {
  await callJsonRpc(config, "network", "createUninstallClientTask", { endpointIds: [endpointId] });
}
