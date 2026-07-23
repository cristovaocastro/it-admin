"use client";

import { useActionState, useState } from "react";
import { verifyMfaAction, verifyRecoveryCodeAction } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function ChallengeForm() {
  const [useRecovery, setUseRecovery] = useState(false);
  const [totpState, totpAction] = useActionState(verifyMfaAction, undefined);
  const [recoveryState, recoveryAction] = useActionState(verifyRecoveryCodeAction, undefined);

  if (useRecovery) {
    return (
      <div className="space-y-4">
        <form action={recoveryAction} className="space-y-4">
          {recoveryState?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{recoveryState.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="code">Código de recuperação</Label>
            <Input id="code" name="code" autoFocus required placeholder="XXXX-XXXX" className="font-mono" />
          </div>
          <SubmitButton className="w-full" pendingText="Verificando...">
            Entrar com código de recuperação
          </SubmitButton>
        </form>
        <Button variant="link" className="w-full" type="button" onClick={() => setUseRecovery(false)}>
          Voltar para o código do app autenticador
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={totpAction} className="space-y-4">
        {totpState?.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{totpState.error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="token">Código de 6 dígitos</Label>
          <Input
            id="token"
            name="token"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoFocus
            required
            placeholder="000000"
            className="text-center text-lg tracking-[0.5em]"
          />
        </div>
        <SubmitButton className="w-full" pendingText="Verificando...">
          Verificar
        </SubmitButton>
      </form>
      <Button variant="link" className="w-full" type="button" onClick={() => setUseRecovery(true)}>
        Usar um código de recuperação
      </Button>
    </div>
  );
}
