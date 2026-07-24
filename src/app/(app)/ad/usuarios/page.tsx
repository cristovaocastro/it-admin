import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import { searchAdUsers } from "@/lib/ad/users";
import { AdOperationError } from "@/lib/ad/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Network } from "lucide-react";
import Link from "next/link";
import { ConnectionPicker } from "../connection-picker";
import { UserSearchForm } from "./user-search-form";
import { AdUsersTable } from "./ad-users-table";
import { CreateAdUserDialog } from "./create-ad-user-dialog";

type SearchParams = { conexao?: string; q?: string; acesso?: string };

const LAST_LOGON_FILTERS: Record<string, "never" | number> = {
  nunca: "never",
  "30": 30,
  "60": 60,
  "90": 90,
  "180": 180,
};

export default async function AdUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.adConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários AD</h1>
        <Alert>
          <Network className="size-4" />
          <AlertTitle>Nenhuma conexão AD cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o Active Directory antes de gerenciar usuários.{" "}
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

  let users: Awaited<ReturnType<typeof searchAdUsers>> = [];
  let searchError: string | null = null;
  try {
    const config = await loadAdConnectionConfig(connection.id);
    const lastLogon = sp.acesso ? LAST_LOGON_FILTERS[sp.acesso] : undefined;
    users = await searchAdUsers(config, { query: sp.q, lastLogon });
  } catch (err) {
    searchError = err instanceof AdOperationError ? err.message : "Falha ao consultar o Active Directory.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários AD</h1>
          <p className="text-sm text-muted-foreground">Gerencie contas do Active Directory em tempo real.</p>
        </div>
        <CreateAdUserDialog connectionId={connection.id} defaultOu={connection.usersOU} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <ConnectionPicker connections={connections} selectedId={connection.id} basePath="/ad/usuarios" />
        <UserSearchForm connectionId={connection.id} defaultQuery={sp.q} defaultLastLogon={sp.acesso} />
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
            <AdUsersTable users={users} connectionId={connection.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
