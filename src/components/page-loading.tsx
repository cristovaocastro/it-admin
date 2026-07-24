import { Loader2 } from "lucide-react";

export function PageLoading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <p>{label}</p>
    </div>
  );
}
