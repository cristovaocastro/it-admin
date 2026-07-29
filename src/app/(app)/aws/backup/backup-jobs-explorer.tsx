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
import {
  resourceDisplayName,
  resourceTypeLabel,
  type AwsBackupJob,
  type AwsBackupPlan,
} from "@/lib/aws/backup-shared";

const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  COMPLETED: "secondary",
  RUNNING: "outline",
  PENDING: "outline",
  CREATED: "outline",
  FAILED: "destructive",
  ABORTED: "destructive",
  EXPIRED: "destructive",
  PARTIAL: "destructive",
};

const ALL = "__all__";

export function BackupJobsExplorer({ jobs, plans }: { jobs: AwsBackupJob[]; plans: AwsBackupPlan[] }) {
  const [query, setQuery] = useState("");
  const [resourceType, setResourceType] = useState(ALL);
  const [planId, setPlanId] = useState(ALL);
  const [state, setState] = useState(ALL);

  const planNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plans) map.set(p.id, p.name);
    return map;
  }, [plans]);

  const planName = (job: AwsBackupJob) =>
    job.backupPlanName ?? (job.backupPlanId ? (planNameById.get(job.backupPlanId) ?? job.backupPlanId) : undefined);

  const resourceTypeOptions = useMemo(() => {
    const set = new Set(jobs.map((j) => j.resourceType).filter((v): v is string => Boolean(v)));
    return Array.from(set).sort();
  }, [jobs]);

  const planOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const j of jobs) {
      if (j.backupPlanId) map.set(j.backupPlanId, j.backupPlanName ?? planNameById.get(j.backupPlanId) ?? j.backupPlanId);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [jobs, planNameById]);

  const stateOptions = useMemo(() => Array.from(new Set(jobs.map((j) => j.state))).sort(), [jobs]);

  const filtered = jobs.filter((j) => {
    if (resourceType !== ALL && j.resourceType !== resourceType) return false;
    if (planId !== ALL && j.backupPlanId !== planId) return false;
    if (state !== ALL && j.state !== state) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = `${resourceDisplayName(j)} ${j.resourceArn ?? ""} ${j.vaultName ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasFilters = query.trim() !== "" || resourceType !== ALL || planId !== ALL || state !== ALL;

  const resourceTypeItems: Record<string, string> = Object.fromEntries([
    [ALL, "Todos os tipos"],
    ...resourceTypeOptions.map((t) => [t, resourceTypeLabel(t)]),
  ]);
  const planItems: Record<string, string> = Object.fromEntries([[ALL, "Todos os planos"], ...planOptions]);
  const stateItems: Record<string, string> = Object.fromEntries([
    [ALL, "Todos os status"],
    ...stateOptions.map((s) => [s, s]),
  ]);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Jobs recentes{" "}
            <span className="font-normal text-muted-foreground">
              ({filtered.length}/{jobs.length})
            </span>
          </CardTitle>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setResourceType(ALL);
                setPlanId(ALL);
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
                placeholder="nome do recurso, ARN ou cofre..."
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de recurso</Label>
            <Select
              items={resourceTypeItems}
              value={resourceType}
              onValueChange={(value) => setResourceType(value ?? ALL)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(resourceTypeItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Plano</Label>
            <Select items={planItems} value={planId} onValueChange={(value) => setPlanId(value ?? ALL)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(planItems).map(([value, label]) => (
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
              <TableHead>Plano</TableHead>
              <TableHead>Cofre</TableHead>
              <TableHead>Região</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((j) => (
              <TableRow key={j.jobId}>
                <TableCell className="max-w-[320px]">
                  <div className="truncate font-medium" title={resourceDisplayName(j)}>
                    {resourceDisplayName(j)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      {resourceTypeLabel(j.resourceType)}
                    </Badge>
                  </div>
                  {j.resourceArn && (
                    <div
                      className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70"
                      title={j.resourceArn}
                    >
                      {j.resourceArn}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{planName(j) ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{j.vaultName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{j.region}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {j.creationDate ? new Date(j.creationDate).toLocaleString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATE_VARIANT[j.state] ?? "outline"} title={j.statusMessage}>
                    {j.state}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  {jobs.length === 0
                    ? "Nenhum job de backup nos últimos 7 dias."
                    : "Nenhum job corresponde aos filtros selecionados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
