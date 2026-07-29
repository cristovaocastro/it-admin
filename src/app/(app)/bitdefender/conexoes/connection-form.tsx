"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createBitdefenderConnectionAction,
  updateBitdefenderConnectionAction,
  testBitdefenderConnectionDraftAction,
} from "@/lib/actions/bitdefender-connections-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import type { BitdefenderConnection } from "@/generated/prisma/client";

export function ConnectionForm({ connection }: { connection?: BitdefenderConnection }) {
  const isEdit = !!connection;
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const action = isEdit ? updateBitdefenderConnectionAction : createBitdefenderConnectionAction;
  const [state, formAction] = useActionState(action, undefined);

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      const result = await testBitdefenderConnectionDraftAction(undefined, fd);
      if (result?.error) setTestResult({ success: false, latencyMs: 0, error: result.error });
      else if (result?.test) setTestResult(result.test);
    });
  }

  useEffect(() => {
    if (state?.success) router.push("/bitdefender/conexoes");
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
        <Input id="name" name="name" defaultValue={connection?.name} required placeholder="GravityZone Matriz" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiUrl">API Base URL</Label>
        <Input
          id="apiUrl"
          name="apiUrl"
          defaultValue={connection?.apiUrl}
          required
          placeholder="https://cloud.gravityzone.bitdefender.com"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Mostrada no Control Center na mesma tela onde a API Key é gerada (My Account → API keys).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="apiKey">
            API Key {isEdit && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
          </Label>
          <Input id="apiKey" name="apiKey" type="password" autoComplete="new-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyId">
            Company ID <span className="text-muted-foreground">(opcional, só para setups MSP/multi-empresa)</span>
          </Label>
          <Input id="companyId" name="companyId" defaultValue={connection?.companyId ?? ""} autoComplete="off" />
        </div>
      </div>

      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription>
          A API Key precisa ter os escopos <strong>Network</strong>, <strong>Policies</strong>,{" "}
          <strong>Quarantine</strong>, <strong>Push Installation</strong> e <strong>Incidents</strong> (EDR) marcados
          no Control Center (ícone da conta → API keys → Add).
        </AlertDescription>
      </Alert>

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle>{testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}</AlertTitle>
          <AlertDescription>
            {testResult.success ? `Autenticado em ${testResult.latencyMs}ms.` : testResult.error}
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
