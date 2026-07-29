import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadOciConnectionConfig } from "@/lib/oci/connection";
import { listOciDatabases } from "@/lib/oci/database";
import { OciOperationError } from "@/lib/oci/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Cloud } from "lucide-react";
import { OciConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

const KIND_LABEL: Record<string, string> = { db_system: "DB System", autonomous: "Autonomous DB" };
const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  AVAILABLE: "secondary",
  ACTIVE: "secondary",
  PROVISIONING: "outline",
  STARTING: "outline",
  STOPPING: "outline",
  STOPPED: "outline",
  UPDATING: "outline",
  TERMINATING: "destructive",
  TERMINATED: "destructive",
  FAILED: "destructive",
};

export default async function OciDatabasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.ociConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Bancos de dados OCI</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão OCI cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a OCI antes de consultar bancos de dados.{" "}
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

  let databases: Awaited<ReturnType<typeof listOciDatabases>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadOciConnectionConfig(connection.id);
    databases = await listOciDatabases(config);
  } catch (err) {
    loadError = err instanceof OciOperationError ? err.message : "Falha ao consultar a OCI.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bancos de dados OCI</h1>
        <p className="text-sm text-muted-foreground">DB Systems e Autonomous Databases nas regiões/compartments monitorados.</p>
      </div>

      <OciConnectionPicker connections={connections} selectedId={connection.id} basePath="/oci/banco-de-dados" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a OCI</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Shape / Workload</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Armazenamento</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {databases.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{KIND_LABEL[d.kind]}</TableCell>
                    <TableCell className="text-muted-foreground">{d.shape ?? d.workload ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.dbVersion ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.storageSize ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.region}</TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[d.state] ?? "outline"}>{d.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {databases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Nenhum banco de dados encontrado nas regiões/compartments monitorados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
