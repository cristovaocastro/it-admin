import "server-only";
import { describeBitdefenderError } from "@/lib/bitdefender/client";

/** Padroniza o tratamento de erros de operações GravityZone nas Server Actions: nunca deixa um erro virar um throw não tratado. */
export async function withBitdefenderErrorHandling<T>(fn: () => Promise<T>): Promise<{ error: string } | { ok: T }> {
  try {
    return { ok: await fn() };
  } catch (err) {
    return { error: describeBitdefenderError(err) };
  }
}
