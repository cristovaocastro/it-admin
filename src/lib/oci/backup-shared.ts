// Tipos e helpers puramente de apresentação do módulo OCI Backup, sem dependência do SDK da OCI
// nem de "server-only" — importável tanto por Server Components quanto por Client Components
// (ex.: o filtro/tabela interativo de backups, no mesmo padrão do módulo AWS).

export type OciBackup = {
  id: string;
  kind: "volume" | "boot_volume" | "db_system" | "autonomous";
  name?: string;
  state: string;
  type?: string; // FULL | INCREMENTAL
  sizeLabel?: string;
  sourceResourceId?: string; // volumeId / bootVolumeId / databaseId / autonomousDatabaseId de origem
  compartmentId: string;
  region: string;
  timeCreated?: string;
};

const KIND_LABELS: Record<OciBackup["kind"], string> = {
  volume: "Backup de volume de bloco",
  boot_volume: "Backup de volume de boot",
  db_system: "Backup de DB System",
  autonomous: "Backup de Autonomous DB",
};

/** Traduz o tipo de recurso do backup OCI para um rótulo amigável em pt-BR. */
export function resourceKindLabel(kind: OciBackup["kind"]): string {
  return KIND_LABELS[kind];
}

/** Nome visual do backup — a OCI quase sempre retorna `displayName`; sem ele, cai para o OCID. */
export function resourceDisplayName(backup: Pick<OciBackup, "name" | "id">): string {
  return backup.name ?? backup.id;
}
