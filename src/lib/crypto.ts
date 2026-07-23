import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Criptografia simétrica (AES-256-GCM) usada para dados sensíveis em repouso:
// senha de bind das conexões AD e segredo TOTP dos usuários do painel.
// A chave vem de ENCRYPTION_KEY (base64, 32 bytes) — ver .env.example.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY não configurada. Gere uma com `openssl rand -base64 32` e defina no .env."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY inválida: precisa ser 32 bytes em base64.");
  }
  return key;
}

/** Criptografa uma string em texto plano. Retorna um payload em base64 auto-contido (iv + tag + dados). */
export function encryptSecret(plainText: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Descriptografa um payload gerado por encryptSecret. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Gera um token opaco aleatório (usado para tokens de sessão, códigos de recuperação, etc.). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Hash não-reversível (SHA-256 salgado com scrypt) usado para comparar tokens de sessão sem guardá-los em claro. */
export function hashToken(token: string): string {
  const salt = getKey(); // reaproveita a chave do servidor como "pepper" fixo — não precisa ser único por hash
  return scryptSync(token, salt, 32).toString("hex");
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
