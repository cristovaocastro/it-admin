// GravityZone é consultado via JSON-RPC 2.0 (sem SDK TypeScript oficial) — os tipos abaixo
// foram conferidos contra uma conta GravityZone real (network.getEndpointsList e
// network.getManagedEndpointDetails) em 2026-07-28. `getManagedEndpointDetails` só existe na
// v1.0 do endpoint JSON-RPC (`/api/v1.0/jsonrpc/network`) — em v1.1 dá "Method not found".

export type BitdefenderConnectionConfig = {
  id?: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  companyId: string | null;
};

export type BitdefenderTestResult = {
  success: boolean;
  latencyMs: number;
  error?: string;
};

export class BitdefenderOperationError extends Error {}

// --- network service --------------------------------------------------------------------------

/** Nome do módulo (antimalware, firewall, contentControl, ...) → habilitado ou não — espelha o objeto `modules` de `getManagedEndpointDetails`. */
export type BitdefenderModuleMap = Record<string, boolean>;

export type BitdefenderEndpoint = {
  id: string;
  name: string;
  fqdn: string | null;
  ip: string | null;
  operatingSystem: string | null;
  groupName: string | null;
  policyName: string | null;
  malwareStatus: "infected" | "clean" | "unknown";
  isManaged: boolean;
  /** Isolamento de rede — não há campo confirmado da API para uma conta sem endpoint isolado no momento
   *  do levantamento; assume-se ausente/false quando o agente não está isolado. Revalidar se aparecer
   *  um caso real isolado. */
  isolated: boolean;
  lastSeen: string | null;
  /** Comunicação com o GravityZone — endpoint online agora / offline (de `state`: 1=online, 2=offline, 3=suspenso, 0=desconhecido). */
  online: boolean | null;
  /** Produto ou assinaturas de malware desatualizados (de `agent.productOutdated` / `agent.signatureOutdated`). */
  productOutdated: boolean;
  signatureOutdated: boolean;
  /** Módulos de proteção (antimalware, firewall, content control, etc.) e se estão habilitados. */
  modules: BitdefenderModuleMap;
  /** Se a política atribuída já foi de fato aplicada no endpoint. A API só informa applied=true/false — não existe "pending" separado. */
  policyStatus: "applied" | "not_applied" | "unknown";
};

export type BitdefenderEndpointAction = "scan_quick" | "scan_full" | "isolate" | "restore" | "uninstall";

// --- painel de saúde ---------------------------------------------------------------------------

export type BitdefenderEndpointIssue = { id: string; name: string; reason: string };

export type BitdefenderSecurityHealth = {
  totalEndpoints: number;
  updateIssues: BitdefenderEndpointIssue[];
  securityIssues: BitdefenderEndpointIssue[];
  communicationIssues: BitdefenderEndpointIssue[];
  moduleIssues: BitdefenderEndpointIssue[];
  policyIssues: BitdefenderEndpointIssue[];
};

// --- quarantine service ------------------------------------------------------------------------

export type BitdefenderQuarantineItem = {
  id: string;
  endpointId: string;
  endpointName: string | null;
  threatName: string | null;
  filePath: string | null;
  detectionTime: string | null;
};

// --- policies service --------------------------------------------------------------------------

export type BitdefenderPolicy = {
  id: string;
  name: string;
  type: string | null;
};

// --- push service ------------------------------------------------------------------------------

export type BitdefenderInstallationLink = {
  id: string;
  osType: "windows" | "linux" | "macos" | string;
  kitType: string | null;
  downloadUrl: string;
};

// --- incidents service (EDR/XDR) ---------------------------------------------------------------

export type BitdefenderIncident = {
  id: string;
  name: string | null;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: string | null;
  endpointName: string | null;
  detectedAt: string | null;
};
