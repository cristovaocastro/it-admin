import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/crypto";
import type { UserRole } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "itadmin_session";

// Janela para completar o desafio de MFA depois do login com senha.
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutos
// Duração de uma sessão totalmente autenticada (MFA verificado), renovada a cada request (sliding).
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
// Idade máxima absoluta de uma sessão, mesmo com atividade contínua.
const SESSION_ABSOLUTE_MAX_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
};

export type ActiveSession = {
  id: string;
  user: SessionUser;
};

async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Cria a sessão "pendente" logo após senha correta, antes da verificação de MFA. */
export async function createPendingSession(params: {
  userId: string;
  ip: string | null;
  userAgent: string | null;
}) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS);

  const session = await db.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      mfaVerified: false,
      ip: params.ip,
      userAgent: params.userAgent,
      expiresAt,
    },
  });

  await setSessionCookie(token, expiresAt);
  return session;
}

/** Após o código TOTP/recovery ser validado, promove a sessão pendente para totalmente autenticada. */
export async function promoteSessionToVerified(sessionId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.update({
    where: { id: sessionId },
    data: { mfaVerified: true, expiresAt, lastSeenAt: new Date() },
  });
  const token = await getRawTokenFromCookie();
  if (token) await setSessionCookie(token, expiresAt);
}

async function getRawTokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolve a sessão a partir do cookie da requisição atual.
 * Retorna null se não houver cookie, a sessão não existir, estiver expirada/revogada
 * ou o MFA ainda não tiver sido verificado (use getPendingSession para esse caso).
 */
export async function getSession(): Promise<ActiveSession | null> {
  const token = await getRawTokenFromCookie();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.mfaVerified) return null;
  if (session.user.status !== "ACTIVE") return null;

  // Sliding expiration, limitada pela idade máxima absoluta da sessão.
  const now = Date.now();
  const absoluteDeadline = session.createdAt.getTime() + SESSION_ABSOLUTE_MAX_MS;
  const nextExpiry = new Date(Math.min(now + SESSION_TTL_MS, absoluteDeadline));

  if (nextExpiry.getTime() > session.expiresAt.getTime() - 5 * 60 * 1000) {
    // só grava no banco se valer a pena (evita write em toda request)
    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: nextExpiry, lastSeenAt: new Date() },
    }).catch(() => undefined);
  }

  return {
    id: session.id,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      username: session.user.username,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
      mfaEnabled: session.user.mfaEnabled,
    },
  };
}

/** Sessão ainda não confirmada por MFA (usada nas telas de desafio/enrollment de MFA). */
export async function getPendingSession() {
  const token = await getRawTokenFromCookie();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session || session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.mfaVerified) return null;

  return session;
}

export async function revokeSession(sessionId: string, reason: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function revokeAllSessionsForUser(userId: string, reason: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function logout() {
  const token = await getRawTokenFromCookie();
  if (token) {
    const tokenHash = hashToken(token);
    await db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout" },
    });
  }
  await clearSessionCookie();
}
