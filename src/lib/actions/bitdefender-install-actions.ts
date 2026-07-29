"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guards";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { createBitdefenderInstallationPackage } from "@/lib/bitdefender/install";
import { withBitdefenderErrorHandling } from "@/lib/bitdefender/error-handling";

export type ActionState = { error?: string; success?: string } | undefined;

const packageSchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().min(2, "Informe um nome para o pacote."),
  description: z.string().optional(),
});

export async function createBitdefenderInstallationPackageAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const actor = await requireRole(["ADMIN", "OPERATOR"]);
  const parsed = packageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const config = await loadBitdefenderConnectionConfig(parsed.data.connectionId);
  const result = await withBitdefenderErrorHandling(() =>
    createBitdefenderInstallationPackage(config, { name: parsed.data.name, description: parsed.data.description })
  );

  await logAudit({
    actor: { id: actor.id, name: actor.username },
    action: "bitdefender_install_package.create",
    entityType: "BITDEFENDER_INSTALL_PACKAGE",
    entityId: "ok" in result ? result.ok : null,
    entityLabel: parsed.data.name,
    description:
      "error" in result
        ? `Falha ao gerar pacote de instalação "${parsed.data.name}": ${result.error}`
        : `Pacote de instalação "${parsed.data.name}" gerado`,
    metadata: { connectionId: parsed.data.connectionId },
    status: "error" in result ? "FAILURE" : "SUCCESS",
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/bitdefender/instalacao");
  return { success: "Pacote de instalação gerado." };
}
