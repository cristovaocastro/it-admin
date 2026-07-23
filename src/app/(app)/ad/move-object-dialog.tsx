"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderInput, Loader2 } from "lucide-react";
import type { AdOrganizationalUnit } from "@/lib/ad/ou";

export function MoveObjectDialog({
  connectionId,
  label,
  onMove,
  onSuccess,
}: {
  connectionId: string;
  label: string;
  onMove: (newOuDn: string) => Promise<{ error?: string; success?: string } | undefined>;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ous, setOus] = useState<AdOrganizationalUnit[] | null>(null);
  const [loadingOus, startLoadOus] = useTransition();
  const [selected, setSelected] = useState("");
  const [moving, startMove] = useTransition();

  useEffect(() => {
    if (!open || ous !== null) return;
    startLoadOus(async () => {
      const result = await listAdConnectionOusAction(connectionId);
      if (result.error) toast.error(result.error);
      else setOus(result.ous ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleMove() {
    if (!selected) return;
    startMove(async () => {
      const result = await onMove(selected);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(result?.success ?? "Movido.");
        setOpen(false);
        setSelected("");
        onSuccess?.();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Mover para outra OU" />}>
        <FolderInput className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover &quot;{label}&quot;</DialogTitle>
          <DialogDescription>Escolha a OU de destino no Active Directory.</DialogDescription>
        </DialogHeader>
        {loadingOus && !ous ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <Select
            items={Object.fromEntries((ous ?? []).map((o) => [o.dn, o.dn]))}
            value={selected || undefined}
            onValueChange={(v) => setSelected(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione a OU de destino" />
            </SelectTrigger>
            <SelectContent>
              {(ous ?? []).map((o) => (
                <SelectItem key={o.dn} value={o.dn}>
                  {o.dn}
                </SelectItem>
              ))}
              {ous && ous.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma OU encontrada.</p>
              )}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button disabled={!selected || moving} onClick={handleMove}>
            {moving && <Loader2 className="size-4 animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
