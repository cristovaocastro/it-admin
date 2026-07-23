import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Network } from "lucide-react";
import { ConnectionPicker } from "../connection-picker";
import { TreeExplorer } from "./tree-explorer";

type SearchParams = { conexao?: string };

export default async function AdTreePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.adConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Árvore do diretório</h1>
        <Alert>
          <Network className="size-4" />
          <AlertTitle>Nenhuma conexão AD cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o Active Directory antes de navegar pela árvore.{" "}
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

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Árvore do diretório</h1>
          <p className="text-sm text-muted-foreground">Navegue pela estrutura do AD como no ADUC.</p>
        </div>
        <ConnectionPicker connections={connections} selectedId={connection.id} basePath="/ad/arvore" />
      </div>

      <TreeExplorer connectionId={connection.id} rootDn={connection.baseDN} rootLabel={connection.name} />
    </div>
  );
}
