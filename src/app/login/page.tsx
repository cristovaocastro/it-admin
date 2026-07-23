import { redirect } from "next/navigation";
import { getSession, getPendingSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";
import { ShieldCheck } from "lucide-react";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.user.mustChangePassword ? "/conta/trocar-senha" : "/dashboard");
  const pending = await getPendingSession();
  if (pending) redirect(pending.user.mfaEnabled ? "/mfa/verificar" : "/mfa/configurar");

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">IT Admin</h1>
          <p className="text-sm text-muted-foreground">Entre com suas credenciais para continuar</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
