"use client";

import { useState, useTransition } from "react";
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
import type { AdUserSummary } from "@/lib/ad/types";
import { addAdGroupMemberAction, removeAdGroupMemberAction } from "@/lib/actions/ad-groups-actions";
import { searchAdGroupsForPickerAction } from "@/lib/actions/ad-search-actions";

export function UserGroupsDialog({ connectionId, user }: { connectionId: string; user: AdUserSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<string[]>(user.memberOf);
  const [mutating, startMutating] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ dn: string; label: string }[]>([]);
  const [searching, startSearch] = useTransition();

  const label = user.displayName || user.sAMAccountName;

  function handleSearch() {
    startSearch(async () => {
      const result = await searchAdGroupsForPickerAction(connectionId, query);
      if ("error" in result) toast.error(result.error);
      setResults(result.groups ?? []);
    });
  }

  function addGroup(groupDn: string, groupLabel: string) {
    startMutating(async () => {
      const fd = new FormData();
      fd.set("connectionId", connectionId);
      fd.set("groupDn", groupDn);
      fd.set("groupLabel", groupLabel);
      fd.set("memberDn", user.dn);
      const result = await addAdGroupMemberAction(undefined, fd);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Grupo adicionado.");
        setGroups((prev) => (prev.includes(groupDn) ? prev : [...prev, groupDn]));
        router.refresh();
      }
    });
  }

  function removeGroup(groupDn: string) {
    startMutating(async () => {
      const groupLabel = groupDn.split(",")[0].replace(/^CN=/, "");
      const result = await removeAdGroupMemberAction({ connectionId, groupDn, groupLabel, memberDn: user.dn });
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Grupo removido.");
        setGroups((prev) => prev.filter((g) => g !== groupDn));
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Grupos" />}>
        <Users className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Grupos de {label}</DialogTitle>
          <DialogDescription>Adicione ou remova o usuário de grupos diretamente no Active Directory.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar grupo para adicionar..."
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
                  disabled={mutating || groups.includes(r.dn)}
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-50"
                  onClick={() => addGroup(r.dn, r.label)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Membro de</p>
          {groups.length > 0 ? (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {groups.map((g) => (
                <div key={g} className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
                  <span className="truncate" title={g}>
                    {g.split(",")[0].replace(/^CN=/, "")}
                  </span>
                  <Button variant="ghost" size="icon-sm" disabled={mutating} onClick={() => removeGroup(g)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum grupo.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
