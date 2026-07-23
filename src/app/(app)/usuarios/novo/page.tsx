import { requireRole } from "@/lib/auth/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewUserForm } from "./new-user-form";

export default async function NewPanelUserPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo usuário do painel</h1>
        <p className="text-sm text-muted-foreground">
          Uma senha temporária será gerada. O usuário deverá trocá-la e configurar o MFA no primeiro acesso.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do usuário</CardTitle>
          <CardDescription>Papéis: Administrador (acesso total), Operador (opera AD), Auditor (só leitura).</CardDescription>
        </CardHeader>
        <CardContent>
          <NewUserForm />
        </CardContent>
      </Card>
    </div>
  );
}
