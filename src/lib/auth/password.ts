import "server-only";
import * as argon2 from "argon2";

// Hash de senha com Argon2id (vencedor da Password Hashing Competition, recomendado
// pela OWASP sobre bcrypt/scrypt para novos sistemas).
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, recomendação OWASP
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export type PasswordPolicyResult = { valid: true } | { valid: false; reason: string };

/** Política mínima de senha para usuários do painel. */
export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 12) {
    return { valid: false, reason: "A senha precisa ter no mínimo 12 caracteres." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, reason: "A senha precisa ter ao menos uma letra minúscula." };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: "A senha precisa ter ao menos uma letra maiúscula." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: "A senha precisa ter ao menos um número." };
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, reason: "A senha precisa ter ao menos um caractere especial." };
  }
  return { valid: true };
}
