import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAwsConnectionConfig } from "@/lib/aws/connection";
import { listRecentBackupJobs, listBackupVaultsAndPlans } from "@/lib/aws/backup";
import { AwsOperationError } from "@/lib/aws/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Cloud } from "lucide-react";
import { AwsConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  COMPLETED: "secondary",
  RUNNING: "outline",
  PENDING: "outline",
  CREATED: "outline",
  FAILED: "destructive",
  ABORTED: "destructive",
  EXPIRED: "destructive",
  PARTIAL: "destructive",
};

export default async function AwsBackupPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.awsConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">AWS Backup</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão AWS cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a AWS antes de consultar o Backup.{" "}
            <Link href="/aws/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let jobs: Awaited<ReturnType<typeof listRecentBackupJobs>> = [];
  let vaultsAndPlans: Awaited<ReturnType<typeof listBackupVaultsAndPlans>> = { vaults: [], plans: [] };
  let loadError: string | null = null;
  try {
    const config = await loadAwsConnectionConfig(connection.id);
    [jobs, vaultsAndPlans] = await Promise.all([listRecentBackupJobs(config, 7), listBackupVaultsAndPlans(config)]);
  } catch (err) {
    loadError = err instanceof AwsOperationError ? err.message : "Falha ao consultar a AWS.";
  }

  const failed = jobs.filter((j) => j.state === "FAILED" || j.state === "ABORTED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AWS Backup</h1>
        <p className="text-sm text-muted-foreground">Cofres, planos e jobs recentes (últimos 7 dias).</p>
      </div>

      <AwsConnectionPicker connections={connections} selectedId={connection.id} basePath="/aws/backup" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a AWS</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <>
          {failed > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>{failed} job(s) de backup com falha nos últimos 7 dias</AlertTitle>
              <AlertDescription>Verifique a tabela abaixo para identificar os recursos afetados.</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cofres ({vaultsAndPlans.vaults.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {vaultsAndPlans.vaults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum cofre encontrado.</p>
                ) : (
                  vaultsAndPlans.vaults.map((v) => (
                    <div key={`${v.region}-${v.name}`} className="flex items-center justify-between text-sm">
                      <span>
                        {v.name} <span className="text-xs text-muted-foreground">({v.region})</span>
                      </span>
                      <span className="text-muted-foreground">{v.recoveryPoints} ponto(s)</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Planos ({vaultsAndPlans.plans.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {vaultsAndPlans.plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum plano encontrado.</p>
                ) : (
                  vaultsAndPlans.plans.map((p) => (
                    <div key={`${p.region}-${p.id}`} className="text-sm">
                      {p.name} <span className="text-xs text-muted-foreground">({p.region})</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs recentes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Cofre</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.jobId}>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground" title={j.resourceArn}>
                        {j.resourceType ?? "—"}
                        {j.resourceArn && <div className="truncate text-xs">{j.resourceArn}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{j.vaultName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{j.region}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {j.creationDate ? new Date(j.creationDate).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATE_VARIANT[j.state] ?? "outline"} title={j.statusMessage}>
                          {j.state}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nenhum job de backup nos últimos 7 dias.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
