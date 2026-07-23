import "server-only";
import { withAdClient, ldapSearch } from "@/lib/ad/client";
import type { AdConnectionConfig } from "@/lib/ad/types";

export type AdContainerNode = { dn: string; name: string; kind: "OU" | "CONTAINER" };

/**
 * Lista os "nós de pasta" (OUs e containers nativos como CN=Users, CN=Computers) diretamente
 * abaixo de um DN — usado para montar a árvore de navegação estilo ADUC, um nível por vez.
 */
export async function listChildContainers(
  config: AdConnectionConfig,
  parentDn: string
): Promise<AdContainerNode[]> {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, parentDn, {
      scope: "one",
      filter: "(|(objectClass=organizationalUnit)(objectClass=container))",
      attributes: ["distinguishedName", "ou", "cn", "objectClass"],
      sizeLimit: 1000,
      paged: true,
    });
    return entries
      .map((e) => {
        const raw = e.objectClass;
        const classes = Array.isArray(raw) ? raw.map(String) : [String(raw ?? "")];
        const kind: "OU" | "CONTAINER" = classes.includes("organizationalUnit") ? "OU" : "CONTAINER";
        return {
          dn: String(e.dn ?? e.distinguishedName ?? ""),
          name: String(e.ou ?? e.cn ?? ""),
          kind,
        };
      })
      .filter((n) => n.dn)
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}
