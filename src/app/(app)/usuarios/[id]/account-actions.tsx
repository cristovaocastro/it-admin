"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetPanelUserPasswordAction, resetPanelUserMfaAction } from "@/lib/actions/panel-users-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, KeyRound, Loader2, ShieldOff } from "lucide-react";

export function AccountActions({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"password" | "mfa" | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleResetPassword() {
    setAction("password");
    startTransition(async () => {
      const result = await resetPanelUserPasswordAction(userId);
      if (result?.error) toast.error(result.error);
      else if (result?.tempPassword) setTempPassword(result.tempPassword);
      setAction(null);
    });
  }

  function handleResetMfa() {
    setAction("mfa");
    startTransition(async () => {
      const result = await resetPanelUserMfaAction(userId);
      if (result?.error) toast.error(result.error);
      else if (result?.success) toast.success(result.success);
      setAction(null);
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={handleResetPassword}>
          {action === "password" ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Redefinir senha
        </Button>
        <Button variant="outline" disabled={pending} onClick={handleResetMfa}>
          {action === "mfa" ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
          Resetar MFA
        </Button>
      </div>
      {isSelf && (
        <p className="mt-2 text-xs text-muted-foreground">
          Essas ações revogam todas as sessões ativas do usuário (inclusive a sua, se você mesmo executá-las).
        </p>
      )}

      <Dialog open={!!tempPassword} onOpenChange={(open) => !open && setTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova senha temporária</DialogTitle>
            <DialogDescription>
              Repasse ao usuário por um canal seguro. Ela não será exibida novamente e precisará ser trocada no
              próximo login.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
            <code className="flex-1 font-mono text-sm break-all">{tempPassword}</code>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => {
                if (!tempPassword) return;
                navigator.clipboard.writeText(tempPassword);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPassword(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
