import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConnectionForm } from "../connection-form";
import { ConnectionActions } from "./connection-actions";

const TEST_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  SUCCESS: "secondary",
  FAILURE: "destructive",
  NEVER_TESTED: "outline",
};
const TEST_LABEL: Record<string, string> = { SUCCESS: "conectado", FAILURE: "falhou", NEVER_TESTED: "não testado" };

export default async function AdConnectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const connection = await db.adConnection.findUnique({ where: { id } });
  if (!connection) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{connection.name}</h1>
            <Badge variant={TEST_VARIANT[connection.lastTestStatus]}>{TEST_LABEL[connection.lastTestStatus]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {connection.host}:{connection.port} · {connection.baseDN}
          </p>
          {connection.lastTestAt && (
            <p className="text-xs text-muted-foreground">
              Último teste: {connection.lastTestAt.toLocaleString("pt-BR")}
              {connection.lastTestLatencyMs != null && ` (${connection.lastTestLatencyMs}ms)`}
              {connection.lastTestError && ` — ${connection.lastTestError}`}
            </p>
          )}
        </div>
        <ConnectionActions connectionId={connection.id} connectionName={connection.name} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editar conexão</CardTitle>
          <CardDescription>Altere os dados e teste antes de salvar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionForm connection={connection} />
        </CardContent>
      </Card>
    </div>
  );
}
