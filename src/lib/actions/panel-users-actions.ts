"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { generateToken } from "@/lib/crypto";
import { revokeAllSessionsForUser, revokeSession } from "@/lib/auth/session";

export type ActionState =
  | { error?: string; success?: string; tempPassword?: string; userId?: string }
  | undefined;

function generateTempPassword(): string {
  // Legível o suficiente para digitar, mas com boa entropia (16 chars, alfabeto sem ambíguos).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const raw = generateToken(24);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[raw.charCodeAt(i % raw.length) % alphabet.length];
  }
  return out;
}

const createUserSchema = z.object({
  name: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("E-mail inválido."),
  username: z
    .string()
    .min(3, "Usuário precisa ter ao menos 3 caracteres.")
    .regex(/^[a-z0-9._-]+$/, "Use apenas letras minúsculas, números, ponto, hífen ou underline."),
  role: z.enum(["ADMIN", "OPERATOR", "AUDITOR"]),
});

export async function createPanelUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const exists = await db.user.findFirst({
    where: { OR: [{ username: parsed.data.username }, { email: parsed.data.email }] },
  });
  if (exists) return { error: "Já existe um usuário com esse username ou e-mail." };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const created = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      username: parsed.data.username.toLowerCase(),
      role: parsed.data.role,
      passwordHash,
      mustChangePassword: true,
      createdById: actor.id,
    },
  });

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "panel_user.create",
    entityType: "PANEL_USER",
    entityId: created.id,
    entityLabel: created.username,
    description: `Usuário do painel "${created.username}" criado com papel ${created.role}`,
    metadata: { role: created.role, email: created.email },
    status: "SUCCESS",
  });

  revalidatePath("/usuarios");
  return { success: "Usuário criado com sucesso.", tempPassword, userId: created.id };
}

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "OPERATOR", "AUDITOR"]),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]),
});

export async function updatePanelUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const parsed = updateUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const before = await db.user.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "Usuário não encontrado." };

  if (before.id === actor.id && parsed.data.role !== "ADMIN") {
    return { error: "Você não pode remover seu próprio papel de administrador." };
  }
  if (before.id === actor.id && parsed.data.status !== "ACTIVE") {
    return { error: "Você não pode desativar/bloquear a própria conta." };
  }

  const updated = await db.user.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      status: parsed.data.status,
    },
  });

  if (parsed.data.status !== "ACTIVE" && before.status === "ACTIVE") {
    await revokeAllSessionsForUser(updated.id, "account_deactivated");
  }

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "panel_user.update",
    entityType: "PANEL_USER",
    entityId: updated.id,
    entityLabel: updated.username,
    description: `Usuário do painel "${updated.username}" atualizado`,
    metadata: {
      before: { name: before.name, email: before.email, role: before.role, status: before.status },
      after: { name: updated.name, email: updated.email, role: updated.role, status: updated.status },
    },
    status: "SUCCESS",
  });

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${updated.id}`);
  return { success: "Usuário atualizado com sucesso." };
}

export async function resetPanelUserPasswordAction(userId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Usuário não encontrado." };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null },
  });
  await revokeAllSessionsForUser(userId, "password_reset_by_admin");

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "panel_user.password_reset",
    entityType: "PANEL_USER",
    entityId: user.id,
    entityLabel: user.username,
    description: `Senha do usuário "${user.username}" redefinida por administrador`,
    status: "SUCCESS",
  });

  revalidatePath(`/usuarios/${userId}`);
  return { success: "Senha redefinida.", tempPassword };
}

export async function resetPanelUserMfaAction(userId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "Usuário não encontrado." };

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } }),
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await revokeAllSessionsForUser(userId, "mfa_reset_by_admin");

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "panel_user.mfa_reset",
    entityType: "PANEL_USER",
    entityId: user.id,
    entityLabel: user.username,
    description: `MFA do usuário "${user.username}" foi resetado por administrador (precisará reconfigurar no próximo login)`,
    status: "SUCCESS",
  });

  revalidatePath(`/usuarios/${userId}`);
  return { success: "MFA resetado. O usuário precisará reconfigurar no próximo login." };
}

export async function revokePanelSessionAction(sessionId: string, userId: string): Promise<ActionState> {
  const actor = await requireRole(["ADMIN"]);
  await revokeSession(sessionId, "revoked_by_admin");

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "session.revoke",
    entityType: "SESSION",
    entityId: sessionId,
    description: "Sessão de usuário revogada manualmente por administrador",
    status: "SUCCESS",
  });

  revalidatePath(`/usuarios/${userId}`);
  return { success: "Sessão revogada." };
}
