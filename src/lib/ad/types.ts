// Tipos compartilhados do módulo de Active Directory.
// Não guardamos usuários/grupos do AD localmente: tudo é consultado ao vivo via LDAP.
// O banco local só guarda o cadastro da(s) conexão(ões) (AdConnection).

export type AdEncryptionMode = "NONE" | "STARTTLS" | "LDAPS";

export type AdConnectionConfig = {
  id?: string;
  name?: string;
  host: string;
  port: number;
  baseDN: string;
  bindDN: string;
  bindPassword: string; // já descriptografada, só deve existir em memória durante a operação
  encryption: AdEncryptionMode;
  rejectUnauthorized: boolean;
  usersOU?: string | null;
  groupsOU?: string | null;
  computersOU?: string | null;
};

export type AdTestResult = {
  success: boolean;
  latencyMs: number;
  error?: string;
};

export type AdUserSummary = {
  dn: string;
  sAMAccountName: string;
  userPrincipalName?: string;
  displayName?: string;
  givenName?: string;
  sn?: string;
  mail?: string;
  telephoneNumber?: string;
  department?: string;
  title?: string;
  description?: string;
  enabled: boolean;
  locked: boolean;
  passwordExpired: boolean;
  whenCreated?: string;
  lastLogon?: string;
  memberOf: string[];
};

export type AdGroupSummary = {
  dn: string;
  name: string;
  description?: string;
  memberCount: number;
};

export type AdGroupDetail = AdGroupSummary & {
  members: string[]; // DNs
};

export type AdComputerSummary = {
  dn: string;
  name: string; // sAMAccountName sem o "$" final
  dnsHostName?: string;
  operatingSystem?: string;
  operatingSystemVersion?: string;
  description?: string;
  enabled: boolean;
  whenCreated?: string;
  lastLogon?: string;
  memberOf: string[];
};

export class AdOperationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AdOperationError";
  }
}
