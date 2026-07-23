import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadFirewallConnectionConfig } from "@/lib/firewall/connection";
import { getUriListObject } from "@/lib/firewall/uri-lists";
import { FirewallOperationError } from "@/lib/firewall/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { EntriesManager } from "./entries-manager";

type SearchParams = { conexao?: string };

export default async function UriListObjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const { uuid } = await params;
  const sp = await searchParams;

  if (!sp.conexao) notFound();
  const connection = await db.firewallConnection.findUnique({ where: { id: sp.conexao } });
  if (!connection) notFound();

  let object: Awaited<ReturnType<typeof getUriListObject>> = null;
  let loadError: string | null = null;
  try {
    const config = await loadFirewallConnectionConfig(connection.id);
    object = await getUriListObject(config, uuid);
  } catch (err) {
    loadError = err instanceof FirewallOperationError ? err.message : "Falha ao consultar o firewall.";
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/firewall/uri-lists?conexao=${connection.id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar para URI Lists
        </Link>
        {object && <h1 className="text-2xl font-semibold tracking-tight">{object.name}</h1>}
        <p className="text-sm text-muted-foreground">Conexão: {connection.name}</p>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o firewall</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : !object ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>URI list não encontrada</AlertTitle>
          <AlertDescription>Ela pode ter sido excluída no firewall.</AlertDescription>
        </Alert>
      ) : (
        <EntriesManager connectionId={connection.id} object={object} />
      )}
    </div>
  );
}
