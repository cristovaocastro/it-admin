import "server-only";
import * as ldap from "ldapjs";
import type { Client, SearchOptions } from "ldapjs";
import type { AdConnectionConfig, AdTestResult } from "@/lib/ad/types";
import { AdOperationError } from "@/lib/ad/types";
import { normalizeDn } from "@/lib/ad/util";

// Atributos cujo valor é sempre um DN (ou lista de DNs) — precisam passar por normalizeDn().
const DN_VALUED_ATTRIBUTES = new Set(["distinguishedName", "member", "memberOf"]);

function buildClientOptions(config: AdConnectionConfig) {
  const protocol = config.encryption === "LDAPS" ? "ldaps" : "ldap";
  return {
    url: `${protocol}://${config.host}:${config.port}`,
    timeout: 15000,
    connectTimeout: 10000,
    tlsOptions: config.encryption === "LDAPS" ? { rejectUnauthorized: config.rejectUnauthorized } : undefined,
  };
}

function createRawClient(config: AdConnectionConfig): Client {
  return ldap.createClient(buildClientOptions(config));
}

function bind(client: Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function unbind(client: Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind(() => resolve());
  });
}

function startTls(client: Client, rejectUnauthorized: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    client.starttls({ rejectUnauthorized }, [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Abre uma conexão LDAP autenticada com a conta de serviço da conexão AD, executa `fn`
 * e garante que a conexão é sempre encerrada (sucesso ou erro). Use isso para toda
 * operação contra o Active Directory — nunca crie o client manualmente fora daqui.
 */
export async function withAdClient<T>(
  config: AdConnectionConfig,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const client = createRawClient(config);

  // Evita que erros assíncronos de socket derrubem o processo Node (EventEmitter sem listener).
  const swallowError = () => undefined;
  client.on("error", swallowError);
  client.on("connectError", swallowError);

  try {
    if (config.encryption === "STARTTLS") {
      await startTls(client, config.rejectUnauthorized);
    }
    await bind(client, config.bindDN, config.bindPassword);
    return await fn(client);
  } catch (err) {
    if (err instanceof AdOperationError) throw err;
    throw new AdOperationError(describeLdapError(err), err);
  } finally {
    client.removeListener("error", swallowError);
    client.removeListener("connectError", swallowError);
    await unbind(client).catch(() => undefined);
  }
}

export function describeLdapError(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = String((err as { message?: unknown }).message ?? "");
    if (message.includes("InvalidCredentials")) return "Credenciais da conta de serviço inválidas.";
    if (message.includes("ECONNREFUSED")) return "Conexão recusada pelo servidor AD (host/porta incorretos ou serviço fora do ar).";
    if (message.includes("ETIMEDOUT") || message.includes("connectTimeout")) return "Tempo de conexão esgotado ao contatar o servidor AD.";
    if (message.includes("ENOTFOUND")) return "Host do servidor AD não encontrado (verifique o DNS/host informado).";
    if (message.includes("self signed certificate") || message.includes("unable to verify")) {
      return "Certificado TLS do servidor AD não é confiável (self-signed). Desative a validação de certificado se for esperado, ou instale o certificado corretamente.";
    }
    if (message.includes("unwilling to perform")) {
      return "O servidor AD recusou a operação — operações de senha exigem conexão criptografada (LDAPS ou STARTTLS).";
    }
    if (message.includes("Insufficient Access") || message.includes("InsufficientAccessRights")) {
      return "A conta de serviço não tem permissão no AD para realizar esta operação. Peça para um administrador do domínio delegar as permissões necessárias (gravar atributos, redefinir senha, criar/excluir objetos ou alterar membros de grupo, conforme o caso) na OU de destino.";
    }
    if (message.includes("Not Allowed On Non Leaf")) {
      return "Essa OU não está vazia — mova ou exclua o conteúdo dela antes de excluí-la (ou verifique se ela está protegida contra exclusão acidental nas propriedades do objeto no AD).";
    }
    if (message.includes("Entry Already Exists")) {
      return "Já existe um objeto com esse nome nesse local do AD.";
    }
    if (message.includes("No Such Object")) {
      return "O objeto ou o destino informado não foi encontrado no AD (verifique se ele ainda existe).";
    }
    if (message.includes("No Such Attribute")) {
      return "O AD recusou a alteração: um dos atributos enviados não existe atualmente no objeto (ex: tentar limpar um campo que já está vazio).";
    }
    if (message.includes("closed") || message.includes("ECONNRESET") || message.includes("socket hang up")) {
      return "A conexão com o servidor AD foi encerrada inesperadamente durante a operação. Tente novamente; se persistir, verifique firewall/timeout entre este servidor e o AD.";
    }
    return message || "Erro desconhecido de LDAP.";
  }
  return "Erro desconhecido de LDAP.";
}

/** Testa uma conexão AD: bind com a conta de serviço e mede a latência. Não altera nada no diretório. */
export async function testAdConnection(config: AdConnectionConfig): Promise<AdTestResult> {
  const start = Date.now();
  try {
    await withAdClient(config, async () => undefined);
    return { success: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof AdOperationError ? err.message : describeLdapError(err),
    };
  }
}

export function ldapSearch(
  client: Client,
  base: string,
  options: SearchOptions
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const entries: Record<string, unknown>[] = [];
    client.search(base, options, (err, res) => {
      if (err) {
        reject(err);
        return;
      }
      res.on("searchEntry", (entry) => {
        entries.push(entry.pojo ? pojoToObject(entry.pojo) : (entry as unknown as Record<string, unknown>));
      });
      res.on("error", (searchErr: unknown) => {
        // sizeLimitExceeded (código LDAP 4) não é uma falha: o servidor só está avisando que
        // existem mais resultados além do limite pedido. Mantemos as entradas já recebidas.
        const code = (searchErr as { code?: number })?.code;
        if (code === 4) {
          resolve(entries);
          return;
        }
        reject(searchErr);
      });
      res.on("end", (result) => {
        if (result && result.status !== 0 && result.status !== 4) {
          reject(new AdOperationError(`Busca LDAP retornou status ${result.status}`));
        } else {
          resolve(entries);
        }
      });
    });
  });
}

// ldapjs retorna entry.pojo com { dn, attributes: [{type, values}] } — normaliza para {dn, ...attrs}
function pojoToObject(pojo: { objectName?: string; attributes: { type: string; values: string[] }[] }) {
  const obj: Record<string, unknown> = { dn: pojo.objectName ? normalizeDn(pojo.objectName) : pojo.objectName };
  for (const attr of pojo.attributes) {
    const values = DN_VALUED_ATTRIBUTES.has(attr.type) ? attr.values.map(normalizeDn) : attr.values;
    obj[attr.type] = values.length === 1 ? values[0] : values;
  }
  return obj;
}

export function ldapAdd(client: Client, dn: string, entry: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    client.add(dn, entry, (err) => (err ? reject(err) : resolve()));
  });
}

export function ldapModify(
  client: Client,
  dn: string,
  changes: ldap.Change | ldap.Change[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    client.modify(dn, changes, (err) => (err ? reject(err) : resolve()));
  });
}

export function ldapDel(client: Client, dn: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.del(dn, (err) => (err ? reject(err) : resolve()));
  });
}

export function ldapModifyDN(client: Client, dn: string, newDn: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.modifyDN(dn, newDn, (err) => (err ? reject(err) : resolve()));
  });
}

export { Change as LdapChange } from "ldapjs";
