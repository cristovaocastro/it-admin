"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { testSavedOciConnectionAction, deleteOciConnectionAction } from "@/lib/actions/oci-connections-actions";
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
import { Loader2, PlugZap, Trash2 } from "lucide-react";

export function ConnectionActions({ connectionId, connectionName }: { connectionId: string; connectionName: string }) {
  const router = useRouter();
  const [testing, startTest] = useTransition();
  const [deleting, startDelete] = useTransition();

  function handleTest() {
    startTest(async () => {
      const result = await testSavedOciConnectionAction(connectionId);
      if (result?.error) toast.error(result.error);
      else if (result?.test?.success) toast.success(`Conectado com sucesso (${result.test.latencyMs}ms).`);
      else if (result?.test) toast.error(result.test.error ?? "Falha na conexão.");
      router.refresh();
    });
  }

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteOciConnectionAction(connectionId);
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Conexão removida.");
        router.push("/oci/conexoes");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={testing} onClick={handleTest}>
        {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
        Testar conexão
      </Button>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" />}>
          <Trash2 className="size-4" />
          Excluir
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conexão &quot;{connectionName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não afeta a tenancy OCI em si, apenas remove o cadastro da conexão neste painel. Não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
