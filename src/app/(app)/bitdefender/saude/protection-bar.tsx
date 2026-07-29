"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ProtectionSegment = {
  key: string;
  label: string;
  count: number;
  /** Cor validada (light+dark) contra o fundo do card — ver skill de dataviz. */
  colorClass: string;
};

/** Barra de proporção (protegidos / sem agente / em risco) — visão rápida de postura, no estilo do resumo do GravityZone. */
export function ProtectionBar({ segments, total }: { segments: ProtectionSegment[]; total: number }) {
  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-muted">
        {segments
          .filter((seg) => seg.count > 0)
          .map((seg) => (
            <Tooltip key={seg.key}>
              <TooltipTrigger
                render={
                  <div
                    className={seg.colorClass}
                    style={{ width: `${(seg.count / total) * 100}%` }}
                    aria-label={`${seg.label}: ${seg.count} de ${total}`}
                  />
                }
              />
              <TooltipContent>
                {seg.label}: {seg.count} ({Math.round((seg.count / total) * 100)}%)
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {segments.map((seg) => (
          <span key={seg.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={`size-2.5 rounded-full ${seg.colorClass}`} />
            {seg.label} <span className="font-medium text-foreground">{seg.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
