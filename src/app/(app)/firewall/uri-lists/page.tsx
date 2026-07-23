import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadFirewallConnectionConfig } from "@/lib/firewall/connection";
import { listUriListsAndGroups } from "@/lib/firewall/uri-lists";
import { FirewallOperationError } from "@/lib/firewall/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Flame } from "lucide-react";
import Link from "next/link";
import { FirewallConnectionPicker } from "../connection-picker";
import { UriListsTable } from "./uri-lists-table";
import { UriListGroupsTable } from "./uri-list-groups-table";
import { CreateUriListObjectDialog } from "./uri-list-object-dialog";
import { CreateUriListGroupDialog } from "./uri-list-group-dialog";

type SearchParams = { conexao?: string };

export default async function FirewallUriListsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.firewallConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">URI Lists</h1>
        <Alert>
          <Flame className="size-4" />
          <AlertTitle>Nenhuma conexão de firewall cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o firewall antes de gerenciar URI lists.{" "}
            <Link href="/firewall/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let objects: Awaited<ReturnType<typeof listUriListsAndGroups>>["objects"] = [];
  let groups: Awaited<ReturnType<typeof listUriListsAndGroups>>["groups"] = [];
  let loadError: string | null = null;
  try {
    const config = await loadFirewallConnectionConfig(connection.id);
    ({ objects, groups } = await listUriListsAndGroups(config));
  } catch (err) {
    loadError = err instanceof FirewallOperationError ? err.message : "Falha ao consultar o firewall.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">URI Lists</h1>
        <p className="text-sm text-muted-foreground">Gerencie URI lists e grupos de content filter no firewall.</p>
      </div>

      <FirewallConnectionPicker connections={connections} selectedId={connection.id} basePath="/firewall/uri-lists" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o firewall</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">URI lists</CardTitle>
              <CreateUriListObjectDialog connectionId={connection.id} />
            </CardHeader>
            <CardContent className="p-0">
              <UriListsTable objects={objects} connectionId={connection.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Grupos de URI list</CardTitle>
              <CreateUriListGroupDialog connectionId={connection.id} />
            </CardHeader>
            <CardContent className="p-0">
              <UriListGroupsTable groups={groups} connectionId={connection.id} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
