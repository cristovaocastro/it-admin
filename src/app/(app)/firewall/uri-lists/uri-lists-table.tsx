"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Trash2 } from "lucide-react";
import type { FirewallUriListObject } from "@/lib/firewall/uri-lists";
import { deleteUriListObjectAction } from "@/lib/actions/firewall-uri-lists-actions";

function DeleteButton({ connectionId, object }: { connectionId: string; object: FirewallUriListObject }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteUriListObjectAction({ connectionId, uuid: object.uuid, label: object.name });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Excluída.");
        router.refresh();
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
          <AlertDialogTitle>Excluir URI list &quot;{object.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            O objeto será removido permanentemente do firewall e a mudança já é aplicada (commit automático). Essa
            ação não pode ser desfeita.
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

export function UriListsTable({ objects, connectionId }: { objects: FirewallUriListObject[]; connectionId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>URIs</TableHead>
          <TableHead>Domínios</TableHead>
          <TableHead>Palavras-chave</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {objects.map((o) => (
          <TableRow key={o.uuid}>
            <TableCell className="font-medium">
              <Link href={`/firewall/uri-lists/${o.uuid}?conexao=${connectionId}`} className="hover:underline">
                {o.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{o.uris.length}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{o.domains.length}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{o.keywords.length}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <DeleteButton connectionId={connectionId} object={o} />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {objects.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              Nenhuma URI list cadastrada.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
