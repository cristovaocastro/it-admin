import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { OciConnectionConfig } from "@/lib/oci/types";

/** Carrega uma conexão OCI do banco e descriptografa a chave privada (e passphrase, se houver). */
export async function loadOciConnectionConfig(connectionId: string): Promise<OciConnectionConfig> {
  const conn = await db.ociConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return {
    id: conn.id,
    name: conn.name,
    tenancyId: conn.tenancyId,
    userId: conn.userId,
    fingerprint: conn.fingerprint,
    privateKey: decryptSecret(conn.privateKeyEncrypted),
    passphrase: conn.passphraseEncrypted ? decryptSecret(conn.passphraseEncrypted) : null,
    defaultRegion: conn.defaultRegion,
    regions: conn.regions,
    compartments: conn.compartments,
  };
}

export function encryptOciPrivateKey(plain: string): string {
  return encryptSecret(plain);
}

export function encryptOciPassphrase(plain: string): string {
  return encryptSecret(plain);
}
