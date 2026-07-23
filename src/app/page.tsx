import { redirect } from "next/navigation";
import { getSession, getPendingSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(session.user.mustChangePassword ? "/conta/trocar-senha" : "/dashboard");
  }
  const pending = await getPendingSession();
  if (pending) {
    redirect(pending.user.mfaEnabled ? "/mfa/verificar" : "/mfa/configurar");
  }
  redirect("/login");
}
