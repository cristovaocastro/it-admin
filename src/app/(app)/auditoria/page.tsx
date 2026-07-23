import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AuditFilters } from "./audit-filters";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 25;

const ENTITY_LABEL: Record<string, string> = {
  AUTH: "Autenticação",
  PANEL_USER: "Usuário do painel",
  SESSION: "Sessão",
  AD_CONNECTION: "Conexão AD",
  AD_USER: "Usuário AD",
  AD_GROUP: "Grupo AD",
  AD_COMPUTER: "Computador AD",
  AD_OU: "OU do AD",
  SYSTEM: "Sistema",
};

type SearchParams = { q?: string; entityType?: string; status?: string; page?: string };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "AUDITOR"]);
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (sp.entityType) where.entityType = sp.entityType as Prisma.EnumAuditEntityTypeFilter["equals"];
  if (sp.status) where.status = sp.status as Prisma.EnumAuditStatusFilter["equals"];
  if (sp.q) {
    where.OR = [
      { actorName: { contains: sp.q, mode: "insensitive" } },
      { description: { contains: sp.q, mode: "insensitive" } },
      { action: { contains: sp.q, mode: "insensitive" } },
      { entityLabel: { contains: sp.q, mode: "insensitive" } },
    ];
  }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.entityType) params.set("entityType", sp.entityType);
    if (sp.status) params.set("status", sp.status);
    params.set("page", String(p));
    return `/auditoria?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trilha de auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todas as ações realizadas no sistema: quem, o quê, quando e o resultado.
        </p>
      </div>

      <AuditFilters />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {log.createdAt.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="font-medium">{log.actorName}</TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ENTITY_LABEL[log.entityType] ?? log.entityType}</Badge>
                    {log.entityLabel && <span className="ml-1 text-xs text-muted-foreground">{log.entityLabel}</span>}
                  </TableCell>
                  <TableCell className="max-w-md text-sm">{log.description}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.ip ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "SUCCESS" ? "secondary" : "destructive"}>
                      {log.status === "SUCCESS" ? "sucesso" : "falha"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum evento encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} evento{total === 1 ? "" : "s"} · página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={qs(page - 1)} />}>
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button variant="outline" size="sm" render={<Link href={qs(page + 1)} />}>
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
