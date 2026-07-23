"use server";

import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { listChildContainers, type AdContainerNode } from "@/lib/ad/tree";
import { searchAdUsers } from "@/lib/ad/users";
import { searchAdGroups } from "@/lib/ad/groups";
import { searchAdComputers } from "@/lib/ad/computers";
import { AdOperationError } from "@/lib/ad/types";
import type { AdUserSummary, AdGroupSummary, AdComputerSummary } from "@/lib/ad/types";

export type OuChildrenResult = { error?: string; containers?: AdContainerNode[] };

/** Busca os "filhos de pasta" (OUs/containers) de um nó — usado para expandir a árvore. */
export async function getOuChildrenAction(connectionId: string, ouDn: string): Promise<OuChildrenResult> {
  await requireRole(["ADMIN", "OPERATOR"]);
  try {
    const config = await loadAdConnectionConfig(connectionId);
    const containers = await listChildContainers(config, ouDn);
    return { containers };
  } catch (err) {
    return { error: err instanceof AdOperationError ? err.message : "Falha ao consultar o AD." };
  }
}

export type OuContentsResult = {
  error?: string;
  containers?: AdContainerNode[];
  users?: AdUserSummary[];
  groups?: AdGroupSummary[];
  computers?: AdComputerSummary[];
};

/** Busca o conteúdo (usuários, grupos, computadores, subpastas) de um nó — usado no painel da direita. */
export async function getOuContentsAction(connectionId: string, ouDn: string): Promise<OuContentsResult> {
  await requireRole(["ADMIN", "OPERATOR"]);
  try {
    const config = await loadAdConnectionConfig(connectionId);
    const [containers, users, groups, computers] = await Promise.all([
      listChildContainers(config, ouDn),
      searchAdUsers(config, { ou: ouDn, scope: "one", limit: 500 }),
      searchAdGroups(config, { ou: ouDn, scope: "one", limit: 500 }),
      searchAdComputers(config, { ou: ouDn, scope: "one", limit: 500 }),
    ]);
    return { containers, users, groups, computers };
  } catch (err) {
    return { error: err instanceof AdOperationError ? err.message : "Falha ao consultar o AD." };
  }
}
