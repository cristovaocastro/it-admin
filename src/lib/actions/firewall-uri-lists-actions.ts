"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadFirewallConnectionConfig } from "@/lib/firewall/connection";
import {
  createUriListObject,
  updateUriListObject,
  deleteUriListObject,
  createUriListGroup,
  updateUriListGroup,
  deleteUriListGroup,
} from "@/lib/firewall/uri-lists";
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

const objectSchema = z.object({
  connectionId: z.string().uuid(),
  uuid: z.string().optional(),
  name: z.string().min(1, "Informe o nome da URI list."),
});

async function saveUriListObjectCore(
  actor: { id: string; username: string },
  connectionId: string,
  uuid: string | undefined,
  name: string,
  uris: string[],
  domains: string[],
  keywords: string[]
): Promise<ActionState> {
  const params = { name, uris, domains, keywords };
  const isEdit = !!uuid;

  const config = await loadFirewallConnectionConfig(connectionId);
  const result = await withFirewallErrorHandling(() =>
    isEdit ? updateUriListObject(config, uuid, params) : createUriListObject(config, params)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: isEdit ? "firewall_uri_list.update" : "firewall_uri_list.create",
    entityType: "FIREWALL_URI_LIST",
    entityId: uuid ?? null,
    entityLabel: name,
    description:
      "error" in result
        ? `Falha ao ${isEdit ? "atualizar" : "criar"} URI list "${name}" no firewall: ${result.error}`
        : `URI list "${name}" ${isEdit ? "atualizada" : "criada"} no firewall`,
    metadata: { connectionId, name, uriCount: uris.length, domainCount: domains.length, keywordCount: keywords.length },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(connectionId));
  if (uuid) revalidatePath(`/firewall/uri-lists/${uuid}?conexao=${connectionId}`);
  return { success: `URI list ${isEdit ? "atualizada" : "criada"} com sucesso.` };
}

export async function saveUriListObjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = objectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  return saveUriListObjectCore(
    actor,
    parsed.data.connectionId,
    parsed.data.uuid,
    parsed.data.name,
    linesToList(formData.get("uris")),
    linesToList(formData.get("domains")),
    linesToList(formData.get("keywords"))
  );
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
  const actor = await requireRole(["ADMIN"]);
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

export async function deleteUriListObjectAction(params: {
  connectionId: string;
  uuid: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadFirewallConnectionConfig(params.connectionId);
  const result = await withFirewallErrorHandling(() => deleteUriListObject(config, params.uuid));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "firewall_uri_list.delete",
    entityType: "FIREWALL_URI_LIST",
    entityId: params.uuid,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao excluir URI list "${params.label}" do firewall: ${result.error}`
        : `URI list "${params.label}" excluída do firewall`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "URI list excluída." };
}

const groupSchema = z.object({
  connectionId: z.string().uuid(),
  uuid: z.string().optional(),
  name: z.string().min(1, "Informe o nome do grupo."),
});

export async function saveUriListGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
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

export async function deleteUriListGroupAction(params: {
  connectionId: string;
  uuid: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadFirewallConnectionConfig(params.connectionId);
  const result = await withFirewallErrorHandling(() => deleteUriListGroup(config, params.uuid));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "firewall_uri_list_group.delete",
    entityType: "FIREWALL_URI_LIST",
    entityId: params.uuid,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao excluir grupo de URI list "${params.label}" do firewall: ${result.error}`
        : `Grupo de URI list "${params.label}" excluído do firewall`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Grupo excluído." };
}
