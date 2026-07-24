"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

const LAST_LOGON_OPTIONS = [
  { value: "", label: "Qualquer" },
  { value: "nunca", label: "Nunca acessou" },
  { value: "30", label: "Sem acesso há 30+ dias" },
  { value: "60", label: "Sem acesso há 60+ dias" },
  { value: "90", label: "Sem acesso há 90+ dias" },
  { value: "180", label: "Sem acesso há 180+ dias" },
];

export function UserSearchForm({
  connectionId,
  defaultQuery,
  defaultLastLogon,
}: {
  connectionId: string;
  defaultQuery?: string;
  defaultLastLogon?: string;
}) {
  return (
    <form method="get" action="/ad/usuarios" className="flex flex-1 flex-wrap items-end gap-2">
      <input type="hidden" name="conexao" value={connectionId} />
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Buscar</label>
        <Input
          name="q"
          defaultValue={defaultQuery ?? ""}
          placeholder="login, nome, e-mail, departamento, cargo ou descrição..."
        />
      </div>
      <div className="space-y-1.5">
        <label
          className="text-xs font-medium text-muted-foreground"
          title="Baseado em lastLogonTimestamp, que o AD replica entre controladores de domínio com até ~14 dias de atraso por padrão."
        >
          Último acesso
        </label>
        <select
          name="acesso"
          defaultValue={defaultLastLogon ?? ""}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {LAST_LOGON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="outline">
        <Search className="size-4" />
        Buscar
      </Button>
    </form>
  );
}
