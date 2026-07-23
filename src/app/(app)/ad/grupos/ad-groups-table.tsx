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
import { Trash2 } from "lucide-react";
import type { AdGroupSummary } from "@/lib/ad/types";
import { deleteAdGroupAction, moveAdGroupAction } from "@/lib/actions/ad-groups-actions";
import { GroupMembersDialog } from "./group-members-dialog";
import { MoveObjectDialog } from "../move-object-dialog";

const SCOPE_LABEL: Record<AdGroupSummary["scope"], string> = {
  DomainLocal: "Domínio local",
  Global: "Global",
  Universal: "Universal",
};

export function DeleteAdGroupButton({
  connectionId,
  group,
  onSuccess,
}: {
  connectionId: string;
  group: AdGroupSummary;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteAdGroupAction({ connectionId, dn: group.dn, label: group.name });
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
          <AlertDialogTitle>Excluir grupo &quot;{group.name}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            O grupo será removido permanentemente do Active Directory. Essa ação não pode ser desfeita.
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

export function AdGroupsTable({ groups, connectionId }: { groups: AdGroupSummary[]; connectionId: string }) {
  const router = useRouter();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Escopo</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead>Membros</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <TableRow key={g.dn}>
            <TableCell className="font-medium">{g.name}</TableCell>
            <TableCell>
              <Badge variant={g.security ? "secondary" : "outline"}>
                {g.security ? "Segurança" : "Distribuição"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{SCOPE_LABEL[g.scope]}</TableCell>
            <TableCell className="max-w-[220px] truncate text-muted-foreground" title={g.description}>
              {g.description || "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">{g.memberCount}</TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <GroupMembersDialog connectionId={connectionId} group={g} />
                <MoveObjectDialog
                  connectionId={connectionId}
                  label={g.name}
                  onMove={(newOuDn) => moveAdGroupAction({ connectionId, dn: g.dn, label: g.name, newOuDn })}
                  onSuccess={() => router.refresh()}
                />
                <DeleteAdGroupButton connectionId={connectionId} group={g} />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {groups.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              Nenhum grupo encontrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
