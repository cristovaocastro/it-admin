import "server-only";
import * as ldap from "ldapjs";
import { withAdClient, ldapSearch, ldapAdd, ldapModify, ldapDel, ldapModifyDN } from "@/lib/ad/client";
import type { AdConnectionConfig, AdGroupDetail, AdGroupSummary } from "@/lib/ad/types";
import { AdOperationError } from "@/lib/ad/types";
import { escapeDnValue, escapeFilterValue, rdnOf } from "@/lib/ad/util";

const GROUP_ATTRIBUTES = ["distinguishedName", "cn", "description", "member"];

function toGroupSummary(entry: Record<string, unknown>): AdGroupSummary {
  const members = entry.member ? (Array.isArray(entry.member) ? entry.member : [entry.member]) : [];
  return {
    dn: String(entry.dn ?? entry.distinguishedName ?? ""),
    name: String(entry.cn ?? ""),
    description: entry.description ? String(entry.description) : undefined,
    memberCount: members.length,
  };
}

export type SearchGroupsParams = { query?: string; ou?: string; limit?: number; scope?: "sub" | "one" };

export async function searchAdGroups(config: AdConnectionConfig, params: SearchGroupsParams = {}) {
  const base = params.ou || config.groupsOU || config.baseDN;
  const limit = params.limit ?? 200;
  let filter = "(objectClass=group)";
  if (params.query?.trim()) {
    const q = escapeFilterValue(params.query.trim());
    filter = `(&(objectClass=group)(|(cn=*${q}*)(description=*${q}*)))`;
  }

  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, base, {
      scope: params.scope ?? "sub",
      filter,
      attributes: GROUP_ATTRIBUTES,
      sizeLimit: limit,
    });
    return entries.map(toGroupSummary).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function getAdGroup(config: AdConnectionConfig, dn: string): Promise<AdGroupDetail> {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, dn, {
      scope: "base",
      filter: "(objectClass=group)",
      attributes: GROUP_ATTRIBUTES,
    });
    if (entries.length === 0) throw new AdOperationError("Grupo não encontrado no AD.");
    const summary = toGroupSummary(entries[0]);
    const raw = entries[0].member;
    const members = raw ? (Array.isArray(raw) ? raw : [raw]).map(String) : [];
    return { ...summary, members };
  });
}

export type CreateAdGroupParams = {
  name: string;
  description?: string;
  ou?: string;
  scope?: "DomainLocal" | "Global" | "Universal";
  security?: boolean; // true = security group, false = distribution group
};

// groupType: soma de escopo + tipo. Referência Microsoft.
const GROUP_TYPE = {
  Global: 0x00000002,
  DomainLocal: 0x00000004,
  Universal: 0x00000008,
  SECURITY: -2147483648, // 0x80000000 (assinado)
} as const;

export async function createAdGroup(config: AdConnectionConfig, params: CreateAdGroupParams) {
  const ou = params.ou || config.groupsOU || config.baseDN;
  const dn = `CN=${escapeDnValue(params.name)},${ou}`;
  const scopeBit = GROUP_TYPE[params.scope ?? "Global"];
  const isSecurity = params.security ?? true;
  const groupType = isSecurity ? scopeBit | GROUP_TYPE.SECURITY : scopeBit;

  return withAdClient(config, async (client) => {
    const entry: Record<string, unknown> = {
      objectClass: ["top", "group"],
      cn: params.name,
      sAMAccountName: params.name,
      groupType: String(groupType),
    };
    if (params.description) entry.description = params.description;
    await ldapAdd(client, dn, entry);
    return dn;
  });
}

export async function addAdGroupMember(config: AdConnectionConfig, groupDn: string, memberDn: string) {
  return withAdClient(config, async (client) => {
    await ldapModify(
      client,
      groupDn,
      new ldap.Change({
        operation: "add",
        modification: { type: "member", values: [memberDn] },
      })
    );
  });
}

export async function removeAdGroupMember(config: AdConnectionConfig, groupDn: string, memberDn: string) {
  return withAdClient(config, async (client) => {
    await ldapModify(
      client,
      groupDn,
      new ldap.Change({
        operation: "delete",
        modification: { type: "member", values: [memberDn] },
      })
    );
  });
}

export async function deleteAdGroup(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    await ldapDel(client, dn);
  });
}

export async function moveAdGroup(config: AdConnectionConfig, dn: string, newOuDn: string) {
  return withAdClient(config, async (client) => {
    await ldapModifyDN(client, dn, `${rdnOf(dn)},${newOuDn}`);
  });
}
