"use client";

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

export function AuditLogRow({
  createdAt,
  actorName,
  action,
  entityTypeLabel,
  entityLabel,
  description,
  metadata,
  ip,
  status,
}: {
  createdAt: string;
  actorName: string;
  action: string;
  entityTypeLabel: string;
  entityLabel: string | null;
  description: string;
  metadata: unknown;
  ip: string | null;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const hasMetadata = !!metadata && typeof metadata === "object" && Object.keys(metadata as object).length > 0;
  const isLong = description.length > 100;
  const expandable = isLong || hasMetadata;

  return (
    <>
      <TableRow className={open ? "border-b-0" : undefined}>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{createdAt}</TableCell>
        <TableCell className="font-medium">{actorName}</TableCell>
        <TableCell className="font-mono text-xs">{action}</TableCell>
        <TableCell>
          <Badge variant="outline">{entityTypeLabel}</Badge>
          {entityLabel && <span className="ml-1 text-xs text-muted-foreground">{entityLabel}</span>}
        </TableCell>
        <TableCell className="max-w-md text-sm">
          <div className="flex items-start gap-1.5">
            {expandable ? (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                title={open ? "Recolher detalhes" : "Ver detalhes completos"}
              >
                {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
            ) : (
              <span className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span className={open ? "whitespace-normal" : "truncate"}>{description}</span>
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{ip ?? "—"}</TableCell>
        <TableCell>
          <Badge variant={status === "SUCCESS" ? "secondary" : "destructive"}>
            {status === "SUCCESS" ? "sucesso" : "falha"}
          </Badge>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/40 whitespace-normal">
            <div className="space-y-2 py-1">
              <p className="text-sm whitespace-pre-wrap">{description}</p>
              {hasMetadata && (
                <pre className="max-w-full overflow-x-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
