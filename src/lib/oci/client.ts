import "server-only";
import { SimpleAuthenticationDetailsProvider, Region, OciError } from "oci-common";
import { ComputeClient, BlockstorageClient, VirtualNetworkClient } from "oci-core";
import { DatabaseClient } from "oci-database";
import { UsageapiClient } from "oci-usageapi";
import { OciOperationError } from "@/lib/oci/types";
import type { OciConnectionConfig, OciTestResult } from "@/lib/oci/types";

function authProvider(config: OciConnectionConfig): SimpleAuthenticationDetailsProvider {
  return new SimpleAuthenticationDetailsProvider(
    config.tenancyId,
    config.userId,
    config.fingerprint,
    config.privateKey,
    config.passphrase,
    Region.fromRegionId(config.defaultRegion)
  );
}

export function getComputeClient(config: OciConnectionConfig, region: string): ComputeClient {
  const client = new ComputeClient({ authenticationDetailsProvider: authProvider(config) });
  client.region = Region.fromRegionId(region);
  return client;
}

export function getBlockstorageClient(config: OciConnectionConfig, region: string): BlockstorageClient {
  const client = new BlockstorageClient({ authenticationDetailsProvider: authProvider(config) });
  client.region = Region.fromRegionId(region);
  return client;
}

export function getVirtualNetworkClient(config: OciConnectionConfig, region: string): VirtualNetworkClient {
  const client = new VirtualNetworkClient({ authenticationDetailsProvider: authProvider(config) });
  client.region = Region.fromRegionId(region);
  return client;
}

export function getDatabaseClient(config: OciConnectionConfig, region: string): DatabaseClient {
  const client = new DatabaseClient({ authenticationDetailsProvider: authProvider(config) });
  client.region = Region.fromRegionId(region);
  return client;
}

/** Usage API é consultada sempre pela região padrão — os dados de custo são tenancy-wide, não por região monitorada. */
export function getUsageapiClient(config: OciConnectionConfig): UsageapiClient {
  const client = new UsageapiClient({ authenticationDetailsProvider: authProvider(config) });
  client.region = Region.fromRegionId(config.defaultRegion);
  return client;
}

/** Descreve um erro do OCI SDK de forma amigável, sem vazar detalhes internos do SDK. */
export function describeOciError(err: unknown): string {
  if (err instanceof OciOperationError) return err.message;
  if (err instanceof OciError) {
    if (err.statusCode === 401) return "Credenciais inválidas ou não reconhecidas pela OCI (tenancy/user/fingerprint/chave).";
    if (err.statusCode === 403) return "Acesso negado — a política IAM da OCI não permite esta operação neste compartment.";
    if (err.statusCode === 404) return "Recurso não encontrado (verifique compartment/região configurados).";
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Erro desconhecido ao comunicar com a OCI.";
}

/** Testa a conexão listando 1 instância no primeiro compartment configurado, na região padrão. */
export async function testOciConnection(config: OciConnectionConfig): Promise<OciTestResult> {
  const start = Date.now();
  try {
    const compartmentId = config.compartments[0];
    if (!compartmentId) throw new OciOperationError("Informe ao menos um compartment para testar a conexão.");
    const client = getComputeClient(config, config.defaultRegion);
    await client.listInstances({ compartmentId, limit: 1 });
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - start, error: describeOciError(err) };
  }
}
