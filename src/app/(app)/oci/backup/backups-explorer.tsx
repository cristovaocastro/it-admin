"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, X } from "lucide-react";
import { resourceDisplayName, resourceKindLabel, type OciBackup } from "@/lib/oci/backup-shared";

const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  AVAILABLE: "secondary",
  ACTIVE: "secondary",
  CREATING: "outline",
  RESTORING: "outline",
  TERMINATING: "destructive",
  TERMINATED: "destructive",
  FAULTY: "destructive",
};

const ALL = "__all__";

export function BackupsExplorer({ backups }: { backups: OciBackup[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState(ALL);
  const [state, setState] = useState(ALL);

  const kindOptions = useMemo(() => Array.from(new Set(backups.map((b) => b.kind))).sort(), [backups]);
  const stateOptions = useMemo(() => Array.from(new Set(backups.map((b) => b.state))).sort(), [backups]);

  const filtered = backups.filter((b) => {
    if (kind !== ALL && b.kind !== kind) return false;
    if (state !== ALL && b.state !== state) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = `${resourceDisplayName(b)} ${b.sourceResourceId ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasFilters = query.trim() !== "" || kind !== ALL || state !== ALL;

  const kindItems: Record<string, string> = Object.fromEntries([
    [ALL, "Todos os tipos"],
    ...kindOptions.map((k) => [k, resourceKindLabel(k)]),
  ]);
  const stateItems: Record<string, string> = Object.fromEntries([
    [ALL, "Todos os status"],
    ...stateOptions.map((s) => [s, s]),
  ]);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Backups{" "}
            <span className="font-normal text-muted-foreground">
              ({filtered.length}/{backups.length})
            </span>
          </CardTitle>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setKind(ALL);
                setState(ALL);
              }}
            >
              <X className="size-4" />
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="nome do backup ou OCID de origem..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de recurso</Label>
            <Select items={kindItems} value={kind} onValueChange={(value) => setKind(value ?? ALL)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(kindItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <Select items={stateItems} value={state} onValueChange={(value) => setState(value ?? ALL)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(stateItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recurso</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="max-w-[320px]">
                  <div className="truncate font-medium" title={resourceDisplayName(b)}>
                    {resourceDisplayName(b)}
                  </div>
                  {b.sourceResourceId && (
                    <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70" title={b.sourceResourceId}>
                      {b.sourceResourceId}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{resourceKindLabel(b.kind)}</TableCell>
                <TableCell className="text-muted-foreground">{b.sizeLabel ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{b.region}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {b.timeCreated ? new Date(b.timeCreated).toLocaleString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATE_VARIANT[b.state] ?? "outline"}>{b.state}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {backups.length === 0
                    ? "Nenhum backup encontrado nas regiões/compartments monitorados."
                    : "Nenhum backup corresponde aos filtros selecionados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
