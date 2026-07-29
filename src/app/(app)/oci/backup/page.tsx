import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadOciConnectionConfig } from "@/lib/oci/connection";
import { listOciBackups } from "@/lib/oci/backup";
import { OciOperationError } from "@/lib/oci/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Cloud } from "lucide-react";
import { OciConnectionPicker } from "../connection-picker";
import { BackupsExplorer } from "./backups-explorer";

type SearchParams = { conexao?: string };

export default async function OciBackupPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.ociConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Backup OCI</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão OCI cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a OCI antes de consultar backups.{" "}
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

  let backups: Awaited<ReturnType<typeof listOciBackups>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadOciConnectionConfig(connection.id);
    backups = await listOciBackups(config);
  } catch (err) {
    loadError = err instanceof OciOperationError ? err.message : "Falha ao consultar a OCI.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Backup OCI</h1>
        <p className="text-sm text-muted-foreground">
          Backups de volumes, boot volumes, DB Systems e Autonomous Databases nas regiões/compartments monitorados.
        </p>
      </div>

      <OciConnectionPicker connections={connections} selectedId={connection.id} basePath="/oci/backup" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a OCI</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <BackupsExplorer backups={backups} />
      )}
    </div>
  );
}
