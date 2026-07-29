import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { listBitdefenderEndpoints } from "@/lib/bitdefender/endpoints";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import type { BitdefenderEndpoint } from "@/lib/bitdefender/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MonitorOff,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { EndpointDetailActions } from "./endpoint-detail-actions";

type SearchParams = { conexao?: string };

const MODULE_LABELS: Record<string, string> = {
  antimalware: "Antimalware",
  firewall: "Firewall",
  contentControl: "Controle de conteúdo",
  powerUser: "Power User",
  deviceControl: "Controle de dispositivos",
  advancedThreatControl: "Controle avançado de ameaças",
  applicationControl: "Controle de aplicações",
  encryption: "Criptografia",
  networkAttackDefense: "Defesa contra ataques de rede",
  antiTampering: "Anti-tampering",
  advancedAntiExploit: "Anti-exploit avançado",
  userControl: "Controle de usuário",
  antiphishing: "Antiphishing",
  trafficScan: "Varredura de tráfego",
  hyperDetect: "HyperDetect",
  remoteEnginesScanning: "Varredura por engines remotas",
  sandboxAnalyzer: "Sandbox Analyzer",
  riskManagement: "Gestão de risco",
};

const MALWARE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  clean: "secondary",
  infected: "destructive",
  unknown: "outline",
};
const MALWARE_LABEL: Record<string, string> = { clean: "protegido", infected: "infectado", unknown: "desconhecido" };

export default async function BitdefenderEndpointDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!sp.conexao) notFound();

  const connection = await db.bitdefenderConnection.findUnique({ where: { id: sp.conexao } });
  if (!connection) notFound();

  let endpoint: BitdefenderEndpoint | null = null;
  let loadError: string | null = null;
  try {
    const config = await loadBitdefenderConnectionConfig(connection.id);
    // Não há um "getOne" na API que também cubra endpoints não gerenciados sem erro — reaproveita
    // a listagem completa (já trata isManaged=false sem lançar) e filtra pelo id.
    const endpoints = await listBitdefenderEndpoints(config);
    endpoint = endpoints.find((e) => e.id === id) ?? null;
  } catch (err) {
    loadError = err instanceof BitdefenderOperationError ? err.message : "Falha ao consultar o GravityZone.";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/bitdefender/endpoints?conexao=${connection.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para endpoints
      </Link>

      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o GravityZone</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!loadError && !endpoint && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Endpoint não encontrado</AlertTitle>
          <AlertDescription>Ele pode ter sido removido do GravityZone.</AlertDescription>
        </Alert>
      )}

      {endpoint && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{endpoint.name}</h1>
            <Badge variant={MALWARE_VARIANT[endpoint.malwareStatus]}>{MALWARE_LABEL[endpoint.malwareStatus]}</Badge>
            {endpoint.isolated && <Badge variant="destructive">isolado da rede</Badge>}
            {endpoint.online === true && (
              <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-500">
                <Wifi className="size-3" /> online
              </Badge>
            )}
            {endpoint.online === false && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <WifiOff className="size-3" /> offline
              </Badge>
            )}
          </div>

          {!endpoint.isManaged && (
            <Alert variant="destructive">
              <MonitorOff className="size-4" />
              <AlertTitle>Sem agente instalado</AlertTitle>
              <AlertDescription>
                O GravityZone descobriu esta máquina na rede, mas ela não tem o agente de proteção instalado — nenhum
                dado de segurança, atualização ou módulos está disponível, e não há ações remotas possíveis até a
                instalação.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="IP" value={endpoint.ip} />
              <Info label="FQDN" value={endpoint.fqdn} />
              <Info label="Sistema operacional" value={endpoint.operatingSystem} />
              <Info label="Grupo" value={endpoint.groupName} />
              <Info
                label="Política"
                value={
                  endpoint.policyName ? (
                    <span className="inline-flex items-center gap-1.5">
                      {endpoint.policyName}
                      {endpoint.policyStatus === "not_applied" && (
                        <Badge variant="outline" className="text-amber-600 dark:text-amber-500">
                          não aplicada
                        </Badge>
                      )}
                    </span>
                  ) : null
                }
              />
              <Info
                label="Último contato"
                value={endpoint.lastSeen ? new Date(endpoint.lastSeen).toLocaleString("pt-BR") : null}
              />
              <Info label="ID no GravityZone" value={endpoint.id} mono />
            </CardContent>
          </Card>

          {endpoint.isManaged && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <RefreshCw className="size-4" />
                  Atualização
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm">
                <UpdateStatus label="Produto" outdated={endpoint.productOutdated} />
                <UpdateStatus label="Assinaturas de malware" outdated={endpoint.signatureOutdated} />
              </CardContent>
            </Card>
          )}

          {endpoint.isManaged && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Módulos de proteção</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(endpoint.modules).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum módulo reportado pelo GravityZone.</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(endpoint.modules).map(([name, enabled]) => (
                      <li key={name} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <span>{MODULE_LABELS[name] ?? name}</span>
                        {enabled ? (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="size-3" /> ativo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <XCircle className="size-3" /> desativado
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {endpoint.isManaged && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointDetailActions endpoint={endpoint} connectionId={connection.id} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-sm" : "text-sm"}>{value ?? "—"}</p>
    </div>
  );
}

function UpdateStatus({ label, outdated }: { label: string; outdated: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {outdated ? (
        <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="size-3" /> {label} desatualizado
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle2 className="size-3" /> {label} em dia
        </Badge>
      )}
    </span>
  );
}
