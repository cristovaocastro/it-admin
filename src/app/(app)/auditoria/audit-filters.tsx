"use client";

import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import Link from "next/link";

const ENTITY_OPTIONS = [
  { value: "AUTH", label: "Autenticação" },
  { value: "PANEL_USER", label: "Usuário do painel" },
  { value: "SESSION", label: "Sessão" },
  { value: "AD_CONNECTION", label: "Conexão AD" },
  { value: "AD_USER", label: "Usuário AD" },
  { value: "AD_GROUP", label: "Grupo AD" },
  { value: "AD_COMPUTER", label: "Computador AD" },
  { value: "AD_OU", label: "OU do AD" },
];

const STATUS_OPTIONS = [
  { value: "SUCCESS", label: "Sucesso" },
  { value: "FAILURE", label: "Falha" },
];

export function AuditFilters() {
  const sp = useSearchParams();
  const hasFilters = sp.get("q") || sp.get("entityType") || sp.get("status");

  return (
    <form method="get" action="/auditoria" className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Buscar</label>
        <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="ator, ação, descrição..." />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Entidade</label>
        <Select name="entityType" items={ENTITY_OPTIONS} defaultValue={sp.get("entityType") ?? undefined}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select name="status" items={STATUS_OPTIONS} defaultValue={sp.get("status") ?? undefined}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit">
        <Search className="size-4" />
        Filtrar
      </Button>
      {hasFilters && (
        <Button variant="ghost" render={<Link href="/auditoria" />}>
          <X className="size-4" />
          Limpar
        </Button>
      )}
    </form>
  );
}
