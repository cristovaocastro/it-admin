"use client";

import { useActionState } from "react";
import Link from "next/link";
import { confirmMfaEnrollmentAction } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ShieldAlert } from "lucide-react";

export function EnrollForm() {
  const [state, formAction] = useActionState(confirmMfaEnrollmentAction, undefined);

  if (state?.recoveryCodes) {
    return (
      <div className="space-y-4">
        <Alert>
          <ShieldAlert className="size-4" />
          <AlertTitle>Guarde seus códigos de recuperação</AlertTitle>
          <AlertDescription>
            Use um destes códigos para entrar caso perca acesso ao seu app autenticador. Cada código só pode ser
            usado uma vez. Eles não serão mostrados novamente.
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/50 p-4 font-mono text-sm">
          {state.recoveryCodes.map((code) => (
            <div key={code}>{code}</div>
          ))}
        </div>
        <Button render={<Link href={state.nextHref ?? "/dashboard"} />} className="w-full">
          Já salvei meus códigos, continuar
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
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
      <SubmitButton className="w-full" pendingText="Confirmando...">
        Confirmar e ativar MFA
      </SubmitButton>
    </form>
  );
}
