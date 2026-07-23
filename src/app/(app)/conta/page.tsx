import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/app/conta/trocar-senha/change-password-form";
import { Badge } from "@/components/ui/badge";
import { MySessionsList } from "./my-sessions-list";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", OPERATOR: "Operador", AUDITOR: "Auditor" };

export default async function AccountPage() {
  const user = await requireUser();
  const fullUser = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    include: { sessions: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Usuário</p>
            <p>@{user.username}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Papel</p>
            <p>{ROLE_LABEL[user.role]}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Verificação em duas etapas</p>
            <Badge variant={fullUser.mfaEnabled ? "secondary" : "outline"}>
              {fullUser.mfaEnabled ? "ativada" : "não configurada"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trocar senha</CardTitle>
          <CardDescription>Recomendado periodicamente. Encerra suas outras sessões ativas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessões ativas</CardTitle>
          <CardDescription>Dispositivos onde sua conta está atualmente conectada.</CardDescription>
        </CardHeader>
        <CardContent>
          <MySessionsList sessions={fullUser.sessions} />
        </CardContent>
      </Card>
    </div>
  );
}
