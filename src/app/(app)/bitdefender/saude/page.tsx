import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { listBitdefenderEndpoints } from "@/lib/bitdefender/endpoints";
import { summarizeBitdefenderHealth } from "@/lib/bitdefender/health";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import type { BitdefenderEndpointIssue } from "@/lib/bitdefender/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  WifiOff,
  Puzzle,
  FileWarning,
  CheckCircle2,
  Monitor,
  MonitorOff,
} from "lucide-react";
import { BitdefenderConnectionPicker } from "../connection-picker";
import { ProtectionBar, type ProtectionSegment } from "./protection-bar";

type SearchParams = { conexao?: string };

export default async function BitdefenderHealthPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.bitdefenderConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Saúde</h1>
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Nenhuma conexão Bitdefender cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o GravityZone antes de consultar a saúde dos endpoints.{" "}
            <Link href="/bitdefender/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let health: ReturnType<typeof summarizeBitdefenderHealth> | null = null;
  let posture: { protected: number; unmanaged: number; atRisk: number; total: number } | null = null;
  let loadError: string | null = null;
  try {
    const config = await loadBitdefenderConnectionConfig(connection.id);
    const endpoints = await listBitdefenderEndpoints(config);
    health = summarizeBitdefenderHealth(endpoints);
    posture = {
      total: endpoints.length,
      unmanaged: endpoints.filter((e) => !e.isManaged).length,
      atRisk: endpoints.filter((e) => e.isManaged && (e.malwareStatus === "infected" || e.isolated)).length,
      protected: endpoints.filter((e) => e.isManaged && e.malwareStatus !== "infected" && !e.isolated).length,
    };
  } catch (err) {
    loadError = err instanceof BitdefenderOperationError ? err.message : "Falha ao consultar o GravityZone.";
  }

  const segments: ProtectionSegment[] = posture
    ? [
        { key: "protected", label: "Protegidos", count: posture.protected, colorClass: "bg-[#059669]" },
        { key: "unmanaged", label: "Sem agente", count: posture.unmanaged, colorClass: "bg-[#d97706]" },
        { key: "atRisk", label: "Em risco", count: posture.atRisk, colorClass: "bg-[#dc2626]" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saúde — Bitdefender GravityZone</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral de proteção, atualização, comunicação, módulos e políticas dos endpoints.
        </p>
      </div>

      <BitdefenderConnectionPicker connections={connections} selectedId={connection.id} basePath="/bitdefender/saude" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o GravityZone</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        health &&
        posture && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiTile title="Endpoints monitorados" value={posture.total} icon={Monitor} connectionId={connection.id} />
              <KpiTile
                title="Protegidos"
                value={posture.protected}
                icon={ShieldCheck}
                connectionId={connection.id}
                tone="good"
              />
              <KpiTile
                title="Sem agente instalado"
                value={posture.unmanaged}
                icon={MonitorOff}
                connectionId={connection.id}
                tone={posture.unmanaged > 0 ? "warning" : undefined}
              />
              <KpiTile
                title="Em risco"
                value={posture.atRisk}
                icon={ShieldAlert}
                connectionId={connection.id}
                tone={posture.atRisk > 0 ? "critical" : undefined}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Postura de proteção</CardTitle>
              </CardHeader>
              <CardContent>
                <ProtectionBar segments={segments} total={posture.total} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <HealthWidget
                title="Segurança do endpoint"
                icon={ShieldAlert}
                issues={health.securityIssues}
                okLabel="Nenhum problema de segurança ativo."
                connectionId={connection.id}
              />
              <HealthWidget
                title="Status de atualização"
                icon={RefreshCw}
                issues={health.updateIssues}
                okLabel="Todos os endpoints atualizados."
                connectionId={connection.id}
              />
              <HealthWidget
                title="Comunicação"
                icon={WifiOff}
                issues={health.communicationIssues}
                okLabel="Todos os endpoints se comunicando normalmente."
                connectionId={connection.id}
              />
              <HealthWidget
                title="Módulos"
                icon={Puzzle}
                issues={health.moduleIssues}
                okLabel="Todos os módulos de proteção ativos."
                connectionId={connection.id}
              />
              <HealthWidget
                title="Políticas"
                icon={FileWarning}
                issues={health.policyIssues}
                okLabel="Todas as políticas aplicadas."
                connectionId={connection.id}
              />
            </div>
          </>
        )
      )}
    </div>
  );
}

function KpiTile({
  title,
  value,
  icon: Icon,
  connectionId,
  tone,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  connectionId: string;
  tone?: "good" | "warning" | "critical";
}) {
  const TONE_CLASS: Record<"good" | "warning" | "critical", string> = {
    good: "bg-[#059669]/10 text-[#059669]",
    warning: "text-amber-600 dark:text-amber-500 bg-amber-600/10 dark:bg-amber-500/10",
    critical: "bg-destructive/10 text-destructive",
  };
  const toneClass = tone ? TONE_CLASS[tone] : "bg-primary/10 text-primary";

  return (
    <Link href={`/bitdefender/endpoints?conexao=${connectionId}`}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex items-center gap-4 pt-6">
          <div className={`flex size-10 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold leading-none">{value}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HealthWidget({
  title,
  icon: Icon,
  issues,
  okLabel,
  connectionId,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  issues: BitdefenderEndpointIssue[];
  okLabel: string;
  connectionId: string;
}) {
  const hasIssues = issues.length > 0;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={hasIssues ? "size-4 text-destructive" : "size-4 text-muted-foreground"} />
          {title}
        </CardTitle>
        <Badge variant={hasIssues ? "destructive" : "secondary"}>{issues.length}</Badge>
      </CardHeader>
      <CardContent>
        {hasIssues ? (
          <ul className="space-y-1">
            {issues.slice(0, 8).map((issue, idx) => (
              <li key={`${issue.id}-${idx}`}>
                <Link
                  href={`/bitdefender/endpoints/${issue.id}?conexao=${connectionId}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{issue.name}</span>
                  <Badge variant="outline" className="text-right text-muted-foreground">
                    {issue.reason}
                  </Badge>
                </Link>
              </li>
            ))}
            {issues.length > 8 && (
              <li className="px-2 pt-1 text-xs text-muted-foreground">+{issues.length - 8} outro(s) endpoint(s)</li>
            )}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" />
            {okLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
