import "server-only";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { randomInt } from "crypto";
import * as argon2 from "argon2";

const ISSUER = process.env.APP_NAME || "IT Admin";
// Tolerância de 1 passo (30s) para cima/baixo, absorve pequena diferença de relógio do celular.
const EPOCH_TOLERANCE = 30;

/** Gera um novo segredo TOTP (base32) para um usuário. Deve ser criptografado antes de persistir. */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** Monta a URI otpauth:// e o QR code (data URL PNG) para o app autenticador escanear. */
export async function buildTotpEnrollment(secret: string, accountLabel: string) {
  const uri = generateURI({
    issuer: ISSUER,
    label: accountLabel,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(uri);
  return { uri, qrCodeDataUrl };
}

export async function verifyTotpToken(secret: string, token: string): Promise<boolean> {
  const cleaned = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const result = await verify({ secret, token: cleaned, epochTolerance: EPOCH_TOLERANCE });
  return result.valid;
}

const RECOVERY_CODE_COUNT = 10;

/** Gera um lote de códigos de recuperação em texto plano (mostrados uma única vez ao usuário). */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // formato XXXX-XXXX (base32-ish, fácil de digitar)
    const part = () =>
      Array.from({ length: 4 }, () => "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(32)]).join("");
    codes.push(`${part()}-${part()}`);
  }
  return codes;
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return argon2.hash(code.toUpperCase().trim());
}

export async function verifyRecoveryCode(hash: string, code: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, code.toUpperCase().trim());
  } catch {
    return false;
  }
}
