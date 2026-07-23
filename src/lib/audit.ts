import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { AuditEntityType, AuditStatus } from "@/generated/prisma/enums";

export type AuditActor = {
  id: string;
  name: string;
} | null;

type LogAuditInput = {
  actor: AuditActor;
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  status?: AuditStatus;
};

/** Extrai IP e user-agent da requisição atual (funciona em Server Actions e Route Handlers). */
export async function getRequestContext() {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent");
  return { ip, userAgent };
}

/**
 * Registra uma entrada na trilha de auditoria. Deve ser chamada para TODA ação relevante:
 * login/logout, criação/edição/exclusão de usuários do painel, operações de MFA,
 * gestão de conexões AD e qualquer operação feita em usuários/grupos do Active Directory.
 *
 * Nunca deixe uma ação mutável sem chamada correspondente a logAudit — é a base da auditoria
 * exigida para este sistema.
 */
export async function logAudit(input: LogAuditInput) {
  const { ip, userAgent } = await getRequestContext();

  await db.auditLog.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? "sistema",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      description: input.description,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      status: input.status ?? "SUCCESS",
      ip,
      userAgent,
    },
  });
}
