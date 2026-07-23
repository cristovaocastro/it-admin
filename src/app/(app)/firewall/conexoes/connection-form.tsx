"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createFirewallConnectionAction,
  updateFirewallConnectionAction,
  testFirewallConnectionDraftAction,
} from "@/lib/actions/firewall-connections-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import type { FirewallConnection } from "@/generated/prisma/client";

export function ConnectionForm({ connection }: { connection?: FirewallConnection }) {
  const isEdit = !!connection;
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const action = isEdit ? updateFirewallConnectionAction : createFirewallConnectionAction;
  const [state, formAction] = useActionState(action, undefined);

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      const result = await testFirewallConnectionDraftAction(undefined, fd);
      if (result?.error) setTestResult({ success: false, latencyMs: 0, error: result.error });
      else if (result?.test) setTestResult(result.test);
    });
  }

  useEffect(() => {
    if (state?.success) router.push("/firewall/conexoes");
  }, [state?.success, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={connection.id} />}

      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome da conexão</Label>
        <Input id="name" name="name" defaultValue={connection?.name} required placeholder="Firewall Matriz" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="host">Host</Label>
          <Input id="host" name="host" defaultValue={connection?.host} required placeholder="192.168.1.1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Porta</Label>
          <Input id="port" name="port" type="number" defaultValue={connection?.port ?? 443} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="adminUsername">Usuário admin</Label>
          <Input id="adminUsername" name="adminUsername" defaultValue={connection?.adminUsername} required placeholder="admin" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adminPassword">
            Senha {isEdit && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
          </Label>
          <Input id="adminPassword" name="adminPassword" type="password" autoComplete="new-password" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <div>
          <Label htmlFor="rejectUnauthorized" className="text-sm">
            Validar certificado TLS
          </Label>
          <p className="text-xs text-muted-foreground">Desative apenas para certificados self-signed conhecidos.</p>
        </div>
        <Switch id="rejectUnauthorized" name="rejectUnauthorized" defaultChecked={connection?.rejectUnauthorized ?? true} />
      </div>

      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription>
          A API do SonicOS permite apenas uma sessão de administrador por vez. Este painel sempre encerra a sessão
          após cada operação, mas é preciso que a API esteja habilitada no aparelho (Manage &gt; System Setup &gt;
          Appliance &gt; Base Settings &gt; Enable SonicOS API).
        </AlertDescription>
      </Alert>

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle>{testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}</AlertTitle>
          <AlertDescription>
            {testResult.success ? `Login realizado em ${testResult.latencyMs}ms.` : testResult.error}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button type="button" variant="outline" disabled={testing} onClick={handleTest}>
          {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}
          Testar conexão
        </Button>
        <SubmitButton pendingText="Salvando...">{isEdit ? "Salvar alterações" : "Criar conexão"}</SubmitButton>
      </div>
    </form>
  );
}
