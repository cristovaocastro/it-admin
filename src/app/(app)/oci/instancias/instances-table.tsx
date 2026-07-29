"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCw, Square } from "lucide-react";
import type { OciInstance, OciInstanceAction } from "@/lib/oci/compute";
import { setOciInstanceStateAction } from "@/lib/actions/oci-instance-actions";

const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  RUNNING: "secondary",
  STOPPED: "outline",
  TERMINATED: "destructive",
};

function label(i: OciInstance) {
  return i.name || i.id;
}

export function InstancesTable({
  instances,
  connectionId,
  canManage,
}: {
  instances: OciInstance[];
  connectionId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function run(instance: OciInstance, action: OciInstanceAction) {
    setPendingId(instance.id);
    startTransition(async () => {
      const result = await setOciInstanceStateAction({
        connectionId,
        region: instance.region,
        instanceId: instance.id,
        label: label(instance),
        action,
      });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(result?.success ?? "Atualizado.");
        router.refresh();
      }
      setPendingId(null);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>OCID</TableHead>
          <TableHead>Shape</TableHead>
          <TableHead>Região / AD</TableHead>
          <TableHead>IP público / privado</TableHead>
          <TableHead>Status</TableHead>
          {canManage && <TableHead className="text-right">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((i) => {
          const isPending = pendingId === i.id;
          return (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name || "—"}</TableCell>
              <TableCell className="max-w-[220px] truncate text-muted-foreground" title={i.id}>
                {i.id}
              </TableCell>
              <TableCell className="text-muted-foreground">{i.shape}</TableCell>
              <TableCell className="text-muted-foreground">
                <div>{i.region}</div>
                <div className="text-xs text-muted-foreground">{i.availabilityDomain || "—"}</div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div>{i.publicIp || "—"}</div>
                <div className="text-xs text-muted-foreground">{i.privateIp || "—"}</div>
              </TableCell>
              <TableCell>
                <Badge variant={STATE_VARIANT[i.state] ?? "outline"}>{i.state}</Badge>
              </TableCell>
              {canManage && (
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    {i.state === "STOPPED" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Iniciar"
                        disabled={pending}
                        onClick={() => run(i, "start")}
                      >
                        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                      </Button>
                    )}
                    {i.state === "RUNNING" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Parar"
                          disabled={pending}
                          onClick={() => run(i, "stop")}
                        >
                          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Reiniciar"
                          disabled={pending}
                          onClick={() => run(i, "reboot")}
                        >
                          {isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
        {instances.length === 0 && (
          <TableRow>
            <TableCell colSpan={canManage ? 7 : 6} className="py-8 text-center text-muted-foreground">
              Nenhuma instância encontrada nas regiões/compartments monitorados.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
