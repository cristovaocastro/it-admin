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
import { Lock, ShieldOff, ShieldCheck, Trash2, Unlock } from "lucide-react";
import type { AdUserSummary } from "@/lib/ad/types";
import {
  setAdUserEnabledAction,
  unlockAdUserAction,
  deleteAdUserAction,
  moveAdUserAction,
} from "@/lib/actions/ad-users-actions";
import { ResetAdPasswordDialog } from "./reset-ad-password-dialog";
import { EditAdUserDialog } from "./edit-ad-user-dialog";
import { MoveObjectDialog } from "../move-object-dialog";

function label(u: AdUserSummary) {
  return u.displayName || u.sAMAccountName;
}

export function DeleteAdUserButton({
  connectionId,
  user,
  onSuccess,
}: {
  connectionId: string;
  user: AdUserSummary;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteAdUserAction({ connectionId, dn: user.dn, label: label(user) });
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
          <AlertDialogTitle>Excluir usuário &quot;{label(user)}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            O usuário será removido permanentemente do Active Directory. Essa ação não pode ser desfeita.
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

export function AdUsersTable({ users, connectionId }: { users: AdUserSummary[]; connectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggleEnabled(u: AdUserSummary) {
    startTransition(async () => {
      const result = await setAdUserEnabledAction({
        connectionId,
        dn: u.dn,
        label: label(u),
        enabled: !u.enabled,
      });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Atualizado.");
        router.refresh();
      }
    });
  }

  function unlock(u: AdUserSummary) {
    startTransition(async () => {
      const result = await unlockAdUserAction({ connectionId, dn: u.dn, label: label(u) });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Desbloqueado.");
        router.refresh();
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Login</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.dn}>
            <TableCell className="font-medium">{u.displayName || "—"}</TableCell>
            <TableCell className="text-muted-foreground">{u.sAMAccountName}</TableCell>
            <TableCell className="text-muted-foreground">{u.mail || "—"}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge variant={u.enabled ? "secondary" : "outline"}>{u.enabled ? "habilitado" : "desabilitado"}</Badge>
                {u.locked && (
                  <Badge variant="destructive">
                    <Lock className="size-3" /> bloqueado
                  </Badge>
                )}
                {u.passwordExpired && <Badge variant="outline">senha expirada</Badge>}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <EditAdUserDialog connectionId={connectionId} user={u} />
                <ResetAdPasswordDialog connectionId={connectionId} user={u} />
                {u.locked && (
                  <Button variant="ghost" size="icon-sm" title="Desbloquear" disabled={pending} onClick={() => unlock(u)}>
                    <Unlock className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={u.enabled ? "Desabilitar" : "Habilitar"}
                  disabled={pending}
                  onClick={() => toggleEnabled(u)}
                >
                  {u.enabled ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                </Button>
                <MoveObjectDialog
                  connectionId={connectionId}
                  label={label(u)}
                  onMove={(newOuDn) => moveAdUserAction({ connectionId, dn: u.dn, label: label(u), newOuDn })}
                  onSuccess={() => router.refresh()}
                />
                <DeleteAdUserButton connectionId={connectionId} user={u} />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
              Nenhum usuário encontrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
