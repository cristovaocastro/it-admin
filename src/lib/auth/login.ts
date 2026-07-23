import "server-only";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createPendingSession } from "@/lib/auth/session";
import { logAudit, getRequestContext } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

export type LoginResult =
  | { ok: true; userId: string; mustEnrollMfa: boolean }
  | { ok: false; error: string };

/**
 * Primeira etapa do login: valida usuário + senha, aplica bloqueio por tentativas
 * e cria a sessão pendente (aguardando MFA). Sempre grava auditoria, sucesso ou falha.
 */
export async function attemptPasswordLogin(usernameOrEmail: string, password: string): Promise<LoginResult> {
  const { ip, userAgent } = await getRequestContext();
  const identifier = usernameOrEmail.trim().toLowerCase();

  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });

  if (!user) {
    await logAudit({
      actor: null,
      action: "auth.login",
      entityType: "AUTH",
      entityLabel: usernameOrEmail,
      description: `Tentativa de login com usuário inexistente (${usernameOrEmail})`,
      status: "FAILURE",
    });
    return { ok: false, error: "Usuário ou senha inválidos." };
  }

  if (user.status !== "ACTIVE") {
    await logAudit({
      actor: { id: user.id, name: user.username },
      action: "auth.login",
      entityType: "AUTH",
      entityLabel: user.username,
      description: `Login negado: conta com status ${user.status}`,
      status: "FAILURE",
    });
    return { ok: false, error: "Conta inativa ou bloqueada. Contate um administrador." };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAudit({
      actor: { id: user.id, name: user.username },
      action: "auth.login",
      entityType: "AUTH",
      entityLabel: user.username,
      description: "Login negado: conta temporariamente bloqueada por excesso de tentativas",
      status: "FAILURE",
    });
    return { ok: false, error: "Conta temporariamente bloqueada. Tente novamente mais tarde." };
  }

  const passwordOk = await verifyPassword(user.passwordHash, password);

  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    const lockingNow = attempts >= MAX_FAILED_ATTEMPTS;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockingNow ? 0 : attempts,
        lockedUntil: lockingNow ? new Date(Date.now() + LOCKOUT_MS) : user.lockedUntil,
      },
    });
    await logAudit({
      actor: { id: user.id, name: user.username },
      action: "auth.login",
      entityType: "AUTH",
      entityLabel: user.username,
      description: lockingNow
        ? `Senha incorreta: conta bloqueada por ${LOCKOUT_MS / 60000} minutos após ${MAX_FAILED_ATTEMPTS} tentativas`
        : `Senha incorreta (tentativa ${attempts}/${MAX_FAILED_ATTEMPTS})`,
      status: "FAILURE",
    });
    return { ok: false, error: "Usuário ou senha inválidos." };
  }

  // Sucesso: zera contadores de bloqueio e cria sessão pendente de MFA.
  await db.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await createPendingSession({ userId: user.id, ip, userAgent });

  await logAudit({
    actor: { id: user.id, name: user.username },
    action: "auth.login.password_ok",
    entityType: "AUTH",
    entityLabel: user.username,
    description: "Senha validada, aguardando verificação de MFA",
    status: "SUCCESS",
  });

  return { ok: true, userId: user.id, mustEnrollMfa: !user.mfaEnabled };
}
