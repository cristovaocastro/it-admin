import "server-only";
import { withAdClient, ldapSearch, ldapAdd, ldapModifyDN, ldapDel } from "@/lib/ad/client";
import type { AdConnectionConfig } from "@/lib/ad/types";
import { escapeDnValue, rdnOf } from "@/lib/ad/util";

export type AdOrganizationalUnit = { dn: string; name: string };

/** Lista as unidades organizacionais (OUs) abaixo da Base DN da conexão, para uso em seletores. */
export async function listOrganizationalUnits(config: AdConnectionConfig): Promise<AdOrganizationalUnit[]> {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, config.baseDN, {
      scope: "sub",
      filter: "(objectClass=organizationalUnit)",
      attributes: ["distinguishedName", "ou"],
      sizeLimit: 500,
    });
    return entries
      .map((e) => ({
        dn: String(e.dn ?? e.distinguishedName ?? ""),
        name: String(e.ou ?? e.dn ?? ""),
      }))
      .filter((ou) => ou.dn)
      .sort((a, b) => a.dn.localeCompare(b.dn));
  });
}

export async function createOrganizationalUnit(
  config: AdConnectionConfig,
  parentDn: string,
  name: string,
  description?: string
) {
  const dn = `OU=${escapeDnValue(name)},${parentDn}`;
  return withAdClient(config, async (client) => {
    const entry: Record<string, unknown> = { objectClass: ["top", "organizationalUnit"], ou: name };
    if (description) entry.description = description;
    await ldapAdd(client, dn, entry);
    return dn;
  });
}

/** Renomeia uma OU (mantém o mesmo pai, só troca o RDN). */
export async function renameOrganizationalUnit(config: AdConnectionConfig, dn: string, newName: string) {
  return withAdClient(config, async (client) => {
    await ldapModifyDN(client, dn, `OU=${escapeDnValue(newName)}`);
  });
}

/** Move uma OU (ou qualquer objeto) para debaixo de outro pai, mantendo o RDN atual. */
export async function moveOrganizationalUnit(config: AdConnectionConfig, dn: string, newParentDn: string) {
  return withAdClient(config, async (client) => {
    await ldapModifyDN(client, dn, `${rdnOf(dn)},${newParentDn}`);
  });
}

export async function deleteOrganizationalUnit(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    await ldapDel(client, dn);
  });
}
