"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBitdefenderInstallationPackageAction } from "@/lib/actions/bitdefender-install-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function InstallPackageForm({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(createBitdefenderInstallationPackageAction, undefined);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state?.success, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="connectionId" value={connectionId} />
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Nome do pacote</Label>
        <Input id="name" name="name" required placeholder="Padrão TI" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input id="description" name="description" />
      </div>
      <SubmitButton pendingText="Gerando...">Gerar pacote</SubmitButton>
    </form>
  );
}
