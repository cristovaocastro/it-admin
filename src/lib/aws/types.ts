// Tipos compartilhados do módulo AWS.
// Um único conjunto de credenciais (Access Key/Secret Key) por conexão, com uma lista de
// regiões monitoradas — os clientes SDK são construídos sob demanda por região em client.ts.

export type AwsConnectionConfig = {
  id?: string;
  name?: string;
  accessKeyId: string;
  secretAccessKey: string; // já descriptografada, só deve existir em memória durante a operação
  defaultRegion: string; // usado por serviços globais (STS, Cost Explorer)
  regions: string[]; // regiões monitoradas para EC2/VPC/VPN/Endpoints/Backup
};

export type AwsTestResult = {
  success: boolean;
  latencyMs: number;
  error?: string;
  accountId?: string;
};

export class AwsOperationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AwsOperationError";
  }
}
