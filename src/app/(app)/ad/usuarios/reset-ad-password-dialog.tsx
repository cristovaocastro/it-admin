"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resetAdUserPasswordAction } from "@/lib/actions/ad-users-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, KeyRound } from "lucide-react";
import type { AdUserSummary } from "@/lib/ad/types";

export function ResetAdPasswordDialog({
  connectionId,
  user,
  onSuccess,
}: {
  connectionId: string;
  user: AdUserSummary;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(resetAdUserPasswordAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.refresh();
      onSuccess?.();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o dialog após a Server Action confirmar sucesso
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Redefinir senha" />}>
        <KeyRound className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Definir uma nova senha para <strong>{user.displayName || user.sAMAccountName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="dn" value={user.dn} />
          <input type="hidden" name="label" value={user.displayName || user.sAMAccountName} />
          {state?.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="forceChangeAtNextLogon" className="text-sm">
              Exigir troca no próximo login
            </Label>
            <Switch id="forceChangeAtNextLogon" name="forceChangeAtNextLogon" defaultChecked />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="unlockAccount" className="text-sm">
              Desbloquear conta
            </Label>
            <Switch id="unlockAccount" name="unlockAccount" defaultChecked={user.locked} />
          </div>
          <DialogFooter>
            <SubmitButton pendingText="Salvando...">Redefinir senha</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
