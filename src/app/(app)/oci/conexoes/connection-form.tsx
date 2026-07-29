"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createOciConnectionAction,
  updateOciConnectionAction,
  testOciConnectionDraftAction,
} from "@/lib/actions/oci-connections-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, PlugZap } from "lucide-react";
import type { OciConnection } from "@/generated/prisma/client";

export function ConnectionForm({ connection }: { connection?: OciConnection }) {
  const isEdit = !!connection;
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const action = isEdit ? updateOciConnectionAction : createOciConnectionAction;
  const [state, formAction] = useActionState(action, undefined);

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      const result = await testOciConnectionDraftAction(undefined, fd);
      if (result?.error) setTestResult({ success: false, latencyMs: 0, error: result.error });
      else if (result?.test) setTestResult(result.test);
    });
  }

  useEffect(() => {
    if (state?.success) router.push("/oci/conexoes");
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
        <Input id="name" name="name" defaultValue={connection?.name} required placeholder="OCI Produção" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tenancyId">Tenancy OCID</Label>
          <Input
            id="tenancyId"
            name="tenancyId"
            defaultValue={connection?.tenancyId}
            required
            placeholder="ocid1.tenancy.oc1..aaaa..."
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userId">User OCID</Label>
          <Input
            id="userId"
            name="userId"
            defaultValue={connection?.userId}
            required
            placeholder="ocid1.user.oc1..aaaa..."
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fingerprint">Fingerprint da chave</Label>
          <Input
            id="fingerprint"
            name="fingerprint"
            defaultValue={connection?.fingerprint}
            required
            placeholder="aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passphrase">
            Senha da chave privada{" "}
            <span className="text-muted-foreground">(opcional{isEdit && ", deixe em branco para manter"})</span>
          </Label>
          <Input id="passphrase" name="passphrase" type="password" autoComplete="new-password" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="privateKey">
          Chave privada (PEM) {isEdit && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
        </Label>
        <textarea
          id="privateKey"
          name="privateKey"
          rows={6}
          autoComplete="off"
          spellCheck={false}
          placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <p className="text-xs text-muted-foreground">
          Chave privada da API Signing Key cadastrada no usuário OCI (a pública correspondente ao fingerprint acima).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="defaultRegion">Região padrão</Label>
          <Input
            id="defaultRegion"
            name="defaultRegion"
            defaultValue={connection?.defaultRegion ?? "sa-saopaulo-1"}
            required
            placeholder="sa-saopaulo-1"
          />
          <p className="text-xs text-muted-foreground">Usada para autenticação e teste de conexão.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="regions">Regiões monitoradas</Label>
          <Input
            id="regions"
            name="regions"
            defaultValue={connection?.regions?.join(", ")}
            required
            placeholder="sa-saopaulo-1, us-ashburn-1"
          />
          <p className="text-xs text-muted-foreground">Separadas por vírgula.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="compartments">Compartments monitorados</Label>
        <Input
          id="compartments"
          name="compartments"
          defaultValue={connection?.compartments?.join(", ")}
          required
          placeholder="ocid1.compartment.oc1..aaaa..., ocid1.tenancy.oc1..aaaa..."
        />
        <p className="text-xs text-muted-foreground">
          OCIDs separados por vírgula. Recursos na OCI são organizados por compartment, não só por região — informe o
          compartment raiz da tenancy e/ou compartments específicos que devem ser escaneados.
        </p>
      </div>

      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription>
          O usuário precisa de uma política IAM com permissão de leitura em instance-family, volume-family,
          database-family, autonomous-database-family e virtual-network-family, além de
          <code className="mx-1 rounded bg-muted px-1">use instance-family</code>
          para as ações de instância (restritas a ADMIN neste painel). Exemplo:
          <code className="mt-1 block rounded bg-muted px-1 py-0.5">
            Allow group &lt;grupo&gt; to read all-resources in compartment &lt;compartment&gt;
          </code>
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
