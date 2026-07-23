import Link from "next/link";
import { requireUser, hasAtLeastRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Network, ScrollText, UserCog } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "sucesso",
  FAILURE: "falha",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const canSeePanelStats = hasAtLeastRole(user.role, "ADMIN");

  const [panelUserCount, adConnectionCount, recentLogs] = await Promise.all([
    canSeePanelStats ? db.user.count() : Promise.resolve(null),
    canSeePanelStats ? db.adConnection.count({ where: { isActive: true } }) : Promise.resolve(null),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
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
        <StatCard title="Gerenciar usuários AD" icon={UserCog} href="/ad/usuarios" />
        <StatCard title="Trilha de auditoria" icon={ScrollText} href="/auditoria" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividade recente</CardTitle>
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

function StatCard({
  title,
  value,
  icon: Icon,
  href,
}: {
  title: string;
  value?: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-primary/50">
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            {value !== undefined && <p className="text-2xl font-semibold leading-none">{value}</p>}
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
