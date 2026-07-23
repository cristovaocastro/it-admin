"use client";

import { useActionState } from "react";
import { updatePanelUserAction } from "@/lib/actions/panel-users-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/generated/prisma/client";
import { ROLE_OPTIONS, STATUS_OPTIONS } from "@/lib/panel-user-options";

export function EditUserForm({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [state, formAction] = useActionState(updatePanelUserAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={user.id} />
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert>
          <CheckCircle2 className="size-4" />
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" defaultValue={user.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={user.email} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Papel</Label>
          <Select name="role" items={ROLE_OPTIONS} defaultValue={user.role} disabled={isSelf}>
            <SelectTrigger id="role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" items={STATUS_OPTIONS} defaultValue={user.status} disabled={isSelf}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {isSelf && (
        <p className="text-xs text-muted-foreground">Você não pode alterar seu próprio papel ou status.</p>
      )}
      <SubmitButton pendingText="Salvando...">Salvar alterações</SubmitButton>
    </form>
  );
}
