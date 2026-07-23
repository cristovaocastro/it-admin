import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { FirewallConnectionConfig } from "@/lib/firewall/types";

/** Carrega uma conexão de firewall do banco e descriptografa a senha do admin, pronta para uso na API. */
export async function loadFirewallConnectionConfig(connectionId: string): Promise<FirewallConnectionConfig> {
  const conn = await db.firewallConnection.findUniqueOrThrow({ where: { id: connectionId } });
  return {
    id: conn.id,
    name: conn.name,
    host: conn.host,
    port: conn.port,
    adminUsername: conn.adminUsername,
    adminPassword: decryptSecret(conn.adminPasswordEncrypted),
    rejectUnauthorized: conn.rejectUnauthorized,
  };
}

export function encryptAdminPassword(plain: string): string {
  return encryptSecret(plain);
}
