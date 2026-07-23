import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/generated/prisma/enums";

/** Usa em Server Components/Actions de páginas protegidas. Redireciona para /login se não autenticado. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/conta/trocar-senha");
  return session.user;
}

const ROLE_RANK: Record<UserRole, number> = {
  AUDITOR: 0,
  OPERATOR: 1,
  ADMIN: 2,
};

/** Exige que o usuário logado tenha um dos papéis informados; caso contrário, redireciona. */
export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect("/dashboard?erro=acesso_negado");
  }
  return user;
}

export function hasAtLeastRole(userRole: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minimum];
}
