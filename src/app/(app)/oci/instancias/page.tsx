import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadOciConnectionConfig } from "@/lib/oci/connection";
import { listOciInstances } from "@/lib/oci/compute";
import { OciOperationError } from "@/lib/oci/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Cloud } from "lucide-react";
import { OciConnectionPicker } from "../connection-picker";
import { InstancesTable } from "./instances-table";

type SearchParams = { conexao?: string };

export default async function OciInstancesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.ociConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Instâncias OCI</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão OCI cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a OCI antes de consultar instâncias.{" "}
            <Link href="/oci/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let instances: Awaited<ReturnType<typeof listOciInstances>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadOciConnectionConfig(connection.id);
    instances = await listOciInstances(config);
  } catch (err) {
    loadError = err instanceof OciOperationError ? err.message : "Falha ao consultar a OCI.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instâncias OCI</h1>
        <p className="text-sm text-muted-foreground">Status das instâncias de computação nas regiões/compartments monitorados.</p>
      </div>

      <OciConnectionPicker connections={connections} selectedId={connection.id} basePath="/oci/instancias" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a OCI</AlertTitle>
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
