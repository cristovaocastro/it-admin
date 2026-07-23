import { requireRole } from "@/lib/auth/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionForm } from "../connection-form";

export default async function NewFirewallConnectionPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nova conexão de firewall</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre os dados de acesso à API de gestão de um firewall SonicWall. Recomenda-se testar antes de salvar.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da conexão</CardTitle>
          <CardDescription>
            É preciso habilitar a API do SonicOS no aparelho antes (Manage &gt; System Setup &gt; Appliance &gt;
            Base Settings &gt; Enable SonicOS API, com RFC-2617 HTTP Basic Authentication marcado).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionForm />
        </CardContent>
      </Card>
    </div>
  );
}
