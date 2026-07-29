import Link from "next/link";
import { Suspense } from "react";
import { requireUser, hasAtLeastRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getAdHealthStats } from "@/lib/ad/health";
import { getAwsHealthStats } from "@/lib/aws/health";
import { getBitdefenderHealthStats } from "@/lib/bitdefender/health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Users,
  Network,
  ScrollText,
  UserCog,
  Lock,
  ShieldOff,
  ShieldCheck,
  CalendarOff,
  MonitorOff,
  Monitor,
  CalendarClock,
  KeyRound,
  ShieldAlert,
  Flame,
  Loader2,
  Cloud,
  Server,
  DatabaseBackup,
  CircleDollarSign,
  Waypoints,
  Bug,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "sucesso",
  FAILURE: "falha",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  OPERATOR: "Operador",
  AUDITOR: "Auditor",
};

const FW_STATUS_LABEL: Record<string, string> = {
  SUCCESS: "ok",
  FAILURE: "falha",
  NEVER_TESTED: "não testado",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const canSeePanelStats = hasAtLeastRole(user.role, "ADMIN");
  const dayAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);

  const [
    panelUserCount,
    panelUsersByRole,
    panelUsersByStatus,
    mfaEnabledCount,
    adConnectionCount,
    firewallConnectionCount,
    firewallByStatus,
    awsConnectionCount,
    bitdefenderConnectionCount,
    recentLogs,
    auditLast24h,
    auditFailuresLast24h,
  ] = await Promise.all([
    canSeePanelStats ? db.user.count() : Promise.resolve(null),
    canSeePanelStats ? db.user.groupBy({ by: ["role"], _count: { _all: true } }) : Promise.resolve(null),
    canSeePanelStats ? db.user.groupBy({ by: ["status"], _count: { _all: true } }) : Promise.resolve(null),
    canSeePanelStats ? db.user.count({ where: { mfaEnabled: true } }) : Promise.resolve(null),
    canSeePanelStats ? db.adConnection.count({ where: { isActive: true } }) : Promise.resolve(null),
    canSeePanelStats ? db.firewallConnection.count({ where: { isActive: true } }) : Promise.resolve(null),
    canSeePanelStats
      ? db.firewallConnection.groupBy({ by: ["lastTestStatus"], where: { isActive: true }, _count: { _all: true } })
      : Promise.resolve(null),
    canSeePanelStats ? db.awsConnection.count({ where: { isActive: true } }) : Promise.resolve(null),
    canSeePanelStats ? db.bitdefenderConnection.count({ where: { isActive: true } }) : Promise.resolve(null),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
    db.auditLog.count({ where: { createdAt: { gte: dayAgo }, status: "FAILURE" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Visão geral do ambiente</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canSeePanelStats && (
          <StatCard title="Usuários do painel" value={panelUserCount ?? 0} icon={Users} href="/usuarios" />
        )}
        {canSeePanelStats && (
          <StatCard title="Conexões AD ativas" value={adConnectionCount ?? 0} icon={Network} href="/ad/conexoes" />
        )}
        {canSeePanelStats && (
          <StatCard
            title="Conexões Firewall ativas"
            value={firewallConnectionCount ?? 0}
            icon={Flame}
            href="/firewall/conexoes"
          />
        )}
        {canSeePanelStats && (
          <StatCard title="Conexões AWS ativas" value={awsConnectionCount ?? 0} icon={Cloud} href="/aws/conexoes" />
        )}
        {canSeePanelStats && (
          <StatCard
            title="Conexões Bitdefender ativas"
            value={bitdefenderConnectionCount ?? 0}
            icon={ShieldCheck}
            href="/bitdefender/conexoes"
          />
        )}
        <StatCard title="Eventos de auditoria (24h)" value={auditLast24h} icon={ScrollText} href="/auditoria" />
      </div>

      {canSeePanelStats && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Usuários do painel</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(["ADMIN", "OPERATOR", "AUDITOR"] as const).map((role) => (
              <StatCard
                key={role}
                title={ROLE_LABEL[role]}
                value={panelUsersByRole?.find((r) => r.role === role)?._count._all ?? 0}
                icon={UserCog}
                href="/usuarios"
              />
            ))}
            <StatCard
              title="Sem MFA habilitado"
              value={panelUserCount !== null ? (panelUserCount ?? 0) - (mfaEnabledCount ?? 0) : 0}
              icon={ShieldAlert}
              href="/usuarios"
              tone={panelUserCount !== null && (panelUserCount ?? 0) - (mfaEnabledCount ?? 0) > 0 ? "warning" : undefined}
            />
          </div>
          {panelUsersByStatus && panelUsersByStatus.some((s) => s.status !== "ACTIVE") && (
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
              {panelUsersByStatus
                .filter((s) => s.status !== "ACTIVE")
                .map((s) => (
                  <Badge key={s.status} variant={s.status === "LOCKED" ? "destructive" : "outline"}>
                    {s._count._all} {s.status === "LOCKED" ? "bloqueado(s)" : "inativo(s)"}
                  </Badge>
                ))}
            </div>
          )}
        </div>
      )}

      <Suspense fallback={<AdHealthFallback />}>
        <AdHealthSection />
      </Suspense>

      <Suspense fallback={<AwsHealthFallback />}>
        <AwsHealthSection />
      </Suspense>

      <Suspense fallback={<BitdefenderHealthFallback />}>
        <BitdefenderHealthSection />
      </Suspense>

      {canSeePanelStats && firewallByStatus && firewallConnectionCount !== null && firewallConnectionCount > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Saúde do Firewall</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(["SUCCESS", "FAILURE", "NEVER_TESTED"] as const).map((status) => (
              <StatCard
                key={status}
                title={`Conexões — ${FW_STATUS_LABEL[status]}`}
                value={firewallByStatus.find((f) => f.lastTestStatus === status)?._count._all ?? 0}
                icon={status === "SUCCESS" ? ShieldCheck : status === "FAILURE" ? ShieldOff : CalendarClock}
                href="/firewall/conexoes"
                tone={status === "FAILURE" ? "warning" : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Atividade recente</CardTitle>
          {auditFailuresLast24h > 0 && (
            <Badge variant="destructive">{auditFailuresLast24h} falha(s) nas últimas 24h</Badge>
          )}
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm">{log.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actorName} · {log.createdAt.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={log.status === "SUCCESS" ? "secondary" : "destructive"}>
                    {STATUS_LABEL[log.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {canSeePanelStats && (
            <Link href="/auditoria" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Ver toda a auditoria →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdHealthFallback() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Saúde do Active Directory</h2>
      <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Consultando o Active Directory...
      </div>
    </div>
  );
}

async function AdHealthSection() {
  const adConnections = await db.adConnection.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  if (adConnections.length === 0) return null;
  const adHealth = await getAdHealthStats(adConnections);

  return (
    <div className="space-y-3">
      {adHealth.connectionErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Falha ao consultar o AD</AlertTitle>
          <AlertDescription>
            Não foi possível obter indicadores de: {adHealth.connectionErrors.join(", ")}. Os números abaixo podem
            estar incompletos.
          </AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Usuários do Active Directory ({adHealth.totalUsers})
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Contas bloqueadas"
            value={adHealth.lockedUsers}
            icon={Lock}
            href="/ad/usuarios"
            tone={adHealth.lockedUsers > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Contas desabilitadas"
            value={adHealth.disabledUsers}
            icon={ShieldOff}
            href="/ad/usuarios"
          />
          <StatCard
            title="Senhas expiradas"
            value={adHealth.expiredPasswordUsers}
            icon={KeyRound}
            href="/ad/usuarios"
            tone={adHealth.expiredPasswordUsers > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Contas com expiração vencida"
            value={adHealth.expiredAccountUsers}
            icon={CalendarOff}
            href="/ad/usuarios"
            tone={adHealth.expiredAccountUsers > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Inativos há 90+ dias"
            value={adHealth.inactiveUsers90}
            icon={CalendarClock}
            href="/ad/usuarios?acesso=90"
            tone={adHealth.inactiveUsers90 > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Senha nunca expira"
            value={adHealth.neverExpiresUsers}
            icon={ShieldAlert}
            href="/ad/usuarios"
            tone={adHealth.neverExpiresUsers > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Computadores"
            value={adHealth.totalComputers}
            icon={Monitor}
            href="/ad/computadores"
          />
          <StatCard
            title="Computadores sem logon há 90+ dias"
            value={adHealth.staleComputers}
            icon={MonitorOff}
            href="/ad/computadores"
            tone={adHealth.staleComputers > 0 ? "warning" : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function AwsHealthFallback() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Saúde da AWS</h2>
      <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Consultando a AWS...
      </div>
    </div>
  );
}

async function AwsHealthSection() {
  const awsConnections = await db.awsConnection.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  if (awsConnections.length === 0) return null;
  const awsHealth = await getAwsHealthStats(awsConnections);

  return (
    <div className="space-y-3">
      {awsHealth.connectionErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Falha ao consultar a AWS</AlertTitle>
          <AlertDescription>
            Não foi possível obter indicadores de: {awsHealth.connectionErrors.join(", ")}. Os números abaixo podem
            estar incompletos.
          </AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Saúde da AWS ({awsHealth.totalInstances} instância(s))
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Instâncias em execução" value={awsHealth.runningInstances} icon={Server} href="/aws/instancias" />
          <StatCard title="Instâncias paradas" value={awsHealth.stoppedInstances} icon={Server} href="/aws/instancias" />
          <StatCard
            title="Falhas de backup (7 dias)"
            value={awsHealth.backupFailures7d}
            icon={DatabaseBackup}
            href="/aws/backup"
            tone={awsHealth.backupFailures7d > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Túneis VPN indisponíveis"
            value={awsHealth.vpnTunnelsDown}
            icon={Waypoints}
            href="/aws/rede"
            tone={awsHealth.vpnTunnelsDown > 0 ? "warning" : undefined}
          />
          <StatCard
            title="VPC Endpoints indisponíveis"
            value={awsHealth.endpointsUnavailable}
            icon={Waypoints}
            href="/aws/rede"
            tone={awsHealth.endpointsUnavailable > 0 ? "warning" : undefined}
          />
          <StatCard title="Ver custos detalhados" icon={CircleDollarSign} href="/aws/custos" />
        </div>
      </div>
    </div>
  );
}

function BitdefenderHealthFallback() {
  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Saúde do Bitdefender GravityZone</h2>
      <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Consultando o GravityZone...
      </div>
    </div>
  );
}

async function BitdefenderHealthSection() {
  const bitdefenderConnections = await db.bitdefenderConnection.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (bitdefenderConnections.length === 0) return null;
  const bdHealth = await getBitdefenderHealthStats(bitdefenderConnections);

  return (
    <div className="space-y-3">
      {bdHealth.connectionErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Falha ao consultar o GravityZone</AlertTitle>
          <AlertDescription>
            Não foi possível obter indicadores de: {bdHealth.connectionErrors.join(", ")}. Os números abaixo podem
            estar incompletos.
          </AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Saúde do Bitdefender GravityZone ({bdHealth.totalEndpoints} endpoint(s))
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Sem agente instalado"
            value={bdHealth.unmanagedEndpoints}
            icon={MonitorOff}
            href="/bitdefender/endpoints"
            tone={bdHealth.unmanagedEndpoints > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Endpoints infectados"
            value={bdHealth.infectedEndpoints}
            icon={Bug}
            href="/bitdefender/endpoints"
            tone={bdHealth.infectedEndpoints > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Endpoints isolados"
            value={bdHealth.isolatedEndpoints}
            icon={ShieldAlert}
            href="/bitdefender/endpoints"
            tone={bdHealth.isolatedEndpoints > 0 ? "warning" : undefined}
          />
          <StatCard
            title="Itens em quarentena"
            value={bdHealth.quarantineItems}
            icon={Bug}
            href="/bitdefender/quarentena"
          />
          <StatCard
            title="Incidentes ativos (EDR)"
            value={bdHealth.activeIncidents}
            icon={ShieldAlert}
            href="/bitdefender/incidentes"
            tone={bdHealth.activeIncidents > 0 ? "warning" : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  tone,
}: {
  title: string;
  value?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone?: "warning";
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex items-center gap-4 pt-6">
          <div
            className={
              tone === "warning"
                ? "flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                : "flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            }
          >
            <Icon className="size-5" />
          </div>
          <div>
            {value !== undefined && value !== null && <p className="text-2xl font-semibold leading-none">{value}</p>}
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
