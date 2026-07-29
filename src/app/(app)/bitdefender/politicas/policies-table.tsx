"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, UsersRound } from "lucide-react";
import type { BitdefenderPolicy } from "@/lib/bitdefender/types";
import { assignBitdefenderPolicyAction } from "@/lib/actions/bitdefender-policy-actions";
import Link from "next/link";

export function PoliciesTable({ policies, connectionId }: { policies: BitdefenderPolicy[]; connectionId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {policies.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell className="text-muted-foreground">{p.type ?? "—"}</TableCell>
            <TableCell className="text-right">
              <AssignPolicyDialog policy={p} connectionId={connectionId} />
            </TableCell>
          </TableRow>
        ))}
        {policies.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
              Nenhuma política encontrada.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function AssignPolicyDialog({ policy, connectionId }: { policy: BitdefenderPolicy; connectionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    const endpointIds = ids
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    if (endpointIds.length === 0) {
      setError("Informe ao menos um ID de endpoint.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await assignBitdefenderPolicyAction({
        connectionId,
        endpointIds,
        policyId: policy.id,
        policyLabel: policy.name,
      });
      if (result?.error) {
        toast.error(result.error);
        setError(result.error);
      } else {
        toast.success(result?.success ?? "Política atribuída.");
        setOpen(false);
        setIds("");
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UsersRound className="size-4" />
        Atribuir
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir política &quot;{policy.name}&quot;</DialogTitle>
          <DialogDescription>
            Cole os IDs dos endpoints (separados por vírgula ou espaço) — visíveis na tela de{" "}
            <Link href="/bitdefender/endpoints" className="underline">
              Endpoints
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="endpointIds">IDs de endpoint</Label>
            <textarea
              id="endpointIds"
              rows={4}
              value={ids}
              onChange={(e) => setIds(e.target.value)}
              spellCheck={false}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={handleAssign}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
