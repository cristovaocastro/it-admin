"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createUriListObjectAction } from "@/lib/actions/firewall-uri-lists-actions";
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
import { AlertCircle, Plus } from "lucide-react";

function CreateForm({ connectionId, onClose }: { connectionId: string; onClose: () => void }) {
  const [state, formAction] = useActionState(createUriListObjectAction, undefined);
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
        <DialogTitle>Nova URI list</DialogTitle>
        <DialogDescription>
          Cria uma URI list vazia; adicione as entradas (URIs, domínios ou palavras-chave) na tela seguinte. O nome
          não pode ser alterado depois de criada.
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="connectionId" value={connectionId} />
        {state?.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" required />
        </div>
        <DialogFooter>
          <SubmitButton pendingText="Salvando...">Criar URI list</SubmitButton>
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
      <CreateForm connectionId={connectionId} onClose={() => setOpen(false)} />
    </Dialog>
  );
}
