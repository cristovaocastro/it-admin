"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdGroupAction } from "@/lib/actions/ad-groups-actions";
import { listAdConnectionOusAction } from "@/lib/actions/ad-ou-actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OuPickerField } from "../ou-picker-field";
import type { AdOrganizationalUnit } from "@/lib/ad/ou";

const SCOPE_OPTIONS = [
  { value: "Global", label: "Global" },
  { value: "DomainLocal", label: "Domínio local" },
  { value: "Universal", label: "Universal" },
];

export function CreateAdGroupDialog({ connectionId, defaultOu }: { connectionId: string; defaultOu?: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createAdGroupAction, undefined);
  const [ous, setOus] = useState<AdOrganizationalUnit[] | null>(null);
  const [ou, setOu] = useState(defaultOu ?? "");
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dialog após a Server Action confirmar sucesso
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  useEffect(() => {
    if (!open || ous !== null) return;
    listAdConnectionOusAction(connectionId).then((result) => {
      if (!result.error) setOus(result.ous ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="size-4" />
        Novo grupo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo grupo no Active Directory</DialogTitle>
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
          <div className="space-y-2">
            <Label htmlFor="name">Nome do grupo</Label>
            <Input id="name" name="name" required placeholder="TI-Suporte" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input id="description" name="description" />
          </div>
          <OuPickerField
            fieldName="ou"
            label="OU de destino (opcional)"
            placeholder="OU=Grupos,DC=empresa,DC=local"
            selectPlaceholder="Usar a OU padrão de grupos"
            value={ou}
            onChange={setOu}
            options={ous}
          />
          <div className="space-y-2">
            <Label htmlFor="scope">Escopo</Label>
            <Select name="scope" items={SCOPE_OPTIONS} defaultValue="Global">
              <SelectTrigger id="scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="security" className="text-sm">
              Grupo de segurança
            </Label>
            <Switch id="security" name="security" defaultChecked />
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Criando...">Criar grupo</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
