import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { AdConnectionConfig } from "@/lib/ad/types";

/** Carrega uma conexão AD do banco e descriptografa a senha de bind, pronta para uso no ldapjs. */
export async function loadAdConnectionConfig(connectionId: string): Promise<AdConnectionConfig> {
  const conn = await db.adConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return {
    id: conn.id,
    name: conn.name,
    host: conn.host,
    port: conn.port,
    baseDN: conn.baseDN,
    bindDN: conn.bindDN,
    bindPassword: decryptSecret(conn.bindPasswordEncrypted),
    encryption: conn.encryption,
    rejectUnauthorized: conn.rejectUnauthorized,
    usersOU: conn.usersOU,
    groupsOU: conn.groupsOU,
    computersOU: conn.computersOU,
  };
}

export function encryptBindPassword(plain: string): string {
  return encryptSecret(plain);
}
