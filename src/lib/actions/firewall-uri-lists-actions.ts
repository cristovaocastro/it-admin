"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadFirewallConnectionConfig } from "@/lib/firewall/connection";
import {
  createUriListObject,
  updateUriListObject,
  getUriListObject,
  createUriListGroup,
  updateUriListGroup,
} from "@/lib/firewall/uri-lists";
import type { FirewallUriListObject } from "@/lib/firewall/uri-lists";
import { withFirewallErrorHandling } from "@/lib/firewall/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

function pathFor(connectionId: string) {
  return `/firewall/uri-lists?conexao=${connectionId}`;
}

/** Converte um textarea (uma entrada por linha) em uma lista sem linhas vazias. */
function linesToList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const MAX_LISTED_ENTRIES = 20;

function formatEntryValues(values: string[]): string {
  if (values.length <= MAX_LISTED_ENTRIES) return values.join(", ");
  return `${values.slice(0, MAX_LISTED_ENTRIES).join(", ")}, +${values.length - MAX_LISTED_ENTRIES} outro(s)`;
}

function diffList(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((v) => !beforeSet.has(v)),
    removed: before.filter((v) => !afterSet.has(v)),
  };
}

type EntryDiff = {
  added: { uris: string[]; domains: string[]; keywords: string[] };
  removed: { uris: string[]; domains: string[]; keywords: string[] };
};

function diffEntries(
  before: FirewallUriListObject | null,
  after: { uris: string[]; domains: string[]; keywords: string[] }
): EntryDiff {
  const uris = diffList(before?.uris ?? [], after.uris);
  const domains = diffList(before?.domains ?? [], after.domains);
  const keywords = diffList(before?.keywords ?? [], after.keywords);
  return {
    added: { uris: uris.added, domains: domains.added, keywords: keywords.added },
    removed: { uris: uris.removed, domains: domains.removed, keywords: keywords.removed },
  };
}

function describeEntryDiff(diff: EntryDiff): string {
  const parts: string[] = [];
  const kinds: { key: keyof EntryDiff["added"]; label: string }[] = [
    { key: "uris", label: "URI" },
    { key: "domains", label: "domínio" },
    { key: "keywords", label: "palavra-chave" },
  ];
  for (const { key, label } of kinds) {
    if (diff.added[key].length) parts.push(`${label}(s) adicionado(s): ${formatEntryValues(diff.added[key])}`);
    if (diff.removed[key].length) parts.push(`${label}(s) removido(s): ${formatEntryValues(diff.removed[key])}`);
  }
  return parts.join("; ");
}

const objectSchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().min(1, "Informe o nome da URI list."),
});

async function saveUriListObjectCore(
  actor: { id: string; username: string },
  connectionId: string,
  uuid: string | undefined,
  name: string,
  uris: string[] | undefined,
  domains: string[] | undefined,
  keywords: string[] | undefined
): Promise<ActionState> {
  const isEdit = !!uuid;
  const config = await loadFirewallConnectionConfig(connectionId);

  // Em edição, sempre buscamos o estado atual no firewall: (1) permite calcular o diff
  // exato para a auditoria, e (2) evita que um formulário que só altera o nome (ex:
  // "Renomear") apague as entradas existentes, já que o PUT do SonicOS substitui a lista
  // inteira — sem isso, renomear sem reenviar uris/domains/keywords zerava a URI list.
  let before: FirewallUriListObject | null = null;
  if (isEdit) {
    const beforeResult = await withFirewallErrorHandling(() => getUriListObject(config, uuid));
    if ("error" in beforeResult) {
      await logAudit({
        actor: { id: actor.id, name: actor.username },
        action: "firewall_uri_list.update",
        entityType: "FIREWALL_URI_LIST",
        entityId: uuid,
        entityLabel: name,
        description: `Falha ao atualizar URI list "${name}" no firewall: não foi possível ler o estado atual antes de salvar (${beforeResult.error})`,
        metadata: { connectionId },
        status: "FAILURE",
      });
      return { error: beforeResult.error };
    }
    before = beforeResult.ok;
  }

  const finalUris = uris ?? before?.uris ?? [];
  const finalDomains = domains ?? before?.domains ?? [];
  const finalKeywords = keywords ?? before?.keywords ?? [];
  const params = { name, uris: finalUris, domains: finalDomains, keywords: finalKeywords };

  const result = await withFirewallErrorHandling(() =>
    isEdit ? updateUriListObject(config, uuid, params) : createUriListObject(config, params)
  );

  const diff = diffEntries(before, { uris: finalUris, domains: finalDomains, keywords: finalKeywords });
  const changeSummary = describeEntryDiff(diff);
  const renamed = before && before.name !== name ? before.name : undefined;

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: isEdit ? "firewall_uri_list.update" : "firewall_uri_list.create",
    entityType: "FIREWALL_URI_LIST",
    entityId: uuid ?? null,
    entityLabel: name,
    description:
      "error" in result
        ? `Falha ao ${isEdit ? "atualizar" : "criar"} URI list "${name}" no firewall: ${result.error}`
        : `URI list "${name}"${renamed ? ` (renomeada de "${renamed}")` : ""} ${isEdit ? "atualizada" : "criada"} no firewall${changeSummary ? ` — ${changeSummary}` : ""}`,
    metadata: {
      connectionId,
      name,
      renamedFrom: renamed ?? null,
      uriCount: finalUris.length,
      domainCount: finalDomains.length,
      keywordCount: finalKeywords.length,
      added: diff.added,
      removed: diff.removed,
    },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(connectionId));
  if (uuid) revalidatePath(`/firewall/uri-lists/${uuid}?conexao=${connectionId}`);
  return { success: `URI list ${isEdit ? "atualizada" : "criada"} com sucesso.` };
}

/** Cria uma URI list vazia. Não há ação de renomear/excluir a lista em si — só a criação
 * e a gestão das entradas (ver updateUriListObjectEntriesAction) ficam expostas na UI, de
 * propósito: excluir uma URI list de content filter em uso tem um custo operacional alto
 * (reabertura de chamado/BO) se feito sem querer. */
export async function createUriListObjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = objectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  return saveUriListObjectCore(actor, parsed.data.connectionId, undefined, parsed.data.name, undefined, undefined, undefined);
}

/** Variante chamável direto (sem FormData) — usada pelo gerenciador de entradas com paginação/busca. */
const entriesSchema = z.object({
  connectionId: z.string().uuid(),
  uuid: z.string().optional(),
  name: z.string().min(1, "Informe o nome da URI list."),
  uris: z.array(z.string()),
  domains: z.array(z.string()),
  keywords: z.array(z.string()),
});

export async function updateUriListObjectEntriesAction(
  params: z.infer<typeof entriesSchema>
): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = entriesSchema.safeParse(params);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  return saveUriListObjectCore(
    actor,
    parsed.data.connectionId,
    parsed.data.uuid,
    parsed.data.name,
    parsed.data.uris,
    parsed.data.domains,
    parsed.data.keywords
  );
}

const groupSchema = z.object({
  connectionId: z.string().uuid(),
  uuid: z.string().optional(),
  name: z.string().min(1, "Informe o nome do grupo."),
});

export async function saveUriListGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = groupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const params = {
    name: parsed.data.name,
    objectNames: linesToList(formData.get("objectNames")),
    groupNames: linesToList(formData.get("groupNames")),
  };
  const isEdit = !!parsed.data.uuid;

  const config = await loadFirewallConnectionConfig(parsed.data.connectionId);
  const result = await withFirewallErrorHandling(() =>
    isEdit ? updateUriListGroup(config, parsed.data.uuid!, params) : createUriListGroup(config, params)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: isEdit ? "firewall_uri_list_group.update" : "firewall_uri_list_group.create",
    entityType: "FIREWALL_URI_LIST",
    entityId: parsed.data.uuid ?? null,
    entityLabel: parsed.data.name,
    description:
      "error" in result
        ? `Falha ao ${isEdit ? "atualizar" : "criar"} grupo de URI list "${parsed.data.name}" no firewall: ${result.error}`
        : `Grupo de URI list "${parsed.data.name}" ${isEdit ? "atualizado" : "criado"} no firewall`,
    metadata: { connectionId: parsed.data.connectionId, ...params },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: `Grupo ${isEdit ? "atualizado" : "criado"} com sucesso.` };
}
