import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditUserForm } from "./edit-user-form";
import { AccountActions } from "./account-actions";
import { SessionsList } from "./sessions-list";

export default async function PanelUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(["ADMIN"]);
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: { sessions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        <p className="text-sm text-muted-foreground">@{user.username} · {user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados e permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <EditUserForm user={user} isSelf={user.id === actor.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segurança</CardTitle>
          <CardDescription>
            MFA: {user.mfaEnabled ? "ativado" : "não configurado"} · Precisa trocar senha:{" "}
            {user.mustChangePassword ? "sim" : "não"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountActions userId={user.id} isSelf={user.id === actor.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessões recentes</CardTitle>
          <CardDescription>Últimos acessos e dispositivos. Revogar encerra a sessão imediatamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList sessions={user.sessions} userId={user.id} />
        </CardContent>
      </Card>
    </div>
  );
}
