"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, RotateCw, Square } from "lucide-react";
import type { AwsEc2Instance, Ec2InstanceAction } from "@/lib/aws/ec2";
import { setEc2InstanceStateAction } from "@/lib/actions/aws-ec2-actions";

const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  running: "secondary",
  stopped: "outline",
  terminated: "destructive",
};

function label(i: AwsEc2Instance) {
  return i.name || i.instanceId;
}

export function InstancesTable({
  instances,
  connectionId,
  canManage,
}: {
  instances: AwsEc2Instance[];
  connectionId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function run(instance: AwsEc2Instance, action: Ec2InstanceAction) {
    setPendingId(instance.instanceId);
    startTransition(async () => {
      const result = await setEc2InstanceStateAction({
        connectionId,
        region: instance.region,
        instanceId: instance.instanceId,
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
          <TableHead>ID</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Região / AZ</TableHead>
          <TableHead>IP público / privado</TableHead>
          <TableHead>Status</TableHead>
          {canManage && <TableHead className="text-right">Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {instances.map((i) => {
          const isPending = pendingId === i.instanceId;
          return (
            <TableRow key={i.instanceId}>
              <TableCell className="font-medium">{i.name || "—"}</TableCell>
              <TableCell className="text-muted-foreground">{i.instanceId}</TableCell>
              <TableCell className="text-muted-foreground">{i.instanceType}</TableCell>
              <TableCell className="text-muted-foreground">
                <div>{i.region}</div>
                <div className="text-xs text-muted-foreground">{i.availabilityZone || "—"}</div>
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
                    {i.state === "stopped" && (
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
                    {i.state === "running" && (
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
              Nenhuma instância encontrada nas regiões monitoradas.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
