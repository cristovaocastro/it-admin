import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadOciConnectionConfig } from "@/lib/oci/connection";
import { getMonthlyCostEstimate, listMonthlyCostHistory } from "@/lib/oci/cost";
import { OciOperationError } from "@/lib/oci/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Cloud, TrendingDown, TrendingUp } from "lucide-react";
import { OciConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

function formatCurrency(value: number, currency: string) {
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

export default async function OciCostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.ociConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Custos OCI</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão OCI cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a OCI antes de consultar custos.{" "}
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

  let estimate: Awaited<ReturnType<typeof getMonthlyCostEstimate>> | null = null;
  let loadError: string | null = null;
  let history: Awaited<ReturnType<typeof listMonthlyCostHistory>> = [];
  let historyError: string | null = null;
  let configError: string | null = null;
  try {
    const config = await loadOciConnectionConfig(connection.id);
    try {
      estimate = await getMonthlyCostEstimate(config);
    } catch (err) {
      loadError = err instanceof OciOperationError ? err.message : "Falha ao consultar a Usage API da OCI.";
    }
    try {
      history = await listMonthlyCostHistory(config);
    } catch (err) {
      historyError = err instanceof OciOperationError ? err.message : "Falha ao consultar o histórico de custos.";
    }
  } catch (err) {
    configError = err instanceof OciOperationError ? err.message : "Falha ao carregar a conexão.";
  }

  const delta = estimate ? estimate.currentMonthTotal - estimate.previousMonthTotal : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custos OCI</h1>
        <p className="text-sm text-muted-foreground">
          Estimativa do mês corrente via Usage API — diferente do Cost Explorer da AWS, essa chamada não é cobrada
          pela OCI.
        </p>
      </div>

      <OciConnectionPicker connections={connections} selectedId={connection.id} basePath="/oci/custos" />

      {configError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao carregar a conexão</AlertTitle>
          <AlertDescription>{configError}</AlertDescription>
        </Alert>
      ) : (
        <>
          {loadError ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Erro ao consultar custos</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : (
            estimate && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">
                        Mês corrente ({estimate.currentPeriodStart} a {estimate.currentPeriodEnd})
                      </p>
                      <p className="text-3xl font-semibold">
                        {formatCurrency(estimate.currentMonthTotal, estimate.currency)}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {delta >= 0 ? (
                          <TrendingUp className="size-3.5 text-destructive" />
                        ) : (
                          <TrendingDown className="size-3.5 text-emerald-600" />
                        )}
                        {delta >= 0 ? "+" : ""}
                        {formatCurrency(delta, estimate.currency)} vs. mês anterior
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground">Mês anterior (completo)</p>
                      <p className="text-3xl font-semibold">
                        {formatCurrency(estimate.previousMonthTotal, estimate.currency)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Custo por serviço (mês corrente)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {estimate.currentMonthByService.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum custo registrado ainda neste mês.</p>
                    ) : (
                      estimate.currentMonthByService.map((s) => {
                        const pct =
                          estimate.currentMonthTotal > 0 ? (s.amount / estimate.currentMonthTotal) * 100 : 0;
                        return (
                          <div key={s.service} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{s.service}</span>
                              <span className="text-muted-foreground">
                                {formatCurrency(s.amount, estimate.currency)}
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </>
            )
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de custo (últimos 12 meses fechados)</CardTitle>
            </CardHeader>
            <CardContent className={historyError ? undefined : "p-0"}>
              {historyError ? (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{historyError}</AlertDescription>
                </Alert>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Total consumido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow key={h.month}>
                          <TableCell className="font-medium">{h.month}</TableCell>
                          <TableCell className="text-right">{formatCurrency(h.total, h.currency)}</TableCell>
                        </TableRow>
                      ))}
                      {history.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
                            Nenhum custo registrado nos últimos 12 meses.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                    A OCI não expõe uma API pública de faturas fechadas como a AWS — este é o total de consumo
                    (Usage API) de cada mês já encerrado, o equivalente prático a uma fatura.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
