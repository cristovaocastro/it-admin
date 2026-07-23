"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUriListObjectAction } from "@/lib/actions/firewall-uri-lists-actions";
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
import { AlertCircle, Pencil, Plus } from "lucide-react";

function NameForm({
  connectionId,
  uuid,
  name,
  onClose,
}: {
  connectionId: string;
  uuid?: string;
  name?: string;
  onClose: () => void;
}) {
  const isEdit = !!uuid;
  const [state, formAction] = useActionState(saveUriListObjectAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? `Renomear "${name}"` : "Nova URI list"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Só o nome é alterado aqui — gerencie as entradas na tela da URI list."
            : "Cria uma URI list vazia; adicione URIs, domínios e palavras-chave na tela seguinte."}
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="connectionId" value={connectionId} />
        {isEdit && <input type="hidden" name="uuid" value={uuid} />}
        {state?.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" defaultValue={name} required />
        </div>
        <DialogFooter>
          <SubmitButton pendingText="Salvando...">{isEdit ? "Salvar" : "Criar URI list"}</SubmitButton>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function CreateUriListObjectDialog({ connectionId }: { connectionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nova URI list
      </DialogTrigger>
      <NameForm connectionId={connectionId} onClose={() => setOpen(false)} />
    </Dialog>
  );
}

export function RenameUriListObjectDialog({
  connectionId,
  uuid,
  name,
}: {
  connectionId: string;
  uuid: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Renomear" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <NameForm connectionId={connectionId} uuid={uuid} name={name} onClose={() => setOpen(false)} />
    </Dialog>
  );
}
