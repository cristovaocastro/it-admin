import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { listBitdefenderEndpoints } from "@/lib/bitdefender/endpoints";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { BitdefenderConnectionPicker } from "../connection-picker";
import { EndpointsTable } from "./endpoints-table";

type SearchParams = { conexao?: string };

export default async function BitdefenderEndpointsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.bitdefenderConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Endpoints</h1>
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Nenhuma conexão Bitdefender cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o GravityZone antes de consultar endpoints.{" "}
            <Link href="/bitdefender/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let endpoints: Awaited<ReturnType<typeof listBitdefenderEndpoints>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadBitdefenderConnectionConfig(connection.id);
    endpoints = await listBitdefenderEndpoints(config);
  } catch (err) {
    loadError = err instanceof BitdefenderOperationError ? err.message : "Falha ao consultar o GravityZone.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Endpoints</h1>
        <p className="text-sm text-muted-foreground">
          Inventário de máquinas protegidas e ações de resposta (scan, isolamento, desinstalação).
        </p>
      </div>

      <BitdefenderConnectionPicker connections={connections} selectedId={connection.id} basePath="/bitdefender/endpoints" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o GravityZone</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EndpointsTable endpoints={endpoints} connectionId={connection.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
