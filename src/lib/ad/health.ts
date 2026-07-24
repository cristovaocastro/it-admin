import "server-only";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { searchAdUsers } from "@/lib/ad/users";
import { searchAdComputers } from "@/lib/ad/computers";

export type AdHealthStats = {
  totalUsers: number;
  lockedUsers: number;
  disabledUsers: number;
  expiredPasswordUsers: number;
  expiredAccountUsers: number; // accountExpires no passado, conta ainda habilitada
  inactiveUsers90: number; // sem logon (ou nunca logaram) há mais de INACTIVE_USER_DAYS dias
  neverExpiresUsers: number;
  totalComputers: number;
  disabledComputers: number;
  staleComputers: number; // sem logon há mais de STALE_COMPUTER_DAYS dias
  /** Nomes das conexões que falharam ao consultar (o widget ainda mostra o resto). */
  connectionErrors: string[];
};

const STALE_COMPUTER_DAYS = 90;
const INACTIVE_USER_DAYS = 90;
// Teto alto o bastante para cobrir o diretório inteiro (a busca já pagina, então não trunca em 1000).
const HEALTH_SCAN_LIMIT = 20000;

/** Agrega indicadores de saúde do AD (contas bloqueadas/expiradas, computadores obsoletos) para o dashboard. */
export async function getAdHealthStats(
  connections: { id: string; name: string }[]
): Promise<AdHealthStats> {
  const stats: AdHealthStats = {
    totalUsers: 0,
    lockedUsers: 0,
    disabledUsers: 0,
    expiredPasswordUsers: 0,
    expiredAccountUsers: 0,
    inactiveUsers90: 0,
    neverExpiresUsers: 0,
    totalComputers: 0,
    disabledComputers: 0,
    staleComputers: 0,
    connectionErrors: [],
  };

  const now = Date.now();
  const staleThreshold = now - STALE_COMPUTER_DAYS * 24 * 60 * 60 * 1000;
  const inactiveThreshold = now - INACTIVE_USER_DAYS * 24 * 60 * 60 * 1000;

  for (const conn of connections) {
    try {
      const config = await loadAdConnectionConfig(conn.id);
      const [users, computers] = await Promise.all([
        searchAdUsers(config, { limit: HEALTH_SCAN_LIMIT }),
        searchAdComputers(config, { limit: HEALTH_SCAN_LIMIT }),
      ]);

      stats.totalUsers += users.length;
      for (const u of users) {
        if (u.locked) stats.lockedUsers++;
        if (!u.enabled) stats.disabledUsers++;
        if (u.passwordExpired) stats.expiredPasswordUsers++;
        if (u.passwordNeverExpires) stats.neverExpiresUsers++;
        if (u.enabled && u.accountExpires && new Date(u.accountExpires).getTime() < now) stats.expiredAccountUsers++;
        if (u.enabled) {
          const lastLogonMs = u.lastLogon ? new Date(u.lastLogon).getTime() : null;
          if (lastLogonMs === null || lastLogonMs < inactiveThreshold) stats.inactiveUsers90++;
        }
      }

      stats.totalComputers += computers.length;
      for (const c of computers) {
        if (!c.enabled) stats.disabledComputers++;
        const lastLogonMs = c.lastLogon ? new Date(c.lastLogon).getTime() : null;
        if (lastLogonMs === null || lastLogonMs < staleThreshold) stats.staleComputers++;
      }
    } catch {
      stats.connectionErrors.push(conn.name);
    }
  }

  return stats;
}
