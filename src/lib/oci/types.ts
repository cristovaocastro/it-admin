// Tipos compartilhados do módulo OCI.
// Diferente da AWS (access key/secret por conta), a OCI autentica via API Signing Key
// (tenancy/user OCID + fingerprint + chave privada) e organiza recursos em compartments,
// não só por região — por isso a config carrega região(ões) E compartment(s) monitorados.

export type OciConnectionConfig = {
  id?: string;
  name?: string;
  tenancyId: string;
  userId: string;
  fingerprint: string;
  privateKey: string; // PEM, já descriptografada — só deve existir em memória durante a operação
  passphrase: string | null;
  defaultRegion: string;
  regions: string[];
  compartments: string[];
};

export type OciTestResult = {
  success: boolean;
  latencyMs: number;
  error?: string;
};

/**
 * O SDK da OCI declara campos de timestamp como `Date` no tipo, mas em runtime vários endpoints
 * (confirmado contra uma tenancy real) retornam a string ISO diretamente, sem instanciar `Date` —
 * normaliza os dois casos em vez de assumir `.toISOString()` sempre existe.
 */
export function toIsoString(value: Date | string | undefined | null): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.toISOString();
}

export class OciOperationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "OciOperationError";
  }
}
