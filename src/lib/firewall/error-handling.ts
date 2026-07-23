import "server-only";
import { FirewallOperationError } from "@/lib/firewall/types";

/** Padroniza o tratamento de erros de operações de firewall nas Server Actions: nunca deixa uma FirewallOperationError virar um throw não tratado. */
export async function withFirewallErrorHandling<T>(fn: () => Promise<T>): Promise<{ error: string } | { ok: T }> {
  try {
    return { ok: await fn() };
  } catch (err) {
    const message = err instanceof FirewallOperationError ? err.message : "Falha inesperada ao comunicar com o firewall.";
    return { error: message };
  }
}
