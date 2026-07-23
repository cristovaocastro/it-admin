"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createAdConnectionAction,
  updateAdConnectionAction,
  testAdConnectionDraftAction,
  listAdConnectionOusDraftAction,
} from "@/lib/actions/ad-connections-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, FolderSearch, Loader2, PlugZap } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdConnection } from "@/generated/prisma/client";
import type { AdOrganizationalUnit } from "@/lib/ad/ou";

const ENCRYPTION_OPTIONS = [
  { value: "LDAPS", label: "LDAPS (porta 636)" },
  { value: "STARTTLS", label: "StartTLS (porta 389)" },
  { value: "NONE", label: "Nenhuma (não recomendado)" },
];

function OuPickerField({
  fieldName,
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  fieldName: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: AdOrganizationalUnit[] | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldName} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {options && options.length > 0 ? (
        <Select
          items={Object.fromEntries(options.map((o) => [o.dn, o.name]))}
          value={value || undefined}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger id={fieldName} className="w-full">
            <SelectValue placeholder="Usar a Base DN" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.dn} value={o.dn}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input id={fieldName} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      <input type="hidden" name={fieldName} value={value} />
    </div>
  );
}

export function ConnectionForm({ connection }: { connection?: AdConnection }) {
  const isEdit = !!connection;
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const action = isEdit ? updateAdConnectionAction : createAdConnectionAction;
  const [state, formAction] = useActionState(action, undefined);

  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ success: boolean; latencyMs: number; error?: string } | null>(null);

  const [usersOuValue, setUsersOuValue] = useState(connection?.usersOU ?? "");
  const [groupsOuValue, setGroupsOuValue] = useState(connection?.groupsOU ?? "");
  const [computersOuValue, setComputersOuValue] = useState(connection?.computersOU ?? "");
  const [ouOptions, setOuOptions] = useState<AdOrganizationalUnit[] | null>(null);
  const [loadingOus, startLoadOus] = useTransition();

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      if (!formRef.current) return;
      const fd = new FormData(formRef.current);
      const result = await testAdConnectionDraftAction(undefined, fd);
      if (result?.error) setTestResult({ success: false, latencyMs: 0, error: result.error });
      else if (result?.test) setTestResult(result.test);
    });
  }

  function handleLoadOus() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startLoadOus(async () => {
      const result = await listAdConnectionOusDraftAction(undefined, fd);
      if (result?.error) {
        toast.error(result.error);
      } else if (result?.ous) {
        setOuOptions(result.ous);
        if (result.ous.length === 0) toast.info("Nenhuma OU encontrada abaixo da Base DN.");
      }
    });
  }

  useEffect(() => {
    if (state?.success) router.push("/ad/conexoes");
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
        <Input id="name" name="name" defaultValue={connection?.name} required placeholder="AD Matriz" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="host">Host</Label>
          <Input id="host" name="host" defaultValue={connection?.host} required placeholder="dc01.empresa.local" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="port">Porta</Label>
          <Input id="port" name="port" type="number" defaultValue={connection?.port ?? 636} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="baseDN">Base DN</Label>
        <Input id="baseDN" name="baseDN" defaultValue={connection?.baseDN} required placeholder="DC=empresa,DC=local" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bindDN">Conta de serviço (bind DN)</Label>
          <Input
            id="bindDN"
            name="bindDN"
            defaultValue={connection?.bindDN}
            required
            placeholder="svc-itadmin@empresa.local"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bindPassword">
            Senha do bind {isEdit && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
          </Label>
          <Input id="bindPassword" name="bindPassword" type="password" autoComplete="new-password" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="encryption">Criptografia</Label>
          <Select
            name="encryption"
            items={ENCRYPTION_OPTIONS}
            defaultValue={connection?.encryption ?? "STARTTLS"}
          >
            <SelectTrigger id="encryption" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENCRYPTION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">OUs padrão para usuários, grupos e computadores (opcional)</Label>
          <Button type="button" variant="outline" size="sm" disabled={loadingOus} onClick={handleLoadOus}>
            {loadingOus ? <Loader2 className="size-4 animate-spin" /> : <FolderSearch className="size-4" />}
            Descobrir OUs no AD
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <OuPickerField
            fieldName="usersOU"
            label="Usuários"
            placeholder="OU=Usuarios,DC=empresa,DC=local"
            value={usersOuValue}
            onChange={setUsersOuValue}
            options={ouOptions}
          />
          <OuPickerField
            fieldName="groupsOU"
            label="Grupos"
            placeholder="OU=Grupos,DC=empresa,DC=local"
            value={groupsOuValue}
            onChange={setGroupsOuValue}
            options={ouOptions}
          />
          <OuPickerField
            fieldName="computersOU"
            label="Computadores"
            placeholder="CN=Computers,DC=empresa,DC=local"
            value={computersOuValue}
            onChange={setComputersOuValue}
            options={ouOptions}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Clique em &quot;Descobrir OUs no AD&quot; para escolher em uma lista (usa host/porta/bind já preenchidos
          acima); ou digite o DN manualmente.
        </p>
      </div>

      {testResult && (
        <Alert variant={testResult.success ? "default" : "destructive"}>
          {testResult.success ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <AlertTitle>{testResult.success ? "Conexão bem-sucedida" : "Falha na conexão"}</AlertTitle>
          <AlertDescription>
            {testResult.success ? `Bind realizado em ${testResult.latencyMs}ms.` : testResult.error}
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
