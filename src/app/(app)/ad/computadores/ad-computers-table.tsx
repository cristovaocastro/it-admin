"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, ShieldOff, ShieldCheck, Trash2, X } from "lucide-react";
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
            {pending && <Loader2 className="size-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BulkActionsBar({
  connectionId,
  selected,
  onClear,
  onDone,
}: {
  connectionId: string;
  selected: AdComputerSummary[];
  onClear: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const items = selected.map((c) => ({ dn: c.dn, label: c.name }));

  function summarize(action: string, results: ({ error?: string } | undefined)[]) {
    const fail = results.filter((r) => r?.error).length;
    const ok = results.length - fail;
    if (fail === 0) toast.success(`${action}: ${ok} computador(es) atualizado(s).`);
    else toast.warning(`${action}: ${ok} ok, ${fail} falharam.`);
    router.refresh();
    onDone();
  }

  function bulkSetEnabled(enabled: boolean) {
    startTransition(async () => {
      const results = [];
      for (const item of items) {
        results.push(await setAdComputerEnabledAction({ connectionId, dn: item.dn, label: item.label, enabled }));
      }
      summarize(enabled ? "Habilitar" : "Desabilitar", results);
    });
  }

  async function bulkMove(newOuDn: string) {
    const results = [];
    for (const item of items) {
      results.push(await moveAdComputerAction({ connectionId, dn: item.dn, label: item.label, newOuDn }));
    }
    const fail = results.filter((r) => r?.error).length;
    onDone();
    if (fail === 0) return { success: `${results.length} computador(es) movido(s).` };
    return { error: `${results.length - fail} movido(s), ${fail} falharam.` };
  }

  function bulkDelete() {
    startTransition(async () => {
      const results = [];
      for (const item of items) {
        results.push(await deleteAdComputerAction({ connectionId, dn: item.dn, label: item.label }));
      }
      setConfirmDelete(false);
      summarize("Excluir", results);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">{selected.length} selecionado(s)</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => bulkSetEnabled(true)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Habilitar
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => bulkSetEnabled(false)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
          Desabilitar
        </Button>
        <MoveObjectDialog
          connectionId={connectionId}
          label={`${items.length} computador(es)`}
          onMove={bulkMove}
          onSuccess={() => router.refresh()}
        />
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>
            <Trash2 className="size-4" />
            Excluir
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {items.length} computador(es)?</AlertDialogTitle>
              <AlertDialogDescription>
                Os objetos serão removidos permanentemente do Active Directory. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction disabled={pending} onClick={bulkDelete}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="ghost" size="icon-sm" title="Limpar seleção" onClick={onClear}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
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
  const [pendingDn, setPendingDn] = useState<string | null>(null);
  const [selectedDns, setSelectedDns] = useState<Set<string>>(new Set());

  const selected = computers.filter((c) => selectedDns.has(c.dn));
  const allSelected = computers.length > 0 && selectedDns.size === computers.length;

  function toggleAll(checked: boolean) {
    setSelectedDns(checked ? new Set(computers.map((c) => c.dn)) : new Set());
  }

  function toggleOne(dn: string, checked: boolean) {
    setSelectedDns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(dn);
      else next.delete(dn);
      return next;
    });
  }

  function toggleEnabled(c: AdComputerSummary) {
    setPendingDn(c.dn);
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
      setPendingDn(null);
    });
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <BulkActionsBar
          connectionId={connectionId}
          selected={selected}
          onClear={() => setSelectedDns(new Set())}
          onDone={() => setSelectedDns(new Set())}
        />
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="Selecionar todos"
              />
            </TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Sistema operacional</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Último logon</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {computers.map((c) => (
            <TableRow key={c.dn}>
              <TableCell>
                <Checkbox
                  checked={selectedDns.has(c.dn)}
                  onCheckedChange={(checked) => toggleOne(c.dn, checked === true)}
                  aria-label={`Selecionar ${c.name}`}
                />
              </TableCell>
              <TableCell className="font-medium">
                {c.name}
                {c.dnsHostName && <div className="text-xs font-normal text-muted-foreground">{c.dnsHostName}</div>}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.operatingSystem
                  ? `${c.operatingSystem}${c.operatingSystemVersion ? ` (${c.operatingSystemVersion})` : ""}`
                  : "—"}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground" title={c.description}>
                {c.description || "—"}
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
                    {pendingDn === c.dn ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : c.enabled ? (
                      <ShieldOff className="size-4" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
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
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Nenhum computador encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
