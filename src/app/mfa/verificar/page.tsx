import { getPendingChallengeUser } from "@/lib/auth/mfa-enrollment";
import { ChallengeForm } from "./challenge-form";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound } from "lucide-react";

export default async function MfaChallengePage() {
  const user = await getPendingChallengeUser();

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Verificação em duas etapas</h1>
          <p className="text-sm text-muted-foreground">
            Olá, <strong>{user.name}</strong>. Digite o código do seu app autenticador.
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <ChallengeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
