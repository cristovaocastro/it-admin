import "server-only";
import * as ldap from "ldapjs";
import type { Client } from "ldapjs";
import { withAdClient, ldapSearch, ldapAdd, ldapModify, ldapDel, ldapModifyDN } from "@/lib/ad/client";
import type { AdConnectionConfig, AdGroupDetail, AdGroupScope, AdGroupSummary } from "@/lib/ad/types";
import { AdOperationError } from "@/lib/ad/types";
import { escapeDnValue, escapeFilterValue, parentOf, rdnOf } from "@/lib/ad/util";
import { isProtectedAdGroupName } from "@/lib/ad/protected-principals";

const GROUP_ATTRIBUTES = ["distinguishedName", "cn", "description", "member", "groupType"];

// groupType: soma de escopo + tipo. Referência Microsoft.
const GROUP_TYPE = {
  Global: 0x00000002,
  DomainLocal: 0x00000004,
  Universal: 0x00000008,
  SECURITY: -2147483648, // 0x80000000 (assinado)
} as const;

function scopeFromGroupType(groupType: number): AdGroupScope {
  if (groupType & GROUP_TYPE.DomainLocal) return "DomainLocal";
  if (groupType & GROUP_TYPE.Universal) return "Universal";
  return "Global";
}

function toGroupSummary(entry: Record<string, unknown>): AdGroupSummary {
  const members = entry.member ? (Array.isArray(entry.member) ? entry.member : [entry.member]) : [];
  const groupType = Number(entry.groupType ?? GROUP_TYPE.Global);
  return {
    dn: String(entry.dn ?? entry.distinguishedName ?? ""),
    name: String(entry.cn ?? ""),
    description: entry.description ? String(entry.description) : undefined,
    memberCount: members.length,
    scope: scopeFromGroupType(groupType),
    security: (groupType & GROUP_TYPE.SECURITY) !== 0,
  };
}

/**
 * Bloqueia qualquer alteração num grupo administrativo protegido do AD (renomear, descrição,
 * mover, excluir, e — o mais importante — adicionar/remover membro, que é como alguém se
 * autopromoveria a admin de domínio por aqui). Consulta o `cn` real do DN em vez de confiar em
 * valor vindo do formulário/UI.
 */
async function assertGroupIsMutable(client: Client, dn: string): Promise<void> {
  const entries = await ldapSearch(client, dn, {
    scope: "base",
    filter: "(objectClass=group)",
    attributes: ["cn"],
  });
  const name = entries[0]?.cn ? String(entries[0].cn) : undefined;
  if (isProtectedAdGroupName(name)) {
    throw new AdOperationError(
      `"${name}" é um grupo administrativo protegido do AD e não pode ser alterado por este painel (nem seus membros).`
    );
  }
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
      paged: true, // AD limita buscas não paginadas a 1000 resultados por padrão
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
  scope?: AdGroupScope;
  security?: boolean; // true = security group, false = distribution group
};

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
    await assertGroupIsMutable(client, groupDn);
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
    await assertGroupIsMutable(client, groupDn);
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

export type UpdateAdGroupParams = { name?: string; description?: string };

/** Renomeia (CN + sAMAccountName) e/ou atualiza a descrição de um grupo. Retorna o DN atual (novo, se houve rename). */
export async function updateAdGroup(config: AdConnectionConfig, dn: string, params: UpdateAdGroupParams) {
  return withAdClient(config, async (client) => {
    await assertGroupIsMutable(client, dn);
    let currentDn = dn;
    if (params.name) {
      const newRdn = `CN=${escapeDnValue(params.name)}`;
      if (newRdn !== rdnOf(dn)) {
        await ldapModifyDN(client, dn, newRdn);
        currentDn = `${newRdn},${parentOf(dn)}`;
      }
      // sAMAccountName não acompanha o CN automaticamente no rename via modifyDN.
      await ldapModify(
        client,
        currentDn,
        new ldap.Change({ operation: "replace", modification: { type: "sAMAccountName", values: [params.name] } })
      );
    }
    if (params.description !== undefined) {
      await ldapModify(
        client,
        currentDn,
        new ldap.Change({
          operation: params.description ? "replace" : "delete",
          modification: { type: "description", values: params.description ? [params.description] : [] },
        })
      );
    }
    return currentDn;
  });
}

export async function deleteAdGroup(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    await assertGroupIsMutable(client, dn);
    await ldapDel(client, dn);
  });
}

export async function moveAdGroup(config: AdConnectionConfig, dn: string, newOuDn: string) {
  return withAdClient(config, async (client) => {
    await assertGroupIsMutable(client, dn);
    await ldapModifyDN(client, dn, `${rdnOf(dn)},${newOuDn}`);
  });
}
