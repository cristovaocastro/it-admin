import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { AwsConnectionConfig } from "@/lib/aws/types";

/** Carrega uma conexão AWS do banco e descriptografa a secret key, pronta para uso na API. */
export async function loadAwsConnectionConfig(connectionId: string): Promise<AwsConnectionConfig> {
  const conn = await db.awsConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return {
    id: conn.id,
    name: conn.name,
    accessKeyId: conn.accessKeyId,
    secretAccessKey: decryptSecret(conn.secretAccessKeyEncrypted),
    defaultRegion: conn.defaultRegion,
    regions: conn.regions,
  };
}

export function encryptAwsSecretKey(plain: string): string {
  return encryptSecret(plain);
}
