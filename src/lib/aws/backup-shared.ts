// Tipos e helpers puramente de apresentação do módulo AWS Backup, sem dependência do SDK da AWS
// nem de "server-only" — importável tanto por Server Components quanto por Client Components
// (ex.: o filtro/tabela interativo de jobs em backup-jobs-explorer.tsx).

export type AwsBackupJob = {
  jobId: string;
  state: string; // CREATED | PENDING | RUNNING | ABORTING | ABORTED | COMPLETED | FAILED | EXPIRED | PARTIAL
  resourceType?: string;
  resourceArn?: string;
  resourceName?: string;
  vaultName?: string;
  backupPlanId?: string;
  backupPlanName?: string;
  creationDate?: string;
  completionDate?: string;
  statusMessage?: string;
  region: string;
};

export type AwsBackupVault = { name: string; recoveryPoints: number; region: string };
export type AwsBackupPlan = { id: string; name: string; region: string };

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  EC2: "Instância EC2",
  EBS: "Volume EBS",
  S3: "Bucket S3",
  RDS: "Banco de dados RDS",
  Aurora: "Cluster Aurora",
  DynamoDB: "Tabela DynamoDB",
  EFS: "Sistema de arquivos EFS",
  FSx: "Sistema de arquivos FSx",
  DocDB: "Cluster DocumentDB",
  Neptune: "Cluster Neptune",
  Redshift: "Cluster Redshift",
  "Redshift Serverless": "Redshift Serverless",
  StorageGateway: "Storage Gateway",
  VirtualMachine: "Máquina virtual (VMware)",
  Timestream: "Banco Timestream",
  CloudFormation: "Stack CloudFormation",
  "SAP HANA on Amazon EC2": "SAP HANA (EC2)",
};

/** Traduz o código de tipo de recurso da AWS Backup para um rótulo amigável em pt-BR. */
export function resourceTypeLabel(type?: string): string {
  if (!type) return "Desconhecido";
  return RESOURCE_TYPE_LABELS[type] ?? type;
}

/**
 * Nome visual do recurso protegido. A AWS já retorna `ResourceName` (Name tag da EC2, nome do
 * bucket, identificador do RDS etc.) na maioria dos casos; quando ausente, cai para o último
 * segmento do ARN em vez de exibir o ARN inteiro.
 */
export function resourceDisplayName(job: Pick<AwsBackupJob, "resourceName" | "resourceArn">): string {
  if (job.resourceName) return job.resourceName;
  if (!job.resourceArn) return "—";
  const slashIdx = job.resourceArn.lastIndexOf("/");
  if (slashIdx !== -1) return job.resourceArn.slice(slashIdx + 1);
  const parts = job.resourceArn.split(":");
  return parts[parts.length - 1] || job.resourceArn;
}
