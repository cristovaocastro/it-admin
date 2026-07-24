import { randomInt } from "node:crypto";

// Bits do atributo userAccountControl relevantes para este painel.
// Referência: https://learn.microsoft.com/pt-br/troubleshoot/windows-server/identity/useraccountcontrol-manipulate-account-properties
export const UAC = {
  ACCOUNTDISABLE: 0x0002,
  LOCKOUT: 0x0010,
  NORMAL_ACCOUNT: 0x0200,
  DONT_EXPIRE_PASSWORD: 0x10000,
} as const;

export function isUacEnabled(uac: number): boolean {
  return (uac & UAC.ACCOUNTDISABLE) === 0;
}

export function toggleDisabledBit(uac: number, disable: boolean): number {
  return disable ? uac | UAC.ACCOUNTDISABLE : uac & ~UAC.ACCOUNTDISABLE;
}

/** Escapa um valor para uso seguro em um RDN (ex: "CN=valor,OU=..."), conforme RFC 4514. */
export function escapeDnValue(value: string): string {
  let result = value.replace(/[,+"\\<>;\r\n=]/g, (c) => `\\${c}`);
  if (result.startsWith(" ") || result.startsWith("#")) result = `\\${result}`;
  if (result.endsWith(" ")) result = `${result.slice(0, -1)}\\ `;
  return result;
}

/** Escapa um valor para uso seguro em um filtro LDAP, conforme RFC 4515. */
export function escapeFilterValue(value: string): string {
  return value.replace(/[\\*() ]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

/**
 * O ldapjs devolve DNs com caracteres não-ASCII (acentos etc.) escapados byte a byte
 * (ex: "ção" vira "\c3\a7\c3\a3"), em vez do caractere UTF-8 literal. Isso é uma
 * representação tecnicamente válida pela RFC 4514, mas causa erro no Active Directory ao
 * ser reenviada em requisições subsequentes (busca por base DN, modifyDN/mover). Esta função
 * decodifica de volta essas sequências de escape para o caractere UTF-8 real, sem tocar em
 * escapes de caracteres estruturais (vírgula, mais, etc., sempre < 0x80).
 */
export function normalizeDn(dn: string): string {
  return dn.replace(/(?:\\[0-9a-fA-F]{2})+/g, (match) => {
    const bytes = (match.match(/[0-9a-fA-F]{2}/g) ?? []).map((h) => parseInt(h, 16));
    if (bytes.some((b) => b < 0x80)) return match; // escape de caractere estrutural: mantém como está
    return Buffer.from(bytes).toString("utf8");
  });
}

/** Codifica uma senha no formato exigido pelo atributo unicodePwd do Active Directory. */
export function encodeAdPassword(password: string): Buffer {
  return Buffer.from(`"${password}"`, "utf16le");
}

/** Extrai o RDN (primeiro componente) de um DN, ex: "CN=foo" de "CN=foo,OU=bar,DC=x". */
export function rdnOf(dn: string): string {
  return dn.split(",")[0];
}

/** Extrai o DN pai (tudo após o primeiro componente), ex: "OU=bar,DC=x" de "CN=foo,OU=bar,DC=x". */
export function parentOf(dn: string): string {
  return dn.split(",").slice(1).join(",");
}

/** Converte um valor de data no formato AD generalized time (whenCreated etc.) para Date. */
export function parseAdGeneralizedTime(value?: string): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
}

// lastLogonTimestamp / lockoutTime vêm como intervalos Windows FILETIME (100ns desde 1601-01-01).
const WINDOWS_EPOCH_OFFSET_MS = 11644473600000;

export function parseWindowsFileTime(value?: string): Date | undefined {
  if (!value || value === "0") return undefined;
  const ticks = BigInt(value);
  const ms = Number(ticks / BigInt(10000)) - WINDOWS_EPOCH_OFFSET_MS;
  return new Date(ms);
}

// accountExpires usa "0" (nunca definido) OU o valor máximo de int64 como sentinelas de "nunca expira"
// — o AD/ADUC grava o valor máximo quando o admin escolhe "Never" na tela de expiração de conta.
const ACCOUNT_NEVER_EXPIRES = "9223372036854775807";

export function parseAccountExpires(value?: string): Date | undefined {
  if (!value || value === "0" || value === ACCOUNT_NEVER_EXPIRES) return undefined;
  return parseWindowsFileTime(value);
}

/** Codifica uma data de expiração de conta no formato FILETIME do AD; `null` grava o sentinela "nunca expira". */
export function encodeAccountExpires(date: Date | null): string {
  if (!date) return ACCOUNT_NEVER_EXPIRES;
  return encodeWindowsFileTime(date);
}

/** Codifica um Date no formato FILETIME do AD (100ns desde 1601-01-01) — usado em filtros LDAP sobre atributos como lastLogonTimestamp. */
export function encodeWindowsFileTime(date: Date): string {
  const ticks = (BigInt(date.getTime()) + BigInt(WINDOWS_EPOCH_OFFSET_MS)) * BigInt(10000);
  return ticks.toString();
}

const PASSWORD_CHAR_SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ", // maiúsculas, sem I/O ambíguos
  "abcdefghijkmnpqrstuvwxyz", // minúsculas, sem l/o ambíguos
  "23456789", // dígitos, sem 0/1 ambíguos
  "!@#$%&*-_+=",
];

/** Gera uma senha aleatória forte (maiúscula, minúscula, dígito e símbolo garantidos), usando o CSPRNG do Node. */
export function generateRandomPassword(length = 14): string {
  const all = PASSWORD_CHAR_SETS.join("");
  const chars = PASSWORD_CHAR_SETS.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
