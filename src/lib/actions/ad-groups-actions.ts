"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import {
  createAdGroup,
  addAdGroupMember,
  removeAdGroupMember,
  deleteAdGroup,
  getAdGroup,
  moveAdGroup,
} from "@/lib/ad/groups";
import { withAdErrorHandling } from "@/lib/ad/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

function pathFor(connectionId: string) {
  return `/ad/grupos?conexao=${connectionId}`;
}

const createSchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().min(1, "Informe o nome do grupo."),
  description: z.string().optional(),
  ou: z.string().optional(),
  scope: z.enum(["DomainLocal", "Global", "Universal"]).default("Global"),
  security: z.coerce.boolean().default(true),
});

export async function createAdGroupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = createSchema.safeParse({
    ...Object.fromEntries(formData),
    security: formData.get("security") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() =>
    createAdGroup(config, {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      ou: parsed.data.ou || undefined,
      scope: parsed.data.scope,
      security: parsed.data.security,
    })
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_group.create",
    entityType: "AD_GROUP",
    entityId: "error" in result ? null : result.ok,
    entityLabel: parsed.data.name,
    description:
      "error" in result
        ? `Falha ao criar grupo AD "${parsed.data.name}": ${result.error}`
        : `Grupo AD "${parsed.data.name}" criado`,
    metadata: { connectionId: parsed.data.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: "Grupo criado com sucesso." };
}

export async function getAdGroupMembersAction(connectionId: string, dn: string) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(connectionId);
  const result = await withAdErrorHandling(() => getAdGroup(config, dn));
  if ("error" in result) return { error: result.error };
  return { members: result.ok.members };
}

const memberSchema = z.object({
  connectionId: z.string().uuid(),
  groupDn: z.string().min(1),
  groupLabel: z.string().min(1),
  memberDn: z.string().min(1, "Informe o DN do membro a adicionar."),
});

export async function addAdGroupMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() =>
    addAdGroupMember(config, parsed.data.groupDn, parsed.data.memberDn)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_group.add_member",
    entityType: "AD_GROUP",
    entityId: parsed.data.groupDn,
    entityLabel: parsed.data.groupLabel,
    description:
      "error" in result
        ? `Falha ao adicionar membro ao grupo AD "${parsed.data.groupLabel}": ${result.error}`
        : `Membro adicionado ao grupo AD "${parsed.data.groupLabel}": ${parsed.data.memberDn}`,
    metadata: { connectionId: parsed.data.connectionId, memberDn: parsed.data.memberDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(parsed.data.connectionId));
  return { success: "Membro adicionado." };
}

export async function removeAdGroupMemberAction(params: {
  connectionId: string;
  groupDn: string;
  groupLabel: string;
  memberDn: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => removeAdGroupMember(config, params.groupDn, params.memberDn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_group.remove_member",
    entityType: "AD_GROUP",
    entityId: params.groupDn,
    entityLabel: params.groupLabel,
    description:
      "error" in result
        ? `Falha ao remover membro do grupo AD "${params.groupLabel}": ${result.error}`
        : `Membro removido do grupo AD "${params.groupLabel}": ${params.memberDn}`,
    metadata: { connectionId: params.connectionId, memberDn: params.memberDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Membro removido." };
}

export async function moveAdGroupAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  newOuDn: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => moveAdGroup(config, params.dn, params.newOuDn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_group.move",
    entityType: "AD_GROUP",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao mover grupo AD "${params.label}": ${result.error}`
        : `Grupo AD "${params.label}" movido para ${params.newOuDn}`,
    metadata: { connectionId: params.connectionId, newOuDn: params.newOuDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Grupo movido." };
}

export async function deleteAdGroupAction(params: {
  connectionId: string;
  dn: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => deleteAdGroup(config, params.dn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_group.delete",
    entityType: "AD_GROUP",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao excluir grupo AD "${params.label}": ${result.error}`
        : `Grupo AD "${params.label}" excluído`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath(pathFor(params.connectionId));
  return { success: "Grupo excluído." };
}
