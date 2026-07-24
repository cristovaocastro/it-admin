"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Loader2, Lock, ShieldOff, ShieldCheck, Trash2, Unlock, X } from "lucide-react";
import type { AdUserSummary } from "@/lib/ad/types";
import {
  setAdUserEnabledAction,
  unlockAdUserAction,
  deleteAdUserAction,
  moveAdUserAction,
} from "@/lib/actions/ad-users-actions";
import { ResetAdPasswordDialog } from "./reset-ad-password-dialog";
import { EditAdUserDialog } from "./edit-ad-user-dialog";
import { UserGroupsDialog } from "./user-groups-dialog";
import { CloneAdUserDialog } from "./clone-ad-user-dialog";
import { BulkAddToGroupDialog } from "./bulk-add-to-group-dialog";
import { BulkResetPasswordDialog } from "./bulk-reset-password-dialog";
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
  selected: AdUserSummary[];
  onClear: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const items = useMemo(() => selected.map((u) => ({ dn: u.dn, label: label(u) })), [selected]);

  function summarize(action: string, results: ({ error?: string } | undefined)[]) {
    const fail = results.filter((r) => r?.error).length;
    const ok = results.length - fail;
    if (fail === 0) toast.success(`${action}: ${ok} usuário(s) atualizado(s).`);
    else toast.warning(`${action}: ${ok} ok, ${fail} falharam.`);
    router.refresh();
    onDone();
  }

  function bulkSetEnabled(enabled: boolean) {
    startTransition(async () => {
      const results = [];
      for (const item of items) {
        results.push(await setAdUserEnabledAction({ connectionId, dn: item.dn, label: item.label, enabled }));
      }
      summarize(enabled ? "Habilitar" : "Desabilitar", results);
    });
  }

  function bulkUnlock() {
    startTransition(async () => {
      const results = [];
      for (const item of items) {
        results.push(await unlockAdUserAction({ connectionId, dn: item.dn, label: item.label }));
      }
      summarize("Desbloquear", results);
    });
  }

  async function bulkMove(newOuDn: string) {
    const results = [];
    for (const item of items) {
      results.push(await moveAdUserAction({ connectionId, dn: item.dn, label: item.label, newOuDn }));
    }
    const fail = results.filter((r) => r?.error).length;
    onDone();
    if (fail === 0) return { success: `${results.length} usuário(s) movido(s).` };
    return { error: `${results.length - fail} movido(s), ${fail} falharam.` };
  }

  function bulkDelete() {
    startTransition(async () => {
      const results = [];
      for (const item of items) {
        results.push(await deleteAdUserAction({ connectionId, dn: item.dn, label: item.label }));
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
        <Button variant="outline" size="sm" disabled={pending} onClick={bulkUnlock}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
          Desbloquear
        </Button>
        <BulkAddToGroupDialog connectionId={connectionId} items={items} onDone={onDone} />
        <BulkResetPasswordDialog connectionId={connectionId} items={items} onDone={onDone} />
        <MoveObjectDialog
          connectionId={connectionId}
          label={`${items.length} usuário(s)`}
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
              <AlertDialogTitle>Excluir {items.length} usuário(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                Os usuários serão removidos permanentemente do Active Directory. Essa ação não pode ser desfeita.
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

export function AdUsersTable({ users, connectionId }: { users: AdUserSummary[]; connectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingDn, setPendingDn] = useState<string | null>(null);
  const [selectedDns, setSelectedDns] = useState<Set<string>>(new Set());

  const selected = users.filter((u) => selectedDns.has(u.dn));
  const allSelected = users.length > 0 && selectedDns.size === users.length;

  function toggleAll(checked: boolean) {
    setSelectedDns(checked ? new Set(users.map((u) => u.dn)) : new Set());
  }

  function toggleOne(dn: string, checked: boolean) {
    setSelectedDns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(dn);
      else next.delete(dn);
      return next;
    });
  }

  function toggleEnabled(u: AdUserSummary) {
    setPendingDn(u.dn);
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
      setPendingDn(null);
    });
  }

  function unlock(u: AdUserSummary) {
    setPendingDn(u.dn);
    startTransition(async () => {
      const result = await unlockAdUserAction({ connectionId, dn: u.dn, label: label(u) });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Desbloqueado.");
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
            <TableHead>Login / Departamento / Cargo</TableHead>
            <TableHead>Telefone / E-mail</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Último acesso</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.dn}>
              <TableCell>
                <Checkbox
                  checked={selectedDns.has(u.dn)}
                  onCheckedChange={(checked) => toggleOne(u.dn, checked === true)}
                  aria-label={`Selecionar ${label(u)}`}
                />
              </TableCell>
              <TableCell className="font-medium">{u.displayName || "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                <div>{u.sAMAccountName}</div>
                <div className="text-xs text-muted-foreground">{u.department || "—"}</div>
                <div className="text-xs text-muted-foreground">{u.title || "—"}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div>{u.telephoneNumber || "—"}</div>
                <div className="text-xs text-muted-foreground">{u.mail || "—"}</div>
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground" title={u.description}>
                {u.description || "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {u.lastLogon ? (
                  <span
                    className={
                      new Date().getTime() - new Date(u.lastLogon).getTime() > 90 * 24 * 60 * 60 * 1000
                        ? "text-amber-600 dark:text-amber-500"
                        : undefined
                    }
                  >
                    {new Date(u.lastLogon).toLocaleDateString("pt-BR")}
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-500">nunca</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={u.enabled ? "secondary" : "outline"}>{u.enabled ? "habilitado" : "desabilitado"}</Badge>
                  {u.locked && (
                    <Badge variant="destructive">
                      <Lock className="size-3" /> bloqueado
                    </Badge>
                  )}
                  {u.passwordExpired && <Badge variant="outline">senha expirada</Badge>}
                  {u.passwordNeverExpires && <Badge variant="outline">senha nunca expira</Badge>}
                  {u.accountExpires && (
                    <Badge variant={new Date(u.accountExpires) < new Date() ? "destructive" : "outline"}>
                      conta expira {new Date(u.accountExpires).toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-0.5">
                  <EditAdUserDialog connectionId={connectionId} user={u} />
                  <UserGroupsDialog connectionId={connectionId} user={u} />
                  <CloneAdUserDialog connectionId={connectionId} user={u} />
                  <ResetAdPasswordDialog connectionId={connectionId} user={u} />
                  {u.locked && (
                    <Button variant="ghost" size="icon-sm" title="Desbloquear" disabled={pending} onClick={() => unlock(u)}>
                      {pendingDn === u.dn ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={u.enabled ? "Desabilitar" : "Habilitar"}
                    disabled={pending}
                    onClick={() => toggleEnabled(u)}
                  >
                    {pendingDn === u.dn ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : u.enabled ? (
                      <ShieldOff className="size-4" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
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
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                Nenhum usuário encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
