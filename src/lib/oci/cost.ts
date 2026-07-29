import "server-only";
import { models } from "oci-usageapi";
import { getUsageapiClient } from "@/lib/oci/client";
import { toIsoString } from "@/lib/oci/types";
import type { OciConnectionConfig } from "@/lib/oci/types";

export type OciCostByService = { service: string; amount: number };

export type OciMonthlyCostEstimate = {
  currentMonthTotal: number;
  previousMonthTotal: number;
  currentMonthByService: OciCostByService[];
  currentPeriodStart: string;
  currentPeriodEnd: string;
  currency: string;
};

export type OciMonthlyCostHistoryEntry = { month: string; total: number; currency: string };

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A Usage API exige `timeUsageStarted`/`timeUsageEnded` truncados à meia-noite UTC (sem hora/minuto/segundo). */
function utcMidnight(d: Date, dayOffset = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dayOffset));
}

/**
 * Custo do mês corrente (até hoje) e do mês anterior via Usage API, agrupado por serviço.
 * Ao contrário do Cost Explorer da AWS, a Usage API da OCI não é cobrada por chamada.
 */
export async function getMonthlyCostEstimate(config: OciConnectionConfig, topN = 8): Promise<OciMonthlyCostEstimate> {
  const client = getUsageapiClient(config);
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const tomorrow = utcMidnight(now, 1);

  const [currentResult, previousResult] = await Promise.all([
    client.requestSummarizedUsages({
      requestSummarizedUsagesDetails: {
        tenantId: config.tenancyId,
        timeUsageStarted: startOfThisMonth,
        timeUsageEnded: tomorrow,
        granularity: models.RequestSummarizedUsagesDetails.Granularity.Monthly,
        isAggregateByTime: true,
        queryType: models.RequestSummarizedUsagesDetails.QueryType.Cost,
        groupBy: ["service"],
      },
    }),
    client.requestSummarizedUsages({
      requestSummarizedUsagesDetails: {
        tenantId: config.tenancyId,
        timeUsageStarted: startOfPrevMonth,
        timeUsageEnded: startOfThisMonth,
        granularity: models.RequestSummarizedUsagesDetails.Granularity.Monthly,
        isAggregateByTime: true,
        queryType: models.RequestSummarizedUsagesDetails.QueryType.Cost,
      },
    }),
  ]);

  const currentItems = currentResult.usageAggregation.items ?? [];
  const currentMonthByService: OciCostByService[] = currentItems
    .map((i) => ({ service: i.service ?? "Outro", amount: i.computedAmount ?? 0 }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const currentMonthTotal = currentMonthByService.reduce((sum, s) => sum + s.amount, 0);
  const previousMonthTotal = (previousResult.usageAggregation.items ?? []).reduce(
    (sum, i) => sum + (i.computedAmount ?? 0),
    0
  );
  const currency = currentItems[0]?.currency ?? "USD";

  return {
    currentMonthTotal,
    previousMonthTotal,
    currentMonthByService: currentMonthByService.slice(0, topN),
    currentPeriodStart: ymd(startOfThisMonth),
    currentPeriodEnd: ymd(now),
    currency,
  };
}

/**
 * Histórico de custo dos últimos `months` meses **fechados** (exclui o mês corrente, ainda em
 * andamento — esse já aparece em `getMonthlyCostEstimate`), tenancy-wide. A OCI não expõe uma API
 * pública de faturas fechadas (diferente da AWS Invoicing API) — isso funciona como o
 * equivalente prático: o total consumido em cada mês já encerrado. A Usage API limita o
 * intervalo da consulta a 366 dias, por isso o corte é sempre no início do mês corrente.
 */
export async function listMonthlyCostHistory(
  config: OciConnectionConfig,
  months = 12
): Promise<OciMonthlyCostHistoryEntry[]> {
  const client = getUsageapiClient(config);
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  const end = startOfThisMonth;

  const result = await client.requestSummarizedUsages({
    requestSummarizedUsagesDetails: {
      tenantId: config.tenancyId,
      timeUsageStarted: start,
      timeUsageEnded: end,
      granularity: models.RequestSummarizedUsagesDetails.Granularity.Monthly,
      isAggregateByTime: false,
      queryType: models.RequestSummarizedUsagesDetails.QueryType.Cost,
    },
  });

  // Alguns itens de uso vêm com `currency` em branco (linhas de crédito/cortesia) — só travamos o
  // valor do mês no primeiro item que traga uma moeda de verdade, em vez do primeiro item da lista.
  const byMonth = new Map<string, { total: number; currency?: string }>();
  for (const item of result.usageAggregation.items ?? []) {
    const iso = toIsoString(item.timeUsageStarted);
    if (!iso) continue;
    const month = iso.slice(0, 7); // "2026-06"
    const entry = byMonth.get(month) ?? { total: 0, currency: undefined };
    entry.total += item.computedAmount ?? 0;
    const itemCurrency = item.currency?.trim();
    if (itemCurrency && !entry.currency) entry.currency = itemCurrency;
    byMonth.set(month, entry);
  }

  return Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, total: v.total, currency: v.currency ?? "USD" }))
    .sort((a, b) => b.month.localeCompare(a.month));
}
