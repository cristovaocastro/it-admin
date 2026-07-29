import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { BitdefenderConnectionConfig } from "@/lib/bitdefender/types";

/** Carrega uma conexão GravityZone do banco e descriptografa a API Key. */
export async function loadBitdefenderConnectionConfig(connectionId: string): Promise<BitdefenderConnectionConfig> {
  const conn = await db.bitdefenderConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return {
    id: conn.id,
    name: conn.name,
    apiUrl: conn.apiUrl,
    apiKey: decryptSecret(conn.apiKeyEncrypted),
    companyId: conn.companyId,
  };
}

export function encryptBitdefenderApiKey(plain: string): string {
  return encryptSecret(plain);
}
