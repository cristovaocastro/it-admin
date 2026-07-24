import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAwsConnectionConfig } from "@/lib/aws/connection";
import { listEc2Instances } from "@/lib/aws/ec2";
import { AwsOperationError } from "@/lib/aws/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Cloud } from "lucide-react";
import { AwsConnectionPicker } from "../connection-picker";
import { InstancesTable } from "./instances-table";

type SearchParams = { conexao?: string };

export default async function AwsInstancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.awsConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Instâncias EC2</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão AWS cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a AWS antes de consultar instâncias.{" "}
            <Link href="/aws/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let instances: Awaited<ReturnType<typeof listEc2Instances>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadAwsConnectionConfig(connection.id);
    instances = await listEc2Instances(config);
  } catch (err) {
    loadError = err instanceof AwsOperationError ? err.message : "Falha ao consultar a AWS.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instâncias EC2</h1>
        <p className="text-sm text-muted-foreground">Status das instâncias nas regiões monitoradas.</p>
      </div>

      <AwsConnectionPicker connections={connections} selectedId={connection.id} basePath="/aws/instancias" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a AWS</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <InstancesTable instances={instances} connectionId={connection.id} canManage={user.role === "ADMIN"} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
