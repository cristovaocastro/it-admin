import { getOrCreateEnrollmentSecret } from "@/lib/auth/mfa-enrollment";
import { EnrollForm } from "./enroll-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound } from "lucide-react";
import Image from "next/image";

export default async function MfaEnrollPage() {
  const { qrCodeDataUrl, secret, username } = await getOrCreateEnrollmentSecret();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Configure a verificação em duas etapas</h1>
          <p className="text-sm text-muted-foreground">
            Obrigatória para todas as contas de <strong>{username}</strong>. Use um app autenticador como Google
            Authenticator, Microsoft Authenticator ou Authy.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Escaneie o QR code</CardTitle>
            <CardDescription>Ou digite manualmente a chave abaixo no seu app autenticador.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Image
              src={qrCodeDataUrl}
              alt="QR code para configuração de MFA"
              width={200}
              height={200}
              unoptimized
              className="rounded-md border"
            />
            <code className="rounded bg-muted px-3 py-1.5 text-sm tracking-wider">{secret}</code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Confirme o código</CardTitle>
            <CardDescription>Digite o código de 6 dígitos gerado pelo app.</CardDescription>
          </CardHeader>
          <CardContent>
            <EnrollForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
