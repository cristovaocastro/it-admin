import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAwsConnectionConfig } from "@/lib/aws/connection";
import { getMonthlyCostEstimate } from "@/lib/aws/cost";
import { AwsOperationError } from "@/lib/aws/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Cloud, TrendingDown, TrendingUp } from "lucide-react";
import { AwsConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

export default async function AwsCostsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.awsConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Custos AWS</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão AWS cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a AWS antes de consultar custos.{" "}
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

  let estimate: Awaited<ReturnType<typeof getMonthlyCostEstimate>> | null = null;
  let loadError: string | null = null;
  try {
    const config = await loadAwsConnectionConfig(connection.id);
    estimate = await getMonthlyCostEstimate(config);
  } catch (err) {
    loadError =
      err instanceof AwsOperationError
        ? err.message
        : "Falha ao consultar o Cost Explorer (verifique se está habilitado na conta).";
  }

  const delta = estimate ? estimate.currentMonthTotalUsd - estimate.previousMonthTotalUsd : 0;
  const formatUsd = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custos AWS</h1>
        <p className="text-sm text-muted-foreground">
          Estimativa do mês corrente via Cost Explorer. Buscado sob demanda (chamada cobrada pela AWS).
        </p>
      </div>

      <AwsConnectionPicker connections={connections} selectedId={connection.id} basePath="/aws/custos" />

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
                  <p className="text-3xl font-semibold">{formatUsd(estimate.currentMonthTotalUsd)}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {delta >= 0 ? (
                      <TrendingUp className="size-3.5 text-destructive" />
                    ) : (
                      <TrendingDown className="size-3.5 text-emerald-600" />
                    )}
                    {delta >= 0 ? "+" : ""}
                    {formatUsd(delta)} vs. mês anterior
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Mês anterior (completo)</p>
                  <p className="text-3xl font-semibold">{formatUsd(estimate.previousMonthTotalUsd)}</p>
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
                      estimate.currentMonthTotalUsd > 0 ? (s.amountUsd / estimate.currentMonthTotalUsd) * 100 : 0;
                    return (
                      <div key={s.service} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{s.service}</span>
                          <span className="text-muted-foreground">{formatUsd(s.amountUsd)}</span>
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
    </div>
  );
}
