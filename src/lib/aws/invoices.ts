import "server-only";
import { ListInvoiceSummariesCommand } from "@aws-sdk/client-invoicing";
import { getInvoicingClient, getAwsAccountId } from "@/lib/aws/client";
import type { AwsConnectionConfig } from "@/lib/aws/types";

export type AwsInvoice = {
  invoiceId: string;
  billingPeriod: string; // "2026-06"
  issuedDate?: string;
  dueDate?: string;
  totalAmount?: number;
  currency?: string;
  invoiceType?: string; // INVOICE | CREDIT_MEMO | PAYMENT_RECEIPT
  /** IDs de documentos fiscais vinculados a esta fatura comercial (ex: nota fiscal eletrônica
   *  obrigatória no Brasil, formato "EINBR..."). A Invoicing API retorna esses documentos como
   *  registros separados, cada um com `CommercialInvoiceId` apontando de volta para esta fatura —
   *  já mesclamos aqui para não exibir "duplicatas" do mesmo período de cobrança. */
  linkedTaxDocumentIds?: string[];
};

/**
 * Lista as faturas fechadas emitidas para a conta nos últimos `months` meses — o histórico real
 * de faturamento (não uma estimativa como o Cost Explorer). Só funciona para contas que recebem
 * fatura diretamente (conta de pagamento/standalone); contas-membro de uma Organization sem
 * faturamento próprio não têm faturas para listar.
 *
 * A Invoicing API rejeita `Filter.TimeInterval` com mais de 1 mês ("TimePeriod cannot last more
 * than a month"), então consultamos por `Filter.BillingPeriod` (mês/ano exatos), um mês por vez.
 */
type RawInvoice = AwsInvoice & { commercialInvoiceId?: string };

export async function listAwsInvoices(config: AwsConnectionConfig, months = 12): Promise<AwsInvoice[]> {
  const accountId = await getAwsAccountId(config);
  const client = getInvoicingClient(config);
  const now = new Date();

  const perMonth = await Promise.all(
    Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      return { Month: d.getUTCMonth() + 1, Year: d.getUTCFullYear() };
    }).map(async (billingPeriod) => {
      const invoices: RawInvoice[] = [];
      let nextToken: string | undefined;
      do {
        const result = await client.send(
          new ListInvoiceSummariesCommand({
            Selector: { ResourceType: "ACCOUNT_ID", Value: accountId },
            Filter: { BillingPeriod: billingPeriod },
            NextToken: nextToken,
          })
        );
        for (const inv of result.InvoiceSummaries ?? []) {
          if (!inv.InvoiceId) continue;
          invoices.push({
            invoiceId: inv.InvoiceId,
            billingPeriod: inv.BillingPeriod
              ? `${inv.BillingPeriod.Year}-${String(inv.BillingPeriod.Month).padStart(2, "0")}`
              : `${billingPeriod.Year}-${String(billingPeriod.Month).padStart(2, "0")}`,
            issuedDate: inv.IssuedDate?.toISOString(),
            dueDate: inv.DueDate?.toISOString(),
            totalAmount: inv.BaseCurrencyAmount?.TotalAmount
              ? parseFloat(inv.BaseCurrencyAmount.TotalAmount)
              : undefined,
            currency: inv.BaseCurrencyAmount?.CurrencyCode,
            invoiceType: inv.InvoiceType,
            commercialInvoiceId: inv.CommercialInvoiceId,
          });
        }
        nextToken = result.NextToken;
      } while (nextToken);
      return invoices;
    })
  );

  const all = perMonth.flat();

  // Documentos fiscais (ex: nota fiscal eletrônica obrigatória no Brasil) vêm como registros
  // separados, cada um com `commercialInvoiceId` apontando para a fatura comercial correspondente.
  // Mesclamos aqui em vez de exibir como linhas "duplicadas" do mesmo período de cobrança.
  const commercialIds = new Set(all.map((inv) => inv.invoiceId));
  const linkedByCommercialId = new Map<string, string[]>();
  for (const inv of all) {
    if (!inv.commercialInvoiceId) continue;
    const list = linkedByCommercialId.get(inv.commercialInvoiceId) ?? [];
    list.push(inv.invoiceId);
    linkedByCommercialId.set(inv.commercialInvoiceId, list);
  }

  return all
    // um documento fiscal cujo `commercialInvoiceId` aponta para uma fatura que também está na
    // lista é linkado a ela e escondido como linha própria; caso contrário (órfão), mantemos
    // visível para não perder informação.
    .filter((inv) => !(inv.commercialInvoiceId && commercialIds.has(inv.commercialInvoiceId)))
    .map(
      (inv): AwsInvoice => ({
        invoiceId: inv.invoiceId,
        billingPeriod: inv.billingPeriod,
        issuedDate: inv.issuedDate,
        dueDate: inv.dueDate,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
        invoiceType: inv.invoiceType,
        linkedTaxDocumentIds: linkedByCommercialId.get(inv.invoiceId),
      })
    )
    .sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod));
}
