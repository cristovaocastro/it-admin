import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { searchAdGroups } from "@/lib/ad/groups";
import { AdOperationError } from "@/lib/ad/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Network } from "lucide-react";
import { ConnectionPicker } from "../connection-picker";
import { GroupSearchForm } from "./group-search-form";
import { AdGroupsTable } from "./ad-groups-table";
import { CreateAdGroupDialog } from "./create-ad-group-dialog";

type SearchParams = { conexao?: string; q?: string };

export default async function AdGroupsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.adConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Grupos AD</h1>
        <Alert>
          <Network className="size-4" />
          <AlertTitle>Nenhuma conexão AD cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o Active Directory antes de gerenciar grupos.{" "}
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

  let groups: Awaited<ReturnType<typeof searchAdGroups>> = [];
  let searchError: string | null = null;
  try {
    const config = await loadAdConnectionConfig(connection.id);
    groups = await searchAdGroups(config, { query: sp.q });
  } catch (err) {
    searchError = err instanceof AdOperationError ? err.message : "Falha ao consultar o Active Directory.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Grupos AD</h1>
          <p className="text-sm text-muted-foreground">Gerencie grupos e sua composição no Active Directory.</p>
        </div>
        <CreateAdGroupDialog connectionId={connection.id} defaultOu={connection.groupsOU} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <ConnectionPicker connections={connections} selectedId={connection.id} basePath="/ad/grupos" />
        <GroupSearchForm connectionId={connection.id} defaultQuery={sp.q} />
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
            <AdGroupsTable groups={groups} connectionId={connection.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
