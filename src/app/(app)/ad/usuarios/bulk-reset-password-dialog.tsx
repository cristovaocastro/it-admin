"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { resetAdUserPasswordBulkAction } from "@/lib/actions/ad-users-actions";

type Result = { label: string; password?: string; error?: string };

export function BulkResetPasswordDialog({
  connectionId,
  items,
  onDone,
}: {
  connectionId: string;
  items: { dn: string; label: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [samePassword, setSamePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [unlock, setUnlock] = useState(true);
  const [applying, startApply] = useTransition();
  const [results, setResults] = useState<Result[]>([]);
  const [copied, setCopied] = useState(false);

  function reset() {
    setSamePassword(false);
    setPassword("");
    setResults([]);
    setCopied(false);
  }

  function run() {
    if (samePassword && password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    startApply(async () => {
      const out: Result[] = [];
      for (const item of items) {
        const result = await resetAdUserPasswordBulkAction({
          connectionId,
          dn: item.dn,
          label: item.label,
          password: samePassword ? password : undefined,
          forceChangeAtNextLogon: forceChange,
          unlockAccount: unlock,
        });
        out.push({ label: item.label, password: result?.password, error: result?.error });
      }
      setResults(out);
      const fail = out.filter((r) => r.error).length;
      if (fail === 0) toast.success(`${out.length} senha(s) redefinida(s).`);
      else toast.warning(`${out.length - fail} ok, ${fail} falharam.`);
      onDone();
    });
  }

  function copyAll() {
    const text = results
      .filter((r) => r.password)
      .map((r) => `${r.label}\t${r.password}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Senhas copiadas para a área de transferência.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <KeyRound className="size-4" />
        Redefinir senha
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha de {items.length} usuário(s)</DialogTitle>
          <DialogDescription>
            {results.length === 0
              ? "Por padrão, é gerada uma senha aleatória diferente para cada usuário."
              : "Copie as senhas agora — elas não ficam salvas em nenhum lugar após fechar este diálogo."}
          </DialogDescription>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="bulk-same-password" className="text-sm">
                Usar a mesma senha para todos
              </Label>
              <Switch id="bulk-same-password" checked={samePassword} onCheckedChange={setSamePassword} />
            </div>
            {samePassword && (
              <div className="space-y-2">
                <Label htmlFor="bulk-password">Nova senha</Label>
                <Input
                  id="bulk-password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="bulk-force-change" className="text-sm">
                Exigir troca no próximo login
              </Label>
              <Switch id="bulk-force-change" checked={forceChange} onCheckedChange={setForceChange} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="bulk-unlock" className="text-sm">
                Desbloquear conta
              </Label>
              <Switch id="bulk-unlock" checked={unlock} onCheckedChange={setUnlock} />
            </div>
          </div>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {results.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2 font-mono text-xs">
                <span className="truncate font-sans text-muted-foreground">{r.label}</span>
                {r.password ? <span>{r.password}</span> : <span className="text-destructive">{r.error}</span>}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {applying && <Loader2 className="size-4 animate-spin" />}
          {results.length === 0 ? (
            <Button type="button" disabled={applying} onClick={run}>
              Redefinir senha
            </Button>
          ) : (
            <>
              {results.some((r) => r.password) && (
                <Button type="button" variant="outline" onClick={copyAll}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  Copiar todas
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
