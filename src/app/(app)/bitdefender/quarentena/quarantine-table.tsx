"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import type { BitdefenderQuarantineItem } from "@/lib/bitdefender/types";
import {
  restoreBitdefenderQuarantineItemAction,
  removeBitdefenderQuarantineItemAction,
} from "@/lib/actions/bitdefender-quarantine-actions";

export function QuarantineTable({ items, connectionId }: { items: BitdefenderQuarantineItem[]; connectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function label(item: BitdefenderQuarantineItem) {
    return item.threatName ?? item.filePath ?? item.id;
  }

  function restore(item: BitdefenderQuarantineItem) {
    setPendingId(item.id);
    startTransition(async () => {
      const result = await restoreBitdefenderQuarantineItemAction({ connectionId, itemId: item.id, label: label(item) });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Restaurado.");
        router.refresh();
      }
      setPendingId(null);
    });
  }

  function remove(item: BitdefenderQuarantineItem) {
    setPendingId(item.id);
    startTransition(async () => {
      const result = await removeBitdefenderQuarantineItemAction({ connectionId, itemId: item.id, label: label(item) });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Removido.");
        router.refresh();
      }
      setPendingId(null);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ameaça</TableHead>
          <TableHead>Arquivo</TableHead>
          <TableHead>Endpoint</TableHead>
          <TableHead>Detectado em</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isPending = pendingId === item.id;
          return (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.threatName ?? "—"}</TableCell>
              <TableCell className="max-w-[280px] truncate text-muted-foreground" title={item.filePath ?? undefined}>
                {item.filePath ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{item.endpointName ?? item.endpointId}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {item.detectionTime ? new Date(item.detectionTime).toLocaleString("pt-BR") : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Restaurar"
                    disabled={pending}
                    onClick={() => restore(item)}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" title="Remover em definitivo" />}>
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover item &quot;{label(item)}&quot; em definitivo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O arquivo será apagado da quarentena e não poderá mais ser restaurado.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(item)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              Nenhum item em quarentena.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
