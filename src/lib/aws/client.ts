import "server-only";
import { EC2Client } from "@aws-sdk/client-ec2";
import { BackupClient } from "@aws-sdk/client-backup";
import { CostExplorerClient } from "@aws-sdk/client-cost-explorer";
import { InvoicingClient } from "@aws-sdk/client-invoicing";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { AwsOperationError } from "@/lib/aws/types";
import type { AwsConnectionConfig, AwsTestResult } from "@/lib/aws/types";

function credentials(config: AwsConnectionConfig) {
  return { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey };
}

export function getEc2Client(config: AwsConnectionConfig, region: string): EC2Client {
  return new EC2Client({ region, credentials: credentials(config) });
}

export function getBackupClient(config: AwsConnectionConfig, region: string): BackupClient {
  return new BackupClient({ region, credentials: credentials(config) });
}

/** Cost Explorer é um serviço global — sempre acessado via us-east-1, independente das regiões monitoradas. */
export function getCostExplorerClient(config: AwsConnectionConfig): CostExplorerClient {
  return new CostExplorerClient({ region: "us-east-1", credentials: credentials(config) });
}

export function getStsClient(config: AwsConnectionConfig): STSClient {
  return new STSClient({ region: config.defaultRegion, credentials: credentials(config) });
}

/** Invoicing é um serviço global — sempre acessado via us-east-1, como o Cost Explorer. */
export function getInvoicingClient(config: AwsConnectionConfig): InvoicingClient {
  return new InvoicingClient({ region: "us-east-1", credentials: credentials(config) });
}

/** Resolve o Account ID da credencial via STS — a Invoicing API exige o ID da conta como seletor. */
export async function getAwsAccountId(config: AwsConnectionConfig): Promise<string> {
  const sts = getStsClient(config);
  const result = await sts.send(new GetCallerIdentityCommand({}));
  if (!result.Account) throw new AwsOperationError("Não foi possível determinar o Account ID via STS.");
  return result.Account;
}

/** Descreve um erro do AWS SDK v3 de forma amigável, sem vazar detalhes internos do SDK. */
export function describeAwsError(err: unknown): string {
  if (err instanceof AwsOperationError) return err.message;
  if (err instanceof Error) {
    const name = err.name;
    if (name === "UnrecognizedClientException" || name === "InvalidClientTokenId") {
      return "Access Key inválida ou não reconhecida pela AWS.";
    }
    if (name === "SignatureDoesNotMatch") {
      return "Secret Access Key incorreta.";
    }
    if (name === "AccessDeniedException" || name === "AccessDenied") {
      return "Acesso negado — a credencial não tem permissão IAM para esta operação.";
    }
    if (name === "AuthFailure") {
      return "Falha de autenticação com a AWS — verifique as credenciais.";
    }
    return err.message;
  }
  return "Erro desconhecido ao comunicar com a AWS.";
}

export async function testAwsConnection(config: AwsConnectionConfig): Promise<AwsTestResult> {
  const start = Date.now();
  try {
    const sts = getStsClient(config);
    const result = await sts.send(new GetCallerIdentityCommand({}));
    return { success: true, latencyMs: Date.now() - start, accountId: result.Account };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - start, error: describeAwsError(err) };
  }
}
