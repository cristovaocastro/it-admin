"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAdGroupAction } from "@/lib/actions/ad-groups-actions";
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
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Pencil } from "lucide-react";
import type { AdGroupSummary } from "@/lib/ad/types";

export function EditAdGroupDialog({
  connectionId,
  group,
  onSuccess,
}: {
  connectionId: string;
  group: AdGroupSummary;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(updateAdGroupAction, undefined);
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
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Editar grupo" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar grupo</DialogTitle>
          <DialogDescription>Alterações são aplicadas diretamente no Active Directory.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="dn" value={group.dn} />
          <input type="hidden" name="label" value={group.name} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome do grupo</Label>
            <Input id="name" name="name" required defaultValue={group.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" defaultValue={group.description} />
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
