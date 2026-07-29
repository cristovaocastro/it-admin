import "server-only";
import { describeOciError } from "@/lib/oci/client";

/** Padroniza o tratamento de erros de operações OCI nas Server Actions: nunca deixa um erro do SDK virar um throw não tratado. */
export async function withOciErrorHandling<T>(fn: () => Promise<T>): Promise<{ error: string } | { ok: T }> {
  try {
    return { ok: await fn() };
  } catch (err) {
    return { error: describeOciError(err) };
  }
}
