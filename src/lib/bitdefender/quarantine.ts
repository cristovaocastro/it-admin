import "server-only";
import { callJsonRpc } from "@/lib/bitdefender/client";
import type { BitdefenderConnectionConfig, BitdefenderQuarantineItem } from "@/lib/bitdefender/types";

type RawQuarantineItem = {
  id: string;
  endpointId: string;
  endpointName?: string | null;
  threatName?: string | null;
  filePath?: string | null;
  detectionTime?: string | null;
};

type ListQuarantineResult = { total: number; page: number; perPage: number; pagesCount: number; items: RawQuarantineItem[] };

function mapQuarantineItem(raw: RawQuarantineItem): BitdefenderQuarantineItem {
  return {
    id: raw.id,
    endpointId: raw.endpointId,
    endpointName: raw.endpointName ?? null,
    threatName: raw.threatName ?? null,
    filePath: raw.filePath ?? null,
    detectionTime: raw.detectionTime ?? null,
  };
}

const PAGE_SIZE = 100;

export async function listBitdefenderQuarantineItems(
  config: BitdefenderConnectionConfig
): Promise<BitdefenderQuarantineItem[]> {
  const items: BitdefenderQuarantineItem[] = [];
  let page = 1;
  for (;;) {
    const result = await callJsonRpc<ListQuarantineResult>(config, "quarantine", "getQuarantineItemsList", {
      page,
      perPage: PAGE_SIZE,
    });
    items.push(...result.items.map(mapQuarantineItem));
    if (page >= result.pagesCount) break;
    page++;
  }
  return items;
}

export async function restoreBitdefenderQuarantineItem(config: BitdefenderConnectionConfig, itemId: string): Promise<void> {
  await callJsonRpc(config, "quarantine", "createRestoreQuarantineItemTask", { quarantineItemIds: [itemId] });
}

export async function removeBitdefenderQuarantineItem(config: BitdefenderConnectionConfig, itemId: string): Promise<void> {
  await callJsonRpc(config, "quarantine", "createRemoveQuarantineItemTask", { quarantineItemIds: [itemId] });
}
