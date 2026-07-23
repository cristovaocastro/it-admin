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
import { Trash2 } from "lucide-react";
import type { FirewallUriListGroup } from "@/lib/firewall/uri-lists";
import { deleteUriListGroupAction } from "@/lib/actions/firewall-uri-lists-actions";
import { EditUriListGroupDialog } from "./uri-list-group-dialog";

function DeleteButton({ connectionId, group }: { connectionId: string; group: FirewallUriListGroup }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteUriListGroupAction({ connectionId, uuid: group.uuid, label: group.name });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Excluído.");
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
          <AlertDialogTitle>Excluir grupo &quot;{group.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            O grupo será removido permanentemente do firewall e a mudança já é aplicada (commit automático). Essa
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

export function UriListGroupsTable({ groups, connectionId }: { groups: FirewallUriListGroup[]; connectionId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>URI lists membro</TableHead>
          <TableHead>Grupos membro</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <TableRow key={g.uuid}>
            <TableCell className="font-medium">{g.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {g.objectNames.length > 0 ? g.objectNames.join(", ") : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {g.groupNames.length > 0 ? g.groupNames.join(", ") : "—"}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <EditUriListGroupDialog connectionId={connectionId} group={g} />
                <DeleteButton connectionId={connectionId} group={g} />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {groups.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
              Nenhum grupo cadastrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
