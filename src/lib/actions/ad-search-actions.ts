"use server";

import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { searchAdUsers } from "@/lib/ad/users";
import { AdOperationError } from "@/lib/ad/types";

/** Busca rápida de usuários AD para uso em seletores (ex: adicionar membro a um grupo). */
export async function searchAdUsersForPickerAction(connectionId: string, query: string) {
  await requireRole(["ADMIN", "OPERATOR"]);
  if (!query || query.trim().length < 2) return { users: [] as { dn: string; label: string }[] };
  try {
    const config = await loadAdConnectionConfig(connectionId);
    const users = await searchAdUsers(config, { query, limit: 15 });
    return { users: users.map((u) => ({ dn: u.dn, label: `${u.displayName || u.sAMAccountName} (${u.sAMAccountName})` })) };
  } catch (err) {
    return { error: err instanceof AdOperationError ? err.message : "Falha ao buscar usuários." };
  }
}
