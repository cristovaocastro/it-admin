import "server-only";
import { GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";
import { getCostExplorerClient } from "@/lib/aws/client";
import type { AwsConnectionConfig } from "@/lib/aws/types";

export type AwsCostByService = { service: string; amountUsd: number };

export type AwsMonthlyCostEstimate = {
  currentMonthTotalUsd: number;
  previousMonthTotalUsd: number;
  currentMonthByService: AwsCostByService[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Custo do mês corrente (até hoje) e do mês anterior via Cost Explorer, agrupado por serviço.
 * Chamada cobrada pela AWS (~US$0,01/requisição) — usar só sob demanda, nunca em todo carregamento do dashboard.
 */
export async function getMonthlyCostEstimate(config: AwsConnectionConfig, topN = 8): Promise<AwsMonthlyCostEstimate> {
  const client = getCostExplorerClient(config);
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const [currentResult, previousResult] = await Promise.all([
    client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(startOfThisMonth), End: ymd(tomorrow) },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      })
    ),
    client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: ymd(startOfPrevMonth), End: ymd(startOfThisMonth) },
        Granularity: "MONTHLY",
        Metrics: ["UnblendedCost"],
      })
    ),
  ]);

  const currentByTime = currentResult.ResultsByTime?.[0];
  const currentMonthByService: AwsCostByService[] = (currentByTime?.Groups ?? [])
    .map((g) => ({
      service: g.Keys?.[0] ?? "Outro",
      amountUsd: parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0"),
    }))
    .filter((s) => s.amountUsd > 0)
    .sort((a, b) => b.amountUsd - a.amountUsd);

  const currentMonthTotalUsd =
    parseFloat(currentByTime?.Total?.UnblendedCost?.Amount ?? "0") ||
    currentMonthByService.reduce((sum, s) => sum + s.amountUsd, 0);

  const previousMonthTotalUsd = parseFloat(previousResult.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount ?? "0");

  return {
    currentMonthTotalUsd,
    previousMonthTotalUsd,
    currentMonthByService: currentMonthByService.slice(0, topN),
    currentPeriodStart: ymd(startOfThisMonth),
    currentPeriodEnd: ymd(now),
  };
}
