import "server-only";
import { AdOperationError } from "@/lib/ad/types";

/** Padroniza o tratamento de erros de operações AD nas Server Actions: nunca deixa uma AdOperationError virar um throw não tratado. */
export async function withAdErrorHandling<T>(fn: () => Promise<T>): Promise<{ error: string } | { ok: T }> {
  try {
    return { ok: await fn() };
  } catch (err) {
    const message = err instanceof AdOperationError ? err.message : "Falha inesperada ao comunicar com o AD.";
    return { error: message };
  }
}
