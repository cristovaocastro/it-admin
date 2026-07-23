import "server-only";
import * as ldap from "ldapjs";
import { withAdClient, ldapSearch, ldapAdd, ldapModify, ldapDel, ldapModifyDN } from "@/lib/ad/client";
import type { AdConnectionConfig, AdUserSummary } from "@/lib/ad/types";
import { AdOperationError } from "@/lib/ad/types";
import {
  UAC,
  isUacEnabled,
  toggleDisabledBit,
  escapeDnValue,
  escapeFilterValue,
  encodeAdPassword,
  rdnOf,
  parseWindowsFileTime,
} from "@/lib/ad/util";

const USER_ATTRIBUTES = [
  "distinguishedName",
  "sAMAccountName",
  "userPrincipalName",
  "displayName",
  "givenName",
  "sn",
  "mail",
  "userAccountControl",
  "lockoutTime",
  "pwdLastSet",
  "whenCreated",
  "lastLogonTimestamp",
  "memberOf",
  "telephoneNumber",
  "department",
  "title",
  "description",
];

function toUserSummary(entry: Record<string, unknown>): AdUserSummary {
  const uac = Number(entry.userAccountControl ?? 0);
  const lockoutTime = String(entry.lockoutTime ?? "0");
  const memberOf = entry.memberOf ? (Array.isArray(entry.memberOf) ? entry.memberOf : [entry.memberOf]) : [];
  return {
    dn: String(entry.dn ?? entry.distinguishedName ?? ""),
    sAMAccountName: String(entry.sAMAccountName ?? ""),
    userPrincipalName: entry.userPrincipalName ? String(entry.userPrincipalName) : undefined,
    displayName: entry.displayName ? String(entry.displayName) : undefined,
    givenName: entry.givenName ? String(entry.givenName) : undefined,
    sn: entry.sn ? String(entry.sn) : undefined,
    mail: entry.mail ? String(entry.mail) : undefined,
    telephoneNumber: entry.telephoneNumber ? String(entry.telephoneNumber) : undefined,
    department: entry.department ? String(entry.department) : undefined,
    title: entry.title ? String(entry.title) : undefined,
    description: entry.description ? String(entry.description) : undefined,
    enabled: isUacEnabled(uac),
    locked: lockoutTime !== "0",
    passwordExpired: entry.pwdLastSet === "0",
    whenCreated: entry.whenCreated ? String(entry.whenCreated) : undefined,
    lastLogon: parseWindowsFileTime(entry.lastLogonTimestamp as string | undefined)?.toISOString(),
    memberOf: memberOf.map(String),
  } satisfies AdUserSummary;
}

export type SearchUsersParams = {
  query?: string;
  ou?: string;
  limit?: number;
  /** "one" busca só os filhos diretos da OU (usado na árvore); "sub" (padrão) busca recursivamente. */
  scope?: "sub" | "one";
};

export async function searchAdUsers(config: AdConnectionConfig, params: SearchUsersParams = {}) {
  const base = params.ou || config.usersOU || config.baseDN;
  const limit = params.limit ?? 200;
  let filter = "(&(objectCategory=person)(objectClass=user))";
  if (params.query?.trim()) {
    const q = escapeFilterValue(params.query.trim());
    filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=*${q}*)(cn=*${q}*)(displayName=*${q}*)(mail=*${q}*)))`;
  }

  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, base, {
      scope: params.scope ?? "sub",
      filter,
      attributes: USER_ATTRIBUTES,
      sizeLimit: limit,
    });
    return entries.map(toUserSummary).sort((a, b) => a.sAMAccountName.localeCompare(b.sAMAccountName));
  });
}

export async function getAdUser(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, dn, {
      scope: "base",
      filter: "(objectClass=user)",
      attributes: USER_ATTRIBUTES,
    });
    if (entries.length === 0) throw new AdOperationError("Usuário não encontrado no AD.");
    return toUserSummary(entries[0]);
  });
}

export type CreateAdUserParams = {
  sAMAccountName: string;
  userPrincipalName: string;
  givenName: string;
  sn: string;
  displayName?: string;
  mail?: string;
  ou?: string;
  password: string;
  mustChangePasswordAtLogon: boolean;
  enabled: boolean;
};

export async function createAdUser(config: AdConnectionConfig, params: CreateAdUserParams) {
  if (config.encryption === "NONE") {
    throw new AdOperationError(
      "Criar usuários exige definir a senha inicial, o que só é permitido em conexões com STARTTLS ou LDAPS."
    );
  }

  const ou = params.ou || config.usersOU || config.baseDN;
  const displayName = params.displayName || `${params.givenName} ${params.sn}`.trim();
  const cn = displayName || params.sAMAccountName;
  const dn = `CN=${escapeDnValue(cn)},${ou}`;

  return withAdClient(config, async (client) => {
    const entry: Record<string, unknown> = {
      objectClass: ["top", "person", "organizationalPerson", "user"],
      cn,
      sAMAccountName: params.sAMAccountName,
      userPrincipalName: params.userPrincipalName,
      givenName: params.givenName,
      sn: params.sn,
      displayName,
    };
    if (params.mail) entry.mail = params.mail;

    await ldapAdd(client, dn, entry);

    // Senha só pode ser definida via modify (unicodePwd), sempre em conexão criptografada.
    await ldapModify(
      client,
      dn,
      new ldap.Change({
        operation: "replace",
        modification: { type: "unicodePwd", values: [encodeAdPassword(params.password)] },
      })
    );

    const uac = params.enabled ? UAC.NORMAL_ACCOUNT : UAC.NORMAL_ACCOUNT | UAC.ACCOUNTDISABLE;
    const changes: ldap.Change[] = [
      new ldap.Change({
        operation: "replace",
        modification: { type: "userAccountControl", values: [String(uac)] },
      }),
    ];
    if (params.mustChangePasswordAtLogon) {
      changes.push(
        new ldap.Change({
          operation: "replace",
          modification: { type: "pwdLastSet", values: ["0"] },
        })
      );
    }
    await ldapModify(client, dn, changes);

    return dn;
  });
}

export async function setAdUserPassword(
  config: AdConnectionConfig,
  dn: string,
  newPassword: string,
  forceChangeAtNextLogon: boolean
) {
  if (config.encryption === "NONE") {
    throw new AdOperationError(
      "Alterar/resetar senha exige conexão criptografada (STARTTLS ou LDAPS). Atualize a conexão AD."
    );
  }
  return withAdClient(config, async (client) => {
    const changes: ldap.Change[] = [
      new ldap.Change({
        operation: "replace",
        modification: { type: "unicodePwd", values: [encodeAdPassword(newPassword)] },
      }),
    ];
    changes.push(
      new ldap.Change({
        operation: "replace",
        modification: { type: "pwdLastSet", values: [forceChangeAtNextLogon ? "0" : "-1"] },
      })
    );
    await ldapModify(client, dn, changes);
  });
}

export async function setAdUserEnabled(config: AdConnectionConfig, dn: string, enabled: boolean) {
  return withAdClient(config, async (client) => {
    const entries = await ldapSearch(client, dn, {
      scope: "base",
      filter: "(objectClass=user)",
      attributes: ["userAccountControl"],
    });
    if (entries.length === 0) throw new AdOperationError("Usuário não encontrado no AD.");
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

export async function unlockAdUser(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    await ldapModify(
      client,
      dn,
      new ldap.Change({
        operation: "replace",
        modification: { type: "lockoutTime", values: ["0"] },
      })
    );
  });
}

export type UpdateAdUserParams = Partial<{
  displayName: string;
  givenName: string;
  sn: string;
  mail: string;
  telephoneNumber: string;
  department: string;
  title: string;
  description: string;
}>;

export async function updateAdUser(config: AdConnectionConfig, dn: string, params: UpdateAdUserParams) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  return withAdClient(config, async (client) => {
    const changes = entries.map(
      ([type, value]) =>
        new ldap.Change({
          operation: value ? "replace" : "delete",
          modification: { type, values: value ? [String(value)] : [] },
        })
    );
    await ldapModify(client, dn, changes);
  });
}

export async function moveAdUser(config: AdConnectionConfig, dn: string, newOuDn: string) {
  return withAdClient(config, async (client) => {
    await ldapModifyDN(client, dn, `${rdnOf(dn)},${newOuDn}`);
  });
}

export async function deleteAdUser(config: AdConnectionConfig, dn: string) {
  return withAdClient(config, async (client) => {
    await ldapDel(client, dn);
  });
}
