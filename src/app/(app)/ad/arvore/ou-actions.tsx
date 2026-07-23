"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createAdOuAction, renameAdOuAction, deleteAdOuAction } from "@/lib/actions/ad-ou-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, FolderPlus, Pencil, Trash2 } from "lucide-react";

export function CreateOuDialog({
  connectionId,
  parentDn,
  onSuccess,
}: {
  connectionId: string;
  parentDn: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createAdOuAction, undefined);

  useEffect(() => {
    if (state?.success) {
      onSuccess();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dialog após a Server Action confirmar sucesso
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <FolderPlus className="size-4" />
        Nova OU aqui
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova OU</DialogTitle>
          <DialogDescription className="truncate" title={parentDn}>
            Criada dentro de: {parentDn}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="parentDn" value={parentDn} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome da OU</Label>
            <Input id="name" name="name" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" name="description" />
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Criando...">Criar OU</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenameOuDialog({
  connectionId,
  dn,
  currentName,
  onSuccess,
}: {
  connectionId: string;
  dn: string;
  currentName: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(renameAdOuAction, undefined);

  useEffect(() => {
    if (state?.success) {
      onSuccess();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dialog após a Server Action confirmar sucesso
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Renomear" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear OU</DialogTitle>
          <DialogDescription>&quot;{currentName}&quot;</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="dn" value={dn} />
          <input type="hidden" name="label" value={currentName} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="newName">Novo nome</Label>
            <Input id="newName" name="newName" defaultValue={currentName} required autoFocus />
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Salvando...">Renomear</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteOuButton({
  connectionId,
  dn,
  name,
  onSuccess,
}: {
  connectionId: string;
  dn: string;
  name: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteAdOuAction({ connectionId, dn, label: name });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "OU excluída.");
        onSuccess();
      }
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" title="Excluir OU" />}>
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir OU &quot;{name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            A OU será removida permanentemente do Active Directory. Ela precisa estar vazia — mova ou exclua o
            conteúdo antes, se houver. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={confirmDelete}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
