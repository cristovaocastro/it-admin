import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { generateTotpSecret, buildTotpEnrollment } from "@/lib/auth/mfa";
import { getPendingSession } from "@/lib/auth/session";

/** Usado pela página de enrollment (Server Component) — não é uma Server Action. */
export async function getOrCreateEnrollmentSecret() {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");
  if (pending.user.mfaEnabled) redirect("/mfa/verificar");

  let secretEncrypted = pending.user.mfaSecret;
  if (!secretEncrypted) {
    const secret = generateTotpSecret();
    secretEncrypted = encryptSecret(secret);
    await db.user.update({ where: { id: pending.user.id }, data: { mfaSecret: secretEncrypted } });
  }
  const secret = decryptSecret(secretEncrypted);
  const { qrCodeDataUrl, uri } = await buildTotpEnrollment(secret, pending.user.email);
  return { qrCodeDataUrl, uri, secret, username: pending.user.username };
}

/** Usado pela página de desafio de MFA (Server Component) — não é uma Server Action. */
export async function getPendingChallengeUser() {
  const pending = await getPendingSession();
  if (!pending) redirect("/login");
  if (!pending.user.mfaEnabled) redirect("/mfa/configurar");
  return pending.user;
}
