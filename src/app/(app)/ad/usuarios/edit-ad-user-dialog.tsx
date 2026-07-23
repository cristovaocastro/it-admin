"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdUserAction } from "@/lib/actions/ad-users-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Pencil } from "lucide-react";
import type { AdUserSummary } from "@/lib/ad/types";

export function EditAdUserDialog({
  connectionId,
  user,
  onSuccess,
}: {
  connectionId: string;
  user: AdUserSummary;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateAdUserAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onSuccess?.();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dialog após a Server Action confirmar sucesso
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Editar atributos" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar atributos</DialogTitle>
          <DialogDescription>Alterações são aplicadas diretamente no Active Directory.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="dn" value={user.dn} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="givenName">Primeiro nome</Label>
              <Input id="givenName" name="givenName" defaultValue={user.givenName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sn">Sobrenome</Label>
              <Input id="sn" name="sn" defaultValue={user.sn} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="displayName">Nome de exibição</Label>
              <Input id="displayName" name="displayName" defaultValue={user.displayName} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail">E-mail</Label>
              <Input id="mail" name="mail" type="email" defaultValue={user.mail} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Cargo</Label>
              <Input id="title" name="title" defaultValue={user.title} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Input id="department" name="department" defaultValue={user.department} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephoneNumber">Telefone</Label>
              <Input id="telephoneNumber" name="telephoneNumber" defaultValue={user.telephoneNumber} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input id="description" name="description" defaultValue={user.description} />
            </div>
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
