import "server-only";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink, writeFile } from "node:fs/promises";
import { FirewallOperationError } from "@/lib/firewall/types";
import type { FirewallConnectionConfig, FirewallTestResult } from "@/lib/firewall/types";

// Usa o binário `curl` como transporte HTTP (via child_process) para lidar com TLS/HTTP de forma
// robusta, mas SEM o modo `--digest` automático do curl: para requisições com corpo, o curl manda
// a primeira tentativa (não autenticada) com corpo VAZIO como otimização (só reenvia o corpo de
// verdade na tentativa autenticada) — e o SonicOS valida "tem corpo?" ANTES de checar autenticação
// em endpoints de escrita, rejeitando essa primeira tentativa com 400 antes mesmo de chegar a um
// 401 (que é o único status que faz o curl tentar de novo). Por isso o desafio/resposta Digest é
// feito manualmente aqui, sempre enviando o corpo completo em toda tentativa.

type CurlResult = { status: number; headers: string[]; body: string };

function curlConfigEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// --- RFC-7616 Digest Authentication (manual, ver nota acima sobre por que não usamos --digest) -

type DigestChallenge = {
  scheme: "digest";
  algorithm: "SHA-256" | "MD5";
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
};
type BasicChallenge = { scheme: "basic" };
type Challenge = DigestChallenge | BasicChallenge;

function getRawHeaderValues(headers: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < headers.length; i += 2) {
    if (headers[i].toLowerCase() === name.toLowerCase()) values.push(headers[i + 1]);
  }
  return values;
}

function parseChallengeParams(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    params[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3];
  }
  return params;
}

function parseWwwAuthenticateChallenges(headers: string[]): Challenge[] {
  const challenges: Challenge[] = [];
  for (const raw of getRawHeaderValues(headers, "www-authenticate")) {
    const scheme = raw.split(" ")[0]?.toLowerCase();
    if (scheme === "digest") {
      const params = parseChallengeParams(raw.slice(raw.indexOf(" ") + 1));
      const algorithm = (params.algorithm ?? "MD5").toUpperCase();
      if (algorithm !== "SHA-256" && algorithm !== "MD5") continue;
      if (!params.realm || !params.nonce) continue;
      challenges.push({ scheme: "digest", algorithm, realm: params.realm, nonce: params.nonce, qop: params.qop, opaque: params.opaque });
    } else if (scheme === "basic") {
      challenges.push({ scheme: "basic" });
    }
  }
  return challenges;
}

function pickBestChallenge(challenges: Challenge[]): Challenge | undefined {
  return (
    challenges.find((c) => c.scheme === "digest" && c.algorithm === "SHA-256") ??
    challenges.find((c) => c.scheme === "digest" && c.algorithm === "MD5") ??
    challenges.find((c) => c.scheme === "basic")
  );
}

function digestHash(algorithm: "SHA-256" | "MD5", value: string): string {
  return createHash(algorithm === "SHA-256" ? "sha256" : "md5").update(value, "utf8").digest("hex");
}

function basicAuthHeader(username: string, password: string): string {
  return "Basic " + Buffer.from(`${username}:${password}`, "utf8").toString("base64");
}

function buildAuthorizationHeader(
  challenge: Challenge,
  username: string,
  password: string,
  method: string,
  uri: string
): string {
  if (challenge.scheme === "basic") return basicAuthHeader(username, password);

  const ha1 = digestHash(challenge.algorithm, `${username}:${challenge.realm}:${password}`);
  const ha2 = digestHash(challenge.algorithm, `${method}:${uri}`);
  const cnonce = randomUUID().replace(/-/g, "");
  const nc = "00000001";
  const qop = challenge.qop?.split(",")[0]?.trim();
  const responseInput = qop
    ? `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`
    : `${ha1}:${challenge.nonce}:${ha2}`;
  const response = digestHash(challenge.algorithm, responseInput);

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `algorithm=${challenge.algorithm}`,
    `response="${response}"`,
  ];
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  return `Digest ${parts.join(", ")}`;
}

function runCurl(configText: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("curl", ["-K", "-"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
    proc.stdin.write(configText);
    proc.stdin.end();
  });
}

/** Extrai o ÚLTIMO bloco de resposta HTTP da saída `-i`/`include` do curl (pode haver mais de um em redirecionamentos/retentativas de auth). */
function parseCurlOutput(stdout: string): CurlResult {
  const statusLineRe = /^HTTP\/\d(?:\.\d)? (\d{3})/;
  const lines = stdout.split(/\r\n|\n/);
  let lastStatusIdx = -1;
  let lastStatus = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = statusLineRe.exec(lines[i]);
    if (m) {
      lastStatusIdx = i;
      lastStatus = Number(m[1]);
    }
  }
  if (lastStatusIdx === -1) {
    return { status: 0, headers: [], body: stdout };
  }
  const headers: string[] = [];
  let i = lastStatusIdx + 1;
  for (; i < lines.length; i++) {
    if (lines[i] === "") {
      i++;
      break;
    }
    const idx = lines[i].indexOf(":");
    if (idx > 0) {
      headers.push(lines[i].slice(0, idx).trim(), lines[i].slice(idx + 1).trim());
    }
  }
  const body = lines.slice(i).join("\n").trim();
  return { status: lastStatus, headers, body };
}

function describeCurlError(code: number, stderr: string): string {
  switch (code) {
    case 6:
      return "Host do firewall não encontrado (verifique o DNS/host informado).";
    case 7:
      return "Conexão recusada pelo firewall (host/porta incorretos ou API desligada).";
    case 28:
      return "Tempo de conexão esgotado ao contatar o firewall.";
    case 35:
    case 60:
      return "Certificado TLS do firewall não é confiável (self-signed). Desative a validação de certificado se for esperado.";
    default:
      return stderr.trim() || `Falha ao executar a requisição ao firewall (curl código ${code}).`;
  }
}

// --- Erros -------------------------------------------------------------------------------------

function getHeaderValue(headers: string[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  for (let i = 0; i < headers.length; i += 2) {
    if (headers[i].toLowerCase() === name.toLowerCase()) return headers[i + 1];
  }
  return undefined;
}

/** Traduz status HTTP + corpo de erro da API do SonicOS para uma mensagem legível. */
export function describeFirewallError(status: number, body: string, headers?: string[]): string {
  let apiMessage: string | undefined;
  try {
    const parsed = JSON.parse(body) as { status?: { info?: { message?: string }[] } };
    apiMessage = parsed.status?.info?.map((i) => i.message).find(Boolean);
  } catch {
    // corpo não é JSON (ex: texto simples de erro) — ignora, usa mensagem genérica por status
  }

  // O SonicOS sempre se identifica como "Server: Web Server" e devolve JSON. Um 403 com outro
  // Server header (ex: "Apache") e corpo minúsculo/vazio é quase sempre um WAF/proteção anti-flood
  // na frente do aparelho bloqueando a requisição antes dela chegar no SonicOS — não é uma
  // resposta real da API, e reinsistir só piora um eventual bloqueio temporário.
  const serverHeader = getHeaderValue(headers, "server");
  if (status === 403 && serverHeader && !serverHeader.toLowerCase().includes("web server")) {
    return `O firewall recusou a conexão antes mesmo de chegar na API do SonicOS (resposta veio de "${serverHeader}", não do SonicOS) — provavelmente alguma proteção anti-flood/WAF na frente do aparelho bloqueou por excesso de tentativas recentes. Aguarde alguns minutos antes de testar de novo e evite testar repetidamente em sequência.`;
  }

  switch (status) {
    case 400:
      return `Requisição inválida rejeitada pelo firewall.${apiMessage ? ` ${apiMessage}` : ""}`;
    case 401:
      return apiMessage ? `Usuário ou senha do firewall inválidos: ${apiMessage}` : "Usuário ou senha do firewall inválidos.";
    case 403:
      return `Acesso negado pelo firewall.${apiMessage ? ` ${apiMessage}` : " Verifique se a API do SonicOS está habilitada (Manage > System Setup > Appliance > Base Settings), se o usuário tem privilégio de administrador completo, e se a conta não está bloqueada por tentativas de login."}`;
    case 404:
      return "Recurso não encontrado no firewall.";
    case 405:
      return "Operação não permitida nesse recurso do firewall.";
    case 406:
      return "Tipo de conteúdo não aceito pelo firewall.";
    case 413:
      return "Corpo da requisição excede o tamanho máximo aceito pelo firewall.";
    case 414:
      return "URL da requisição excede o tamanho máximo aceito pelo firewall.";
    case 500:
      return `Erro interno do firewall ao processar a requisição.${apiMessage ? ` ${apiMessage}` : ""}`;
    case 503:
      return "Número máximo de sessões da API do firewall excedido (só um admin pode usar a API por vez) — tente novamente em instantes.";
    default:
      return apiMessage ?? `Firewall respondeu com status ${status}.`;
  }
}

// --- Sessão --------------------------------------------------------------------------------------

export type FirewallSessionContext = {
  /** Executa uma chamada autenticada contra a API do SonicOS; lança FirewallOperationError em caso de erro HTTP. */
  request: <T = unknown>(method: string, path: string, body?: unknown) => Promise<T | undefined>;
};

export type FirewallApiStatus = {
  status?: {
    success?: boolean;
    info?: { level?: string; code?: string; message?: string }[];
  };
};

/** Lança FirewallOperationError se a resposta indicar falha mesmo com HTTP 2xx (ex: erro de validação). */
export function assertApiSuccess(result: FirewallApiStatus | undefined): void {
  if (result?.status && result.status.success === false) {
    const message = result.status.info?.map((i) => i.message).filter(Boolean).join(" ") || "Falha ao aplicar a alteração no firewall.";
    throw new FirewallOperationError(message);
  }
}

/**
 * Grava (commit) as mudanças pendentes — POST/PUT/DELETE no SonicOS ficam só "staged" até isso ser
 * chamado (mesmo comportamento do `commit` no CLI). Sem isso, a alteração é descartada ao deslogar.
 */
export async function commitPendingChanges(ctx: FirewallSessionContext): Promise<void> {
  const result = await ctx.request<FirewallApiStatus>("POST", "/api/sonicos/config/pending");
  assertApiSuccess(result);
}

const AUTH_PATH = "/api/sonicos/auth";

// Fila por conexão (host:port) — a API do SonicOS só aceita UMA sessão de admin por vez, então duas
// chamadas concorrentes para a MESMA conexão (ex: duas telas carregando dados em paralelo via
// Promise.all) precisam ser serializadas aqui, nunca abertas ao mesmo tempo.
const sessionQueues = new Map<string, Promise<unknown>>();

function connectionKey(config: FirewallConnectionConfig): string {
  return config.id ?? `${config.host}:${config.port}`;
}

/**
 * Abre uma sessão autenticada no firewall, executa `fn` e garante logout ao final (sucesso ou erro).
 * A API do SonicOS só permite UMA sessão de administrador por vez — nunca deixe uma pendurada, ou
 * trava o acesso de quem usa a interface web/CLI do próprio firewall. Chamadas concorrentes para a
 * mesma conexão são automaticamente enfileiradas (ver `sessionQueues` acima).
 */
export async function withFirewallSession<T>(
  config: FirewallConnectionConfig,
  fn: (ctx: FirewallSessionContext) => Promise<T>
): Promise<T> {
  const key = connectionKey(config);
  const prior = sessionQueues.get(key) ?? Promise.resolve();
  const run = prior.then(
    () => runFirewallSession(config, fn),
    () => runFirewallSession(config, fn)
  );
  sessionQueues.set(
    key,
    run.catch(() => undefined)
  );
  return run;
}

async function runFirewallSession<T>(
  config: FirewallConnectionConfig,
  fn: (ctx: FirewallSessionContext) => Promise<T>
): Promise<T> {
  const cookieJar = join(tmpdir(), `fw-cookies-${randomUUID()}.txt`);

  /** Uma tentativa HTTP crua via curl, com os headers exatos passados (sem negociação de auth do curl). */
  async function curlAttempt(
    method: string,
    path: string,
    headers: Record<string, string>,
    bodyFile?: string
  ): Promise<CurlResult> {
    const url = `https://${config.host}:${config.port}${path}`;
    const lines = [
      "silent",
      "show-error",
      "include",
      'connect-timeout = "10"',
      'max-time = "20"',
      ...(config.rejectUnauthorized ? [] : ["insecure"]),
      `cookie-jar = "${curlConfigEscape(cookieJar)}"`,
      `cookie = "${curlConfigEscape(cookieJar)}"`,
      `request = "${method}"`,
      `url = "${curlConfigEscape(url)}"`,
      ...Object.entries(headers).map(([k, v]) => `header = "${curlConfigEscape(k)}: ${curlConfigEscape(v)}"`),
    ];
    if (bodyFile !== undefined) {
      lines.push(`data-binary = "@${curlConfigEscape(bodyFile)}"`);
    }

    const { stdout, stderr, code } = await runCurl(lines.join("\n") + "\n");
    if (code !== 0) {
      throw new FirewallOperationError(describeCurlError(code, stderr));
    }
    return parseCurlOutput(stdout);
  }

  /**
   * Desafio/resposta Digest manual (ver nota no topo do arquivo): a primeira tentativa já leva o
   * corpo completo (se houver), nunca vazio — o SonicOS rejeita corpo ausente antes mesmo de
   * checar autenticação em endpoints de escrita, o que quebraria o modo `--digest` do curl.
   */
  async function curlRequest(method: string, path: string, body?: unknown): Promise<CurlResult> {
    const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
    // Corpos grandes (URI lists extensas) via -K/stdin podem estourar o limite de tamanho de
    // linha do parser de config do curl e serem truncados silenciosamente — grava num arquivo
    // temporário e usa `data-binary = "@arquivo"` em vez de inline, que não tem esse limite.
    let bodyFile: string | undefined;
    if (bodyStr !== undefined) {
      bodyFile = join(tmpdir(), `fw-body-${randomUUID()}.json`);
      await writeFile(bodyFile, bodyStr, "utf8");
    }

    try {
      const baseHeaders: Record<string, string> = { Accept: "application/json" };
      if (bodyFile !== undefined) baseHeaders["Content-Type"] = "application/json";

      const probe = await curlAttempt(method, path, baseHeaders, bodyFile);
      if (probe.status !== 401) return probe;

      const challenge = pickBestChallenge(parseWwwAuthenticateChallenges(probe.headers));
      if (!challenge) return probe;

      const authorization = buildAuthorizationHeader(challenge, config.adminUsername, config.adminPassword, method, path);
      return await curlAttempt(method, path, { ...baseHeaders, Authorization: authorization }, bodyFile);
    } finally {
      if (bodyFile) await unlink(bodyFile).catch(() => undefined);
    }
  }

  try {
    // override:true reivindica a sessão mesmo se houver uma pendurada (só 1 sessão de admin por vez).
    const loginRes = await curlRequest("POST", AUTH_PATH, { override: true });
    if (loginRes.status !== 200) {
      throw new FirewallOperationError(describeFirewallError(loginRes.status, loginRes.body, loginRes.headers));
    }

    // Autenticar sozinho não é suficiente: é preciso iniciar a sessão de gestão e reivindicar o
    // modo de configuração explicitamente — só assim os outros endpoints reconhecem a sessão.
    const startMgmtRes = await curlRequest("POST", "/api/sonicos/start-management");
    if (startMgmtRes.status >= 400) {
      throw new FirewallOperationError(describeFirewallError(startMgmtRes.status, startMgmtRes.body, startMgmtRes.headers));
    }
    const configModeRes = await curlRequest("POST", "/api/sonicos/config-mode");
    if (configModeRes.status >= 400) {
      throw new FirewallOperationError(describeFirewallError(configModeRes.status, configModeRes.body, configModeRes.headers));
    }

    try {
      return await fn({
        request: async <T>(method: string, path: string, body?: unknown) => {
          const res = await curlRequest(method, path, body);
          if (res.status >= 400) {
            throw new FirewallOperationError(describeFirewallError(res.status, res.body, res.headers));
          }
          if (!res.body) return undefined;
          try {
            return JSON.parse(res.body) as T;
          } catch {
            return undefined;
          }
        },
      });
    } finally {
      await curlRequest("POST", "/api/sonicos/non-config-mode").catch(() => undefined);
      await curlRequest("DELETE", AUTH_PATH).catch(() => undefined);
    }
  } finally {
    await unlink(cookieJar).catch(() => undefined);
  }
}

/** Testa uma conexão com firewall: login + logout, sem tocar em nenhuma configuração. */
export async function testFirewallConnection(config: FirewallConnectionConfig): Promise<FirewallTestResult> {
  const start = Date.now();
  try {
    await withFirewallSession(config, async () => undefined);
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof FirewallOperationError ? err.message : "Erro desconhecido ao conectar ao firewall.",
    };
  }
}
