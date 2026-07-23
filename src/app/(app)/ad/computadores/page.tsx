import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { searchAdComputers } from "@/lib/ad/computers";
import { AdOperationError } from "@/lib/ad/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Network } from "lucide-react";
import { ConnectionPicker } from "../connection-picker";
import { ComputerSearchForm } from "./computer-search-form";
import { AdComputersTable } from "./ad-computers-table";

type SearchParams = { conexao?: string; q?: string };

export default async function AdComputersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.adConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Computadores</h1>
        <Alert>
          <Network className="size-4" />
          <AlertTitle>Nenhuma conexão AD cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o Active Directory antes de gerenciar computadores.{" "}
            <Link href="/ad/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let computers: Awaited<ReturnType<typeof searchAdComputers>> = [];
  let searchError: string | null = null;
  try {
    const config = await loadAdConnectionConfig(connection.id);
    computers = await searchAdComputers(config, { query: sp.q });
  } catch (err) {
    searchError = err instanceof AdOperationError ? err.message : "Falha ao consultar o Active Directory.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Computadores</h1>
        <p className="text-sm text-muted-foreground">Máquinas ingressadas no domínio Active Directory.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <ConnectionPicker connections={connections} selectedId={connection.id} basePath="/ad/computadores" />
        <ComputerSearchForm connectionId={connection.id} defaultQuery={sp.q} />
      </div>

      {searchError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o AD</AlertTitle>
          <AlertDescription>{searchError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <AdComputersTable computers={computers} connectionId={connection.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
