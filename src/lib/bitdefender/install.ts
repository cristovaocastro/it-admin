import "server-only";
import { callJsonRpc } from "@/lib/bitdefender/client";
import type { BitdefenderConnectionConfig, BitdefenderInstallationLink } from "@/lib/bitdefender/types";

type RawInstallationLink = { id: string; osType?: string; kitType?: string | null; downloadUrl: string };
type ListInstallationLinksResult = { items: RawInstallationLink[] };

export async function listBitdefenderInstallationLinks(
  config: BitdefenderConnectionConfig
): Promise<BitdefenderInstallationLink[]> {
  const result = await callJsonRpc<ListInstallationLinksResult>(config, "push", "getInstallationLinks", {});
  return result.items.map((raw) => ({
    id: raw.id,
    osType: raw.osType ?? "unknown",
    kitType: raw.kitType ?? null,
    downloadUrl: raw.downloadUrl,
  }));
}

export async function createBitdefenderInstallationPackage(
  config: BitdefenderConnectionConfig,
  params: { name: string; description?: string }
): Promise<string> {
  const result = await callJsonRpc<{ packageId: string }>(config, "push", "createInstallationPackage", params);
  return result.packageId;
}
