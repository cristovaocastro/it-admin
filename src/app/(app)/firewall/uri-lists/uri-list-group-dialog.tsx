"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUriListGroupAction } from "@/lib/actions/firewall-uri-lists-actions";
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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Pencil, Plus } from "lucide-react";
import type { FirewallUriListGroup } from "@/lib/firewall/uri-lists";

function UriListGroupForm({
  connectionId,
  group,
  onClose,
}: {
  connectionId: string;
  group?: FirewallUriListGroup;
  onClose: () => void;
}) {
  const isEdit = !!group;
  const [state, formAction] = useActionState(saveUriListGroupAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEdit ? `Editar "${group.name}"` : "Novo grupo de URI list"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Ajuste quais URI lists fazem parte deste grupo. Nome e grupos aninhados não são alterados aqui."
            : "Agrupe URI lists já cadastradas (ou outros grupos) pelo nome exato. Alterações são aplicadas e gravadas diretamente no firewall."}
        </DialogDescription>
      </DialogHeader>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="connectionId" value={connectionId} />
        {isEdit && <input type="hidden" name="uuid" value={group.uuid} />}
        {state?.error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        {isEdit ? (
          <>
            <input type="hidden" name="name" value={group.name} />
            <input type="hidden" name="groupNames" value={group.groupNames.join("\n")} />
            <div className="space-y-2">
              <Label htmlFor="objectNames">URI lists membro (um nome por linha)</Label>
              <Textarea id="objectNames" name="objectNames" rows={5} defaultValue={group.objectNames.join("\n")} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="objectNames">URI lists membro (um nome por linha)</Label>
              <Textarea id="objectNames" name="objectNames" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupNames">Grupos membro (um nome por linha, opcional)</Label>
              <Textarea id="groupNames" name="groupNames" rows={2} />
            </div>
          </>
        )}
        <DialogFooter>
          <SubmitButton pendingText="Salvando...">{isEdit ? "Salvar alterações" : "Criar grupo"}</SubmitButton>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function CreateUriListGroupDialog({ connectionId }: { connectionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="size-4" />
        Novo grupo
      </DialogTrigger>
      <UriListGroupForm connectionId={connectionId} onClose={() => setOpen(false)} />
    </Dialog>
  );
}

export function EditUriListGroupDialog({ connectionId, group }: { connectionId: string; group: FirewallUriListGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Editar" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <UriListGroupForm connectionId={connectionId} group={group} onClose={() => setOpen(false)} />
    </Dialog>
  );
}
