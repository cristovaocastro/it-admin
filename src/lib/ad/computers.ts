import "server-only";
import * as ldap from "ldapjs";
import { withAdClient, ldapSearch, ldapModify, ldapDel, ldapModifyDN } from "@/lib/ad/client";
import type { AdComputerSummary, AdConnectionConfig } from "@/lib/ad/types";
import { AdOperationError } from "@/lib/ad/types";
import { UAC, isUacEnabled, toggleDisabledBit, escapeFilterValue, rdnOf, parseWindowsFileTime } from "@/lib/ad/util";

const COMPUTER_ATTRIBUTES = [
  "distinguishedName",
  "sAMAccountName",
  "dNSHostName",
  "operatingSystem",
  "operatingSystemVersion",
  "description",
  "userAccountControl",
  "whenCreated",
  "lastLogonTimestamp",
  "memberOf",
];

function toComputerSummary(entry: Record<string, unknown>): AdComputerSummary {
  const uac = Number(entry.userAccountControl ?? 0);
  const memberOf = entry.memberOf ? (Array.isArray(entry.memberOf) ? entry.memberOf : [entry.memberOf]) : [];
  const sam = String(entry.sAMAccountName ?? "");
  return {
    dn: String(entry.dn ?? entry.distinguishedName ?? ""),
    name: sam.endsWith("$") ? sam.slice(0, -1) : sam,
    dnsHostName: entry.dNSHostName ? String(entry.dNSHostName) : undefined,
    operatingSystem: entry.operatingSystem ? String(entry.operatingSystem) : undefined,
    operatingSystemVersion: entry.operatingSystemVersion ? String(entry.operatingSystemVersion) : undefined,
    description: entry.description ? String(entry.description) : undefined,
    enabled: isUacEnabled(uac),
    whenCreated: entry.whenCreated ? String(entry.whenCreated) : undefined,
    lastLogon: parseWindowsFileTime(entry.lastLogonTimestamp as string | undefined)?.toISOString(),
    memberOf: memberOf.map(String),
  } satisfies AdComputerSummary;
}

export type SearchComputersParams = { query?: string; ou?: string; limit?: number; scope?: "sub" | "one" };

export async function searchAdComputers(config: AdConnectionConfig, params: SearchComputersParams = {}) {
  const base = params.ou || config.computersOU || config.baseDN;
  const limit = params.limit ?? 200;
  let filter = "(objectCategory=computer)";
  if (params.query?.trim()) {
    const q = escapeFilterValue(params.query.trim());
    filter = `(&(objectCategory=computer)(|(cn=*${q}*)(dNSHostName=*${q}*)(operatingSystem=*${q}*)))`;
  }

  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, base, {
      scope: params.scope ?? "sub",
      filter,
      attributes: COMPUTER_ATTRIBUTES,
      sizeLimit: limit,
    });
    return entries.map(toComputerSummary).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function getAdComputer(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, dn, {
      scope: "base",
      filter: "(objectClass=computer)",
      attributes: COMPUTER_ATTRIBUTES,
    });
    if (entries.length === 0) throw new AdOperationError("Computador não encontrado no AD.");
    return toComputerSummary(entries[0]);
  });
}

export async function setAdComputerEnabled(config: AdConnectionConfig, dn: string, enabled: boolean) {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, dn, {
      scope: "base",
      filter: "(objectClass=computer)",
      attributes: ["userAccountControl"],
    });
    if (entries.length === 0) throw new AdOperationError("Computador não encontrado no AD.");
    const currentUac = Number(entries[0].userAccountControl ?? UAC.NORMAL_ACCOUNT);
    const newUac = toggleDisabledBit(currentUac, !enabled);
    await ldapModify(
      client,
      dn,
      new ldap.Change({
        operation: "replace",
        modification: { type: "userAccountControl", values: [String(newUac)] },
      })
    );
  });
}

export async function updateAdComputerDescription(config: AdConnectionConfig, dn: string, description: string) {
  return withAdClient(config, async (client) => {
    await ldapModify(
      client,
      dn,
      new ldap.Change({
        operation: description ? "replace" : "delete",
        modification: { type: "description", values: description ? [description] : [] },
      })
    );
  });
}

export async function moveAdComputer(config: AdConnectionConfig, dn: string, newOuDn: string) {
  return withAdClient(config, async (client) => {
    await ldapModifyDN(client, dn, `${rdnOf(dn)},${newOuDn}`);
  });
}

export async function deleteAdComputer(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    await ldapDel(client, dn);
  });
}
