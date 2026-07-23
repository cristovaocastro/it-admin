"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createPanelUserAction } from "@/lib/actions/panel-users-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check, Copy, KeyRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_OPTIONS } from "@/lib/panel-user-options";

export function NewUserForm() {
  const [state, formAction] = useActionState(createPanelUserAction, undefined);
  const [copied, setCopied] = useState(false);

  if (state?.tempPassword) {
    return (
      <div className="space-y-4">
        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle>Senha temporária gerada</AlertTitle>
          <AlertDescription>
            Repasse esta senha ao usuário por um canal seguro. Ela só será exibida uma vez e precisará ser trocada
            no primeiro login.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
          <code className="flex-1 font-mono text-sm break-all">{state.tempPassword}</code>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => {
              navigator.clipboard.writeText(state.tempPassword!);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href={`/usuarios/${state.userId}`} />} className="flex-1">
            Ver usuário
          </Button>
          <Button variant="outline" render={<Link href="/usuarios" />} className="flex-1">
            Voltar à lista
          </Button>
        </div>
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
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" name="name" required autoFocus />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Usuário (login)</Label>
        <Input id="username" name="username" required placeholder="joao.silva" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Papel</Label>
        <Select name="role" items={ROLE_OPTIONS} defaultValue="OPERATOR">
          <SelectTrigger id="role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SubmitButton className="w-full" pendingText="Criando...">
        Criar usuário
      </SubmitButton>
    </form>
  );
}
