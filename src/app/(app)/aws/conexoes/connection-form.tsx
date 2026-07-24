"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAwsConnectionAction,
  updateAwsConnectionAction,
  testAwsConnectionDraftAction,
} from "@/lib/actions/aws-connections-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import type { AwsConnection } from "@/generated/prisma/client";

export function ConnectionForm({ connection }: { connection?: AwsConnection }) {
  const isEdit = !!connection;
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const action = isEdit ? updateAwsConnectionAction : createAwsConnectionAction;
  const [state, formAction] = useActionState(action, undefined);

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<
    { success: boolean; latencyMs: number; error?: string; accountId?: string } | null
  >(null);

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      const result = await testAwsConnectionDraftAction(undefined, fd);
      if (result?.error) setTestResult({ success: false, latencyMs: 0, error: result.error });
      else if (result?.test) setTestResult(result.test);
    });
  }

  useEffect(() => {
    if (state?.success) router.push("/aws/conexoes");
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
        <Input id="name" name="name" defaultValue={connection?.name} required placeholder="AWS Produção" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accessKeyId">Access Key ID</Label>
          <Input
            id="accessKeyId"
            name="accessKeyId"
            defaultValue={connection?.accessKeyId}
            required
            placeholder="AKIAIOSFODNN7EXAMPLE"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="secretAccessKey">
            Secret Access Key {isEdit && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
          </Label>
          <Input id="secretAccessKey" name="secretAccessKey" type="password" autoComplete="new-password" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="defaultRegion">Região padrão</Label>
          <Input
            id="defaultRegion"
            name="defaultRegion"
            defaultValue={connection?.defaultRegion ?? "us-east-1"}
            required
            placeholder="us-east-1"
          />
          <p className="text-xs text-muted-foreground">Usada por serviços globais (teste de conexão, custos).</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="regions">Regiões monitoradas</Label>
          <Input
            id="regions"
            name="regions"
            defaultValue={connection?.regions?.join(", ")}
            required
            placeholder="us-east-1, sa-east-1"
          />
          <p className="text-xs text-muted-foreground">Separadas por vírgula. Usadas para EC2, Backup, VPC/VPN/Endpoints.</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription>
          A credencial precisa de uma policy IAM com permissão de leitura em EC2/Backup/Cost Explorer, além de
          <code className="mx-1 rounded bg-muted px-1">ec2:StartInstances</code>,
          <code className="mx-1 rounded bg-muted px-1">ec2:StopInstances</code> e
          <code className="mx-1 rounded bg-muted px-1">ec2:RebootInstances</code>
          para as ações de instância (restritas a ADMIN neste painel).
        </AlertDescription>
      </Alert>

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle>{testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}</AlertTitle>
          <AlertDescription>
            {testResult.success
              ? `Autenticado em ${testResult.latencyMs}ms (conta ${testResult.accountId}).`
              : testResult.error}
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
