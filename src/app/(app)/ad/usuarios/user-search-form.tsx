"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export function UserSearchForm({ connectionId, defaultQuery }: { connectionId: string; defaultQuery?: string }) {
  return (
    <form method="get" action="/ad/usuarios" className="flex flex-1 items-end gap-2">
      <input type="hidden" name="conexao" value={connectionId} />
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Buscar</label>
        <Input name="q" defaultValue={defaultQuery ?? ""} placeholder="login, nome ou e-mail..." />
      </div>
      <Button type="submit" variant="outline">
        <Search className="size-4" />
        Buscar
      </Button>
    </form>
  );
}
