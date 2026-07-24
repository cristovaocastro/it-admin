"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { revokeMySessionAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Session } from "@/generated/prisma/client";
import { Loader2, X } from "lucide-react";

export function MySessionsList({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleRevoke(sessionId: string) {
    setPendingId(sessionId);
    startTransition(async () => {
      const result = await revokeMySessionAction(sessionId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Sessão encerrada.");
        router.refresh();
      }
      setPendingId(null);
    });
  }

  if (sessions.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma sessão registrada.</p>;

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const active = !s.revokedAt && s.expiresAt > new Date();
        return (
          <div key={s.id} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.ip ?? "IP desconhecido"}</span>
                <Badge variant={active ? "secondary" : "outline"}>
                  {active ? "ativa" : s.revokedAt ? "revogada" : "expirada"}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{s.userAgent ?? "user-agent desconhecido"}</p>
              <p className="text-xs text-muted-foreground">Último uso {s.lastSeenAt.toLocaleString("pt-BR")}</p>
            </div>
            {active && (
              <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => handleRevoke(s.id)}>
                {pendingId === s.id ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
