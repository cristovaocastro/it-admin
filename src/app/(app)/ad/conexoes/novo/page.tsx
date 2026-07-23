import { requireRole } from "@/lib/auth/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionForm } from "../connection-form";

export default async function NewAdConnectionPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nova conexão AD</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre os dados de acesso a um domínio Active Directory. Recomenda-se testar antes de salvar.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da conexão</CardTitle>
          <CardDescription>
            A conta de serviço precisa de permissão para criar/alterar usuários e grupos nas OUs desejadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionForm />
        </CardContent>
      </Card>
    </div>
  );
}
