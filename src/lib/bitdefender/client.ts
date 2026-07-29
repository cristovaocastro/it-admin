import "server-only";
import { randomUUID } from "node:crypto";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import type { BitdefenderConnectionConfig, BitdefenderTestResult } from "@/lib/bitdefender/types";

export type BitdefenderService = "network" | "policies" | "quarantine" | "push" | "incidents" | "reports";

type JsonRpcError = { code: number; message: string; data?: { details?: string } };
type JsonRpcResponse<T> = { id: string; jsonrpc: "2.0"; result?: T; error?: JsonRpcError };

function jsonRpcUrl(config: BitdefenderConnectionConfig, service: BitdefenderService, version: string): string {
  const base = config.apiUrl.replace(/\/+$/, "");
  return `${base}/api/${version}/jsonrpc/${service}`;
}

function basicAuthHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`${apiKey}:`, "utf8").toString("base64");
}

/**
 * Chama um método JSON-RPC 2.0 de um serviço do GravityZone (network/policies/quarantine/push/
 * incidents/reports — cada um é um path diferente, não uma única API REST). Erros de negócio
 * vêm como `{error: {...}}` no corpo mesmo com HTTP 200, então checar `body.error` é obrigatório
 * mesmo quando o `fetch` não lançou. Nem todo método existe em toda versão — ex.:
 * `network.getManagedEndpointDetails` só responde em v1.0, dá "Method not found" em v1.1
 * (confirmado contra conta real).
 */
export async function callJsonRpc<T>(
  config: BitdefenderConnectionConfig,
  service: BitdefenderService,
  method: string,
  params: unknown = {},
  version: "v1.0" | "v1.1" = "v1.1"
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(jsonRpcUrl(config, service, version), {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(config.apiKey),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ id: randomUUID(), jsonrpc: "2.0", method, params }),
    });
  } catch (err) {
    throw new BitdefenderOperationError(describeFetchFailure(err));
  }

  if (res.status === 401) {
    throw new BitdefenderOperationError("API Key inválida ou não reconhecida pelo GravityZone.");
  }
  if (res.status === 403) {
    throw new BitdefenderOperationError(
      `Acesso negado pelo GravityZone — a API Key não tem o escopo "${service}" habilitado.`
    );
  }
  if (res.status === 404) {
    throw new BitdefenderOperationError(
      "Endpoint da API não encontrado — confira a API Base URL configurada na conexão."
    );
  }
  if (!res.ok) {
    throw new BitdefenderOperationError(`GravityZone respondeu com status ${res.status}.`);
  }

  let body: JsonRpcResponse<T>;
  try {
    body = (await res.json()) as JsonRpcResponse<T>;
  } catch {
    throw new BitdefenderOperationError("Resposta do GravityZone não é um JSON válido.");
  }

  if (body.error) {
    const base = body.error.message || `Erro JSON-RPC (código ${body.error.code}).`;
    const details = body.error.data?.details;
    throw new BitdefenderOperationError(details && details !== base ? `${base}: ${details}` : base);
  }
  return body.result as T;
}

function describeFetchFailure(err: unknown): string {
  const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined;
  switch (cause?.code) {
    case "ENOTFOUND":
      return "URL da API do GravityZone não encontrada (verifique o campo API Base URL da conexão).";
    case "ECONNREFUSED":
      return "Conexão recusada pelo GravityZone (verifique a URL/porta configuradas).";
    case "ETIMEDOUT":
      return "Tempo de conexão esgotado ao contatar o GravityZone.";
    default:
      return err instanceof Error ? err.message : "Erro desconhecido ao comunicar com o GravityZone.";
  }
}

/** Descreve um erro de operação GravityZone de forma amigável, sem vazar detalhes internos. */
export function describeBitdefenderError(err: unknown): string {
  if (err instanceof BitdefenderOperationError) return err.message;
  if (err instanceof Error) return err.message;
  return "Erro desconhecido ao comunicar com o GravityZone.";
}

/** Testa a conexão listando 1 endpoint via o serviço `network` — mesmo padrão "lista 1 recurso" usado em AWS/OCI. */
export async function testBitdefenderConnection(config: BitdefenderConnectionConfig): Promise<BitdefenderTestResult> {
  const start = Date.now();
  try {
    await callJsonRpc(config, "network", "getEndpointsList", { page: 1, perPage: 1 });
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - start, error: describeBitdefenderError(err) };
  }
}
