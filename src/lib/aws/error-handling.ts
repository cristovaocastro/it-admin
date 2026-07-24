import "server-only";
import { describeAwsError } from "@/lib/aws/client";

/** Padroniza o tratamento de erros de operações AWS nas Server Actions: nunca deixa um erro do SDK virar um throw não tratado. */
export async function withAwsErrorHandling<T>(fn: () => Promise<T>): Promise<{ error: string } | { ok: T }> {
  try {
    return { ok: await fn() };
  } catch (err) {
    return { error: describeAwsError(err) };
  }
}
