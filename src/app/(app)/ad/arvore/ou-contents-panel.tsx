"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Folder, Loader2, Lock, ShieldCheck, ShieldOff, Unlock, UserCog, UsersRound, Monitor } from "lucide-react";
import { getOuContentsAction } from "@/lib/actions/ad-tree-actions";
import { moveAdOuAction } from "@/lib/actions/ad-ou-actions";
import { setAdUserEnabledAction, unlockAdUserAction, moveAdUserAction } from "@/lib/actions/ad-users-actions";
import { setAdComputerEnabledAction, moveAdComputerAction } from "@/lib/actions/ad-computers-actions";
import { moveAdGroupAction } from "@/lib/actions/ad-groups-actions";
import { ResetAdPasswordDialog } from "../usuarios/reset-ad-password-dialog";
import { EditAdUserDialog } from "../usuarios/edit-ad-user-dialog";
import { DeleteAdUserButton } from "../usuarios/ad-users-table";
import { GroupMembersDialog } from "../grupos/group-members-dialog";
import { DeleteAdGroupButton } from "../grupos/ad-groups-table";
import { EditAdComputerDialog } from "../computadores/edit-ad-computer-dialog";
import { DeleteAdComputerButton } from "../computadores/ad-computers-table";
import { MoveObjectDialog } from "../move-object-dialog";
import { CreateOuDialog, RenameOuDialog, DeleteOuButton } from "./ou-actions";
import type { AdUserSummary, AdGroupSummary, AdComputerSummary } from "@/lib/ad/types";
import type { AdContainerNode } from "@/lib/ad/tree";

type Contents = {
  containers: AdContainerNode[];
  users: AdUserSummary[];
  groups: AdGroupSummary[];
  computers: AdComputerSummary[];
};

function userLabel(u: AdUserSummary) {
  return u.displayName || u.sAMAccountName;
}

export function OuContentsPanel({
  connectionId,
  dn,
  onNavigate,
  onTreeChange,
}: {
  connectionId: string;
  dn: string;
  onNavigate: (dn: string) => void;
  onTreeChange: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<Contents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startTransition] = useTransition();
  const [pendingDn, setPendingDn] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  function reload() {
    setTick((t) => t + 1);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reseta o erro ao trocar de pasta selecionada ou recarregar
    setError(null);
    startLoading(async () => {
      const result = await getOuContentsAction(connectionId, dn);
      if (result.error) {
        setError(result.error);
      } else {
        setData({
          containers: result.containers ?? [],
          users: result.users ?? [],
          groups: result.groups ?? [],
          computers: result.computers ?? [],
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dn, tick]);

  function toggleUserEnabled(u: AdUserSummary) {
    setPendingDn(u.dn);
    startTransition(async () => {
      const result = await setAdUserEnabledAction({ connectionId, dn: u.dn, label: userLabel(u), enabled: !u.enabled });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Atualizado.");
        router.refresh();
      }
      setPendingDn(null);
    });
  }

  function unlockUser(u: AdUserSummary) {
    setPendingDn(u.dn);
    startTransition(async () => {
      const result = await unlockAdUserAction({ connectionId, dn: u.dn, label: userLabel(u) });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Desbloqueado.");
        router.refresh();
      }
      setPendingDn(null);
    });
  }

  function toggleComputerEnabled(c: AdComputerSummary) {
    setPendingDn(c.dn);
    startTransition(async () => {
      const result = await setAdComputerEnabledAction({ connectionId, dn: c.dn, label: c.name, enabled: !c.enabled });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Atualizado.");
        router.refresh();
      }
      setPendingDn(null);
    });
  }

  if (loading && !data) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Erro ao consultar o AD</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const isEmpty =
    data.containers.length === 0 && data.users.length === 0 && data.groups.length === 0 && data.computers.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground" title={dn}>
          {dn}
        </p>
        <CreateOuDialog
          connectionId={connectionId}
          parentDn={dn}
          onSuccess={() => {
            reload();
            onTreeChange();
          }}
        />
      </div>
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.containers.map((c) => (
              <TableRow key={c.dn}>
                <TableCell>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 font-medium hover:underline"
                    onClick={() => onNavigate(c.dn)}
                  >
                    <Folder className="size-4 text-muted-foreground" />
                    {c.name}
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{c.kind === "OU" ? "OU" : "Container"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell>
                  {c.kind === "OU" && (
                    <div className="flex items-center justify-end gap-0.5">
                      <RenameOuDialog
                        connectionId={connectionId}
                        dn={c.dn}
                        currentName={c.name}
                        onSuccess={() => {
                          reload();
                          onTreeChange();
                        }}
                      />
                      <MoveObjectDialog
                        connectionId={connectionId}
                        label={c.name}
                        onMove={(newOuDn) => moveAdOuAction({ connectionId, dn: c.dn, label: c.name, newParentDn: newOuDn })}
                        onSuccess={() => {
                          reload();
                          onTreeChange();
                        }}
                      />
                      <DeleteOuButton
                        connectionId={connectionId}
                        dn={c.dn}
                        name={c.name}
                        onSuccess={() => {
                          reload();
                          onTreeChange();
                        }}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {data.users.map((u) => (
              <TableRow key={u.dn}>
                <TableCell className="font-medium">{userLabel(u)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    <UserCog className="size-3" /> Usuário
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={u.enabled ? "secondary" : "outline"}>{u.enabled ? "habilitado" : "desabilitado"}</Badge>
                    {u.locked && (
                      <Badge variant="destructive">
                        <Lock className="size-3" /> bloqueado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <EditAdUserDialog connectionId={connectionId} user={u} />
                    <ResetAdPasswordDialog connectionId={connectionId} user={u} />
                    {u.locked && (
                      <Button variant="ghost" size="icon-sm" title="Desbloquear" disabled={pending} onClick={() => unlockUser(u)}>
                        {pendingDn === u.dn ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={u.enabled ? "Desabilitar" : "Habilitar"}
                      disabled={pending}
                      onClick={() => toggleUserEnabled(u)}
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
                      label={userLabel(u)}
                      onMove={(newOuDn) => moveAdUserAction({ connectionId, dn: u.dn, label: userLabel(u), newOuDn })}
                      onSuccess={reload}
                    />
                    <DeleteAdUserButton connectionId={connectionId} user={u} onSuccess={reload} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {data.groups.map((g) => (
              <TableRow key={g.dn}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    <UsersRound className="size-3" /> Grupo
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{g.memberCount} membro(s)</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <GroupMembersDialog connectionId={connectionId} group={g} />
                    <MoveObjectDialog
                      connectionId={connectionId}
                      label={g.name}
                      onMove={(newOuDn) => moveAdGroupAction({ connectionId, dn: g.dn, label: g.name, newOuDn })}
                      onSuccess={reload}
                    />
                    <DeleteAdGroupButton connectionId={connectionId} group={g} onSuccess={reload} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {data.computers.map((c) => (
              <TableRow key={c.dn}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    <Monitor className="size-3" /> Computador
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.operatingSystem ?? "—"}
                  {" · "}
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
                      onClick={() => toggleComputerEnabled(c)}
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
                      onSuccess={reload}
                    />
                    <DeleteAdComputerButton connectionId={connectionId} computer={c} onSuccess={reload} />
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {isEmpty && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhum objeto nesta pasta.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
