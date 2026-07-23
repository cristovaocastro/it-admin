// Tipos compartilhados do módulo de Firewall.
// Hoje só há suporte a SonicWall via SonicOS API. Nada de regra/URI list é replicado
// para o banco local: tudo é consultado ao vivo — o banco só guarda o cadastro das conexões.

export type FirewallConnectionConfig = {
  id?: string;
  name?: string;
  host: string;
  port: number;
  adminUsername: string;
  adminPassword: string; // já descriptografada, só deve existir em memória durante a operação
  rejectUnauthorized: boolean;
};

export type FirewallTestResult = {
  success: boolean;
  latencyMs: number;
  error?: string;
};

export class FirewallOperationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "FirewallOperationError";
  }
}
