"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, ScanLine, ScanSearch, ShieldAlert, ShieldOff, Trash2 } from "lucide-react";
import type { BitdefenderEndpoint, BitdefenderEndpointAction } from "@/lib/bitdefender/types";
import { runBitdefenderEndpointAction } from "@/lib/actions/bitdefender-endpoint-actions";

export function EndpointDetailActions({
  endpoint,
  connectionId,
}: {
  endpoint: BitdefenderEndpoint;
  connectionId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<BitdefenderEndpointAction | null>(null);

  function run(action: BitdefenderEndpointAction) {
    setPendingAction(action);
    startTransition(async () => {
      const result = await runBitdefenderEndpointAction({
        connectionId,
        endpointId: endpoint.id,
        label: endpoint.name,
        action,
      });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Ação disparada.");
        router.refresh();
      }
      setPendingAction(null);
    });
  }

  function icon(action: BitdefenderEndpointAction, fallback: React.ReactNode) {
    return pending && pendingAction === action ? <Loader2 className="size-4 animate-spin" /> : fallback;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("scan_quick")}>
        {icon("scan_quick", <ScanLine className="size-4" />)}
        Scan rápido
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("scan_full")}>
        {icon("scan_full", <ScanSearch className="size-4" />)}
        Scan completo
      </Button>
      {endpoint.isolated ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("restore")}>
          {icon("restore", <ShieldOff className="size-4" />)}
          Restaurar da isolação
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run("isolate")}>
          {icon("isolate", <ShieldAlert className="size-4" />)}
          Isolar da rede
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>
          <Trash2 className="size-4" />
          Desinstalar proteção
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desinstalar proteção de &quot;{endpoint.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              O endpoint ficará sem o agente do GravityZone até uma nova instalação. Use apenas se tiver certeza —
              não pode ser desfeito remotamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run("uninstall")}>Desinstalar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
