"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import type { AdComputerSummary } from "@/lib/ad/types";
import {
  setAdComputerEnabledAction,
  deleteAdComputerAction,
  moveAdComputerAction,
} from "@/lib/actions/ad-computers-actions";
import { EditAdComputerDialog } from "./edit-ad-computer-dialog";
import { MoveObjectDialog } from "../move-object-dialog";

export function DeleteAdComputerButton({
  connectionId,
  computer,
  onSuccess,
}: {
  connectionId: string;
  computer: AdComputerSummary;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteAdComputerAction({ connectionId, dn: computer.dn, label: computer.name });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Excluído.");
        router.refresh();
        onSuccess?.();
      }
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" title="Excluir" />}>
        <Trash2 className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir computador &quot;{computer.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            O objeto será removido permanentemente do Active Directory — a máquina perderá o vínculo com o domínio.
            Essa ação não pode ser desfeita.
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

export function AdComputersTable({
  computers,
  connectionId,
}: {
  computers: AdComputerSummary[];
  connectionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleEnabled(c: AdComputerSummary) {
    startTransition(async () => {
      const result = await setAdComputerEnabledAction({
        connectionId,
        dn: c.dn,
        label: c.name,
        enabled: !c.enabled,
      });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Atualizado.");
        router.refresh();
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Sistema operacional</TableHead>
          <TableHead>Último logon</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {computers.map((c) => (
          <TableRow key={c.dn}>
            <TableCell className="font-medium">
              {c.name}
              {c.dnsHostName && <div className="text-xs font-normal text-muted-foreground">{c.dnsHostName}</div>}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {c.operatingSystem
                ? `${c.operatingSystem}${c.operatingSystemVersion ? ` (${c.operatingSystemVersion})` : ""}`
                : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {c.lastLogon ? new Date(c.lastLogon).toLocaleString("pt-BR") : "—"}
            </TableCell>
            <TableCell>
              <Badge variant={c.enabled ? "secondary" : "outline"}>{c.enabled ? "habilitado" : "desabilitado"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <EditAdComputerDialog connectionId={connectionId} computer={c} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={c.enabled ? "Desabilitar" : "Habilitar"}
                  disabled={pending}
                  onClick={() => toggleEnabled(c)}
                >
                  {c.enabled ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                </Button>
                <MoveObjectDialog
                  connectionId={connectionId}
                  label={c.name}
                  onMove={(newOuDn) => moveAdComputerAction({ connectionId, dn: c.dn, label: c.name, newOuDn })}
                  onSuccess={() => router.refresh()}
                />
                <DeleteAdComputerButton connectionId={connectionId} computer={c} />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {computers.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              Nenhum computador encontrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
