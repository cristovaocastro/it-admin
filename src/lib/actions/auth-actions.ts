"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { attemptPasswordLogin } from "@/lib/auth/login";
import {
  getPendingSession,
  getSession,
  promoteSessionToVerified,
  logout as destroySession,
  revokeAllSessionsForUser,
} from "@/lib/auth/session";
import {
  verifyTotpToken,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "@/lib/auth/mfa";
import { checkPasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";

export type SimpleActionState = { error?: string } | undefined;

// ---------------------------------------------------------------------------
// Login (etapa 1: usuário + senha)
// ---------------------------------------------------------------------------

const loginSchema = z.object({
  identifier: z.string().min(1, "Informe usuário ou e-mail."),
  password: z.string().min(1, "Informe a senha."),
});

export async function loginAction(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const result = await attemptPasswordLogin(parsed.data.identifier, parsed.data.password);
  if (!result.ok) return { error: result.error };

  redirect(result.mustEnrollMfa ? "/mfa/configurar" : "/mfa/verificar");
}

// ---------------------------------------------------------------------------
// MFA: enrollment (primeiro acesso)
// ---------------------------------------------------------------------------

export type EnrollMfaState = { error?: string; recoveryCodes?: string[]; nextHref?: string } | undefined;

const totpSchema = z.object({ token: z.string().trim().regex(/^\d{6}$/, "Informe os 6 dígitos do código.") });

export async function confirmMfaEnrollmentAction(
  _prev: EnrollMfaState,
  formData: FormData
): Promise<EnrollMfaState> {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");

  const parsed = totpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Código inválido." };

  if (!pending.user.mfaSecret) return { error: "Configuração de MFA não iniciada. Recarregue a página." };
  const secret = decryptSecret(pending.user.mfaSecret);
  const valid = await verifyTotpToken(secret, parsed.data.token);
  if (!valid) {
    await logAudit({
      actor: { id: pending.user.id, name: pending.user.username },
      action: "auth.mfa.enroll",
      entityType: "AUTH",
      description: "Código inválido ao confirmar configuração de MFA",
      status: "FAILURE",
    });
    return { error: "Código inválido. Verifique o horário do seu dispositivo e tente novamente." };
  }

  const plainCodes = generateRecoveryCodes();
  const hashed = await Promise.all(plainCodes.map(hashRecoveryCode));

  await db.$transaction([
    db.user.update({
      where: { id: pending.user.id },
      data: { mfaEnabled: true, mfaEnforcedFrom: new Date() },
    }),
    db.mfaRecoveryCode.createMany({
      data: hashed.map((codeHash) => ({ userId: pending.user.id, codeHash })),
    }),
  ]);

  await promoteSessionToVerified(pending.id);
  await logAudit({
    actor: { id: pending.user.id, name: pending.user.username },
    action: "auth.mfa.enroll",
    entityType: "AUTH",
    description: "MFA configurado e ativado com sucesso",
    status: "SUCCESS",
  });

  const nextHref = pending.user.mustChangePassword ? "/conta/trocar-senha" : "/dashboard";
  return { recoveryCodes: plainCodes, nextHref };
}

// ---------------------------------------------------------------------------
// MFA: desafio (logins subsequentes)
// ---------------------------------------------------------------------------

export async function verifyMfaAction(_prev: SimpleActionState, formData: FormData): Promise<SimpleActionState> {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");

  const token = String(formData.get("token") ?? "").trim();
  if (!pending.user.mfaSecret) return { error: "MFA não configurado para esta conta." };
  const secret = decryptSecret(pending.user.mfaSecret);
  const valid = await verifyTotpToken(secret, token);

  if (!valid) {
    await logAudit({
      actor: { id: pending.user.id, name: pending.user.username },
      action: "auth.mfa.verify",
      entityType: "AUTH",
      description: "Código MFA inválido no login",
      status: "FAILURE",
    });
    return { error: "Código inválido." };
  }

  await promoteSessionToVerified(pending.id);
  await logAudit({
    actor: { id: pending.user.id, name: pending.user.username },
    action: "auth.login",
    entityType: "AUTH",
    description: "Login concluído com sucesso (senha + MFA)",
    status: "SUCCESS",
  });

  redirect(pending.user.mustChangePassword ? "/conta/trocar-senha" : "/dashboard");
}

const recoverySchema = z.object({ code: z.string().min(4) });

export async function verifyRecoveryCodeAction(
  _prev: SimpleActionState,
  formData: FormData
): Promise<SimpleActionState> {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");

  const parsed = recoverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Informe um código de recuperação válido." };

  const codes = await db.mfaRecoveryCode.findMany({
    where: { userId: pending.user.id, usedAt: null },
  });

  let matched: (typeof codes)[number] | null = null;
  for (const c of codes) {
    if (await verifyRecoveryCode(c.codeHash, parsed.data.code)) {
      matched = c;
      break;
    }
  }

  if (!matched) {
    await logAudit({
      actor: { id: pending.user.id, name: pending.user.username },
      action: "auth.mfa.recovery_code",
      entityType: "AUTH",
      description: "Tentativa de uso de código de recuperação inválido",
      status: "FAILURE",
    });
    return { error: "Código de recuperação inválido ou já utilizado." };
  }

  await db.mfaRecoveryCode.update({ where: { id: matched.id }, data: { usedAt: new Date() } });
  await promoteSessionToVerified(pending.id);
  await logAudit({
    actor: { id: pending.user.id, name: pending.user.username },
    action: "auth.mfa.recovery_code",
    entityType: "AUTH",
    description: "Login concluído usando código de recuperação (recomenda-se gerar novos códigos)",
    status: "SUCCESS",
  });

  redirect(pending.user.mustChangePassword ? "/conta/trocar-senha" : "/dashboard");
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await logAudit({
      actor: { id: session.user.id, name: session.user.username },
      action: "auth.logout",
      entityType: "AUTH",
      description: "Logout realizado pelo usuário",
      status: "SUCCESS",
    });
  }
  await destroySession();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Troca de senha (forçada no primeiro acesso ou voluntária)
// ---------------------------------------------------------------------------

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: z.string().min(1),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "A confirmação não confere com a nova senha.",
    path: ["confirmPassword"],
  });

export async function changePasswordAction(
  _prev: SimpleActionState,
  formData: FormData
): Promise<SimpleActionState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const policy = checkPasswordPolicy(parsed.data.newPassword);
  if (!policy.valid) return { error: policy.reason };

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const currentOk = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!currentOk) return { error: "Senha atual incorreta." };

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash, mustChangePassword: false, passwordChangedAt: new Date() },
  });

  await revokeAllSessionsForUser(user.id, "password_changed", session.id);
  await logAudit({
    actor: { id: user.id, name: user.username },
    action: "auth.password.change",
    entityType: "AUTH",
    description: "Senha alterada pelo próprio usuário",
    status: "SUCCESS",
  });

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Sessões (autoatendimento)
// ---------------------------------------------------------------------------

export async function revokeMySessionAction(sessionId: string): Promise<{ error?: string; success?: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const target = await db.session.findUnique({ where: { id: sessionId } });
  if (!target || target.userId !== session.user.id) return { error: "Sessão não encontrada." };

  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedReason: "revoked_by_self" },
  });

  await logAudit({
    actor: { id: session.user.id, name: session.user.username },
    action: "session.revoke",
    entityType: "SESSION",
    entityId: sessionId,
    description: sessionId === session.id ? "Sessão atual encerrada pelo usuário" : "Sessão encerrada pelo usuário",
    status: "SUCCESS",
  });

  return { success: "Sessão encerrada." };
}
