"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Users, X } from "lucide-react";
import type { AdGroupSummary } from "@/lib/ad/types";
import {
  getAdGroupMembersAction,
  addAdGroupMemberAction,
  removeAdGroupMemberAction,
} from "@/lib/actions/ad-groups-actions";
import { searchAdUsersForPickerAction } from "@/lib/actions/ad-search-actions";

export function GroupMembersDialog({ connectionId, group }: { connectionId: string; group: AdGroupSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<string[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [mutating, startMutating] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ dn: string; label: string }[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await getAdGroupMembersAction(connectionId, group.dn);
      if ("error" in result) {
        toast.error(result.error);
        setMembers([]);
      } else {
        setMembers(result.members ?? []);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSearch() {
    startSearch(async () => {
      const result = await searchAdUsersForPickerAction(connectionId, query);
      if ("error" in result) toast.error(result.error);
      setResults(result.users ?? []);
    });
  }

  function addMember(memberDn: string) {
    startMutating(async () => {
      const fd = new FormData();
      fd.set("connectionId", connectionId);
      fd.set("groupDn", group.dn);
      fd.set("groupLabel", group.name);
      fd.set("memberDn", memberDn);
      const result = await addAdGroupMemberAction(undefined, fd);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Membro adicionado.");
        setMembers((prev) => (prev ? [...prev, memberDn] : [memberDn]));
        router.refresh();
      }
    });
  }

  function removeMember(memberDn: string) {
    startMutating(async () => {
      const result = await removeAdGroupMemberAction({ connectionId, groupDn: group.dn, groupLabel: group.name, memberDn });
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Membro removido.");
        setMembers((prev) => prev?.filter((m) => m !== memberDn) ?? null);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Gerenciar membros" />}>
        <Users className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Membros de {group.name}</DialogTitle>
          <DialogDescription>Adicione ou remova membros diretamente no Active Directory.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar usuário para adicionar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
            />
            <Button type="button" variant="outline" disabled={searching} onClick={handleSearch}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
              {results.map((r) => (
                <button
                  key={r.dn}
                  type="button"
                  disabled={mutating}
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => addMember(r.dn)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Membros atuais</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : members && members.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {members.map((m) => (
                <div key={m} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <span className="truncate" title={m}>
                    {m.split(",")[0].replace(/^CN=/, "")}
                  </span>
                  <Button variant="ghost" size="icon-sm" disabled={mutating} onClick={() => removeMember(m)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum membro.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
