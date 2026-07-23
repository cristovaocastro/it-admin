"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdUserAction } from "@/lib/actions/ad-users-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus } from "lucide-react";

export function CreateAdUserDialog({ connectionId, defaultOu }: { connectionId: string; defaultOu?: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createAdUserAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dialog após a Server Action confirmar sucesso
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Novo usuário AD
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo usuário no Active Directory</DialogTitle>
          <DialogDescription>Criado diretamente na conexão AD selecionada.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="connectionId" value={connectionId} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="givenName">Primeiro nome</Label>
              <Input id="givenName" name="givenName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sn">Sobrenome</Label>
              <Input id="sn" name="sn" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sAMAccountName">Login (sAMAccountName)</Label>
              <Input id="sAMAccountName" name="sAMAccountName" required placeholder="joao.silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPrincipalName">UPN</Label>
              <Input id="userPrincipalName" name="userPrincipalName" required placeholder="joao.silva@empresa.local" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail">E-mail (opcional)</Label>
              <Input id="mail" name="mail" type="email" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ou">OU de destino (opcional)</Label>
              <Input id="ou" name="ou" defaultValue={defaultOu ?? ""} placeholder="OU=Usuarios,DC=empresa,DC=local" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="password">Senha inicial</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="mustChangePasswordAtLogon" className="text-sm">
              Exigir troca de senha no primeiro login
            </Label>
            <Switch id="mustChangePasswordAtLogon" name="mustChangePasswordAtLogon" defaultChecked />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="enabled" className="text-sm">
              Conta habilitada
            </Label>
            <Switch id="enabled" name="enabled" defaultChecked />
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Criando...">Criar usuário</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
