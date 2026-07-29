"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, ScanLine, ShieldAlert, ShieldOff, Trash2 } from "lucide-react";
import type { BitdefenderEndpoint, BitdefenderEndpointAction } from "@/lib/bitdefender/types";
import { runBitdefenderEndpointAction } from "@/lib/actions/bitdefender-endpoint-actions";

const MALWARE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  clean: "secondary",
  infected: "destructive",
  unknown: "outline",
};
const MALWARE_LABEL: Record<string, string> = { clean: "protegido", infected: "infectado", unknown: "desconhecido" };

export function EndpointsTable({ endpoints, connectionId }: { endpoints: BitdefenderEndpoint[]; connectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function run(endpoint: BitdefenderEndpoint, action: BitdefenderEndpointAction) {
    setPendingId(endpoint.id);
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
      setPendingId(null);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>IP</TableHead>
          <TableHead>SO</TableHead>
          <TableHead>Grupo</TableHead>
          <TableHead>Política</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {endpoints.map((e) => {
          const isPending = pendingId === e.id;
          return (
            <TableRow key={e.id}>
              <TableCell className="font-medium" title={e.id}>
                <Link href={`/bitdefender/endpoints/${e.id}?conexao=${connectionId}`} className="hover:underline">
                  {e.name}
                </Link>
                {!e.isManaged && (
                  <Badge variant="outline" className="ml-2 text-muted-foreground">
                    sem agente
                  </Badge>
                )}
                {e.isolated && (
                  <Badge variant="destructive" className="ml-2">
                    isolado
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{e.ip ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{e.operatingSystem ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{e.groupName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{e.policyName ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={MALWARE_VARIANT[e.malwareStatus]}>{MALWARE_LABEL[e.malwareStatus]}</Badge>
              </TableCell>
              <TableCell>
                {!e.isManaged ? (
                  <p className="text-right text-xs text-muted-foreground">sem agente instalado</p>
                ) : (
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Scan rápido"
                    disabled={pending}
                    onClick={() => run(e, "scan_quick")}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
                  </Button>
                  {e.isolated ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Restaurar da isolação"
                      disabled={pending}
                      onClick={() => run(e, "restore")}
                    >
                      {isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Isolar da rede"
                      disabled={pending}
                      onClick={() => run(e, "isolate")}
                    >
                      {isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" title="Desinstalar proteção" />}>
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desinstalar proteção de &quot;{e.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O endpoint ficará sem o agente do GravityZone até uma nova instalação. Use apenas se tiver
                          certeza — não pode ser desfeito remotamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => run(e, "uninstall")}>Desinstalar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
        {endpoints.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              Nenhum endpoint encontrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
