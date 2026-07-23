"use server";

import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadAdConnectionConfig } from "@/lib/ad/connection";
import {
  listOrganizationalUnits,
  createOrganizationalUnit,
  renameOrganizationalUnit,
  moveOrganizationalUnit,
  deleteOrganizationalUnit,
  type AdOrganizationalUnit,
} from "@/lib/ad/ou";
import { withAdErrorHandling } from "@/lib/ad/error-handling";
import { AdOperationError } from "@/lib/ad/types";

export type ActionState = { error?: string; success?: string } | undefined;
export type OuListResult = { error?: string; ous?: AdOrganizationalUnit[] };

/** Lista todas as OUs da conexão já salva — usado nos seletores de "mover para" em toda a árvore. */
export async function listAdConnectionOusAction(connectionId: string): Promise<OuListResult> {
  await requireRole(["ADMIN", "OPERATOR"]);
  try {
    const config = await loadAdConnectionConfig(connectionId);
    const ous = await listOrganizationalUnits(config);
    return { ous };
  } catch (err) {
    return { error: err instanceof AdOperationError ? err.message : "Falha ao buscar OUs no AD." };
  }
}

const createSchema = z.object({
  connectionId: z.string().uuid(),
  parentDn: z.string().min(1),
  name: z.string().min(1, "Informe o nome da OU."),
  description: z.string().optional(),
});

export async function createAdOuAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() =>
    createOrganizationalUnit(config, parsed.data.parentDn, parsed.data.name, parsed.data.description || undefined)
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_ou.create",
    entityType: "AD_OU",
    entityId: "error" in result ? null : result.ok,
    entityLabel: parsed.data.name,
    description:
      "error" in result
        ? `Falha ao criar OU "${parsed.data.name}": ${result.error}`
        : `OU "${parsed.data.name}" criada em ${parsed.data.parentDn}`,
    metadata: { connectionId: parsed.data.connectionId, parentDn: parsed.data.parentDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  return { success: "OU criada." };
}

const renameSchema = z.object({
  connectionId: z.string().uuid(),
  dn: z.string().min(1),
  label: z.string().min(1),
  newName: z.string().min(1, "Informe o novo nome."),
});

export async function renameAdOuAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = renameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadAdConnectionConfig(parsed.data.connectionId);
  const result = await withAdErrorHandling(() => renameOrganizationalUnit(config, parsed.data.dn, parsed.data.newName));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_ou.rename",
    entityType: "AD_OU",
    entityId: parsed.data.dn,
    entityLabel: parsed.data.label,
    description:
      "error" in result
        ? `Falha ao renomear OU "${parsed.data.label}": ${result.error}`
        : `OU "${parsed.data.label}" renomeada para "${parsed.data.newName}"`,
    metadata: { connectionId: parsed.data.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  return { success: "OU renomeada." };
}

export async function moveAdOuAction(params: {
  connectionId: string;
  dn: string;
  label: string;
  newParentDn: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => moveOrganizationalUnit(config, params.dn, params.newParentDn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_ou.move",
    entityType: "AD_OU",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao mover OU "${params.label}": ${result.error}`
        : `OU "${params.label}" movida para ${params.newParentDn}`,
    metadata: { connectionId: params.connectionId, newParentDn: params.newParentDn },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  return { success: "OU movida." };
}

export async function deleteAdOuAction(params: {
  connectionId: string;
  dn: string;
  label: string;
}): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const config = await loadAdConnectionConfig(params.connectionId);
  const result = await withAdErrorHandling(() => deleteOrganizationalUnit(config, params.dn));

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "ad_ou.delete",
    entityType: "AD_OU",
    entityId: params.dn,
    entityLabel: params.label,
    description:
      "error" in result
        ? `Falha ao excluir OU "${params.label}": ${result.error}`
        : `OU "${params.label}" excluída`,
    metadata: { connectionId: params.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  return { success: "OU excluída." };
}
