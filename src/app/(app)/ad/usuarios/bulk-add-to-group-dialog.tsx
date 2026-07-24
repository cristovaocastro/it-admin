"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, UsersRound } from "lucide-react";
import { addAdGroupMemberAction } from "@/lib/actions/ad-groups-actions";
import { searchAdGroupsForPickerAction } from "@/lib/actions/ad-search-actions";

export function BulkAddToGroupDialog({
  connectionId,
  items,
  onDone,
}: {
  connectionId: string;
  items: { dn: string; label: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ dn: string; label: string }[]>([]);
  const [searching, startSearch] = useTransition();
  const [applying, startApply] = useTransition();

  function handleSearch() {
    startSearch(async () => {
      const result = await searchAdGroupsForPickerAction(connectionId, query);
      if ("error" in result) toast.error(result.error);
      setResults(result.groups ?? []);
    });
  }

  function applyToGroup(groupDn: string, groupLabel: string) {
    startApply(async () => {
      let ok = 0;
      let fail = 0;
      for (const item of items) {
        const fd = new FormData();
        fd.set("connectionId", connectionId);
        fd.set("groupDn", groupDn);
        fd.set("groupLabel", groupLabel);
        fd.set("memberDn", item.dn);
        const result = await addAdGroupMemberAction(undefined, fd);
        if (result?.error) fail++;
        else ok++;
      }
      if (fail === 0) toast.success(`${ok} usuário(s) adicionado(s) a "${groupLabel}".`);
      else toast.warning(`${ok} adicionado(s), ${fail} falharam ao adicionar a "${groupLabel}".`);
      setOpen(false);
      setResults([]);
      setQuery("");
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UsersRound className="size-4" />
        Adicionar a grupo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar {items.length} usuário(s) a um grupo</DialogTitle>
          <DialogDescription>Busque o grupo de destino no Active Directory.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar grupo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          />
          <Button type="button" variant="outline" disabled={searching} onClick={handleSearch}>
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </div>
        {results.length > 0 && (
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {results.map((r) => (
              <button
                key={r.dn}
                type="button"
                disabled={applying}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted disabled:opacity-50"
                onClick={() => applyToGroup(r.dn, r.label)}
              >
                {applying && <Loader2 className="size-3.5 animate-spin" />}
                {r.label}
              </button>
            ))}
          </div>
        )}
        <DialogFooter>{applying && <Loader2 className="size-4 animate-spin" />}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
