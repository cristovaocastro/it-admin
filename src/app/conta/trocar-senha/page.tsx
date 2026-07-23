import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Defina uma nova senha</h1>
          <p className="text-sm text-muted-foreground">
            Por segurança, você precisa trocar a senha temporária antes de continuar.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova senha</CardTitle>
            <CardDescription>Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
