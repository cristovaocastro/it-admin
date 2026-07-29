import { requireRole } from "@/lib/auth/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionForm } from "../connection-form";

export default async function NewOciConnectionPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nova conexão OCI</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre uma API Signing Key com permissão de leitura (e, se necessário, start/stop/reboot de instâncias) na
          tenancy Oracle Cloud.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da conexão</CardTitle>
          <CardDescription>Recomenda-se testar antes de salvar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionForm />
        </CardContent>
      </Card>
    </div>
  );
}
