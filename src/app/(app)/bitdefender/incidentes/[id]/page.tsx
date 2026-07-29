import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { getBitdefenderIncidentDetails } from "@/lib/bitdefender/incidents";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft } from "lucide-react";

type SearchParams = { conexao?: string };

const SEVERITY_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
};

export default async function BitdefenderIncidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const { id } = await params;
  const sp = await searchParams;
  if (!sp.conexao) notFound();

  const connection = await db.bitdefenderConnection.findUnique({ where: { id: sp.conexao } });
  if (!connection) notFound();

  let incident: Awaited<ReturnType<typeof getBitdefenderIncidentDetails>> | null = null;
  let loadError: string | null = null;
  try {
    const config = await loadBitdefenderConnectionConfig(connection.id);
    incident = await getBitdefenderIncidentDetails(config, id);
  } catch (err) {
    loadError = err instanceof BitdefenderOperationError ? err.message : "Falha ao consultar o GravityZone.";
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/bitdefender/incidentes?conexao=${connection.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para incidentes
      </Link>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o GravityZone</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        incident && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{incident.name ?? incident.id}</CardTitle>
                <Badge variant={SEVERITY_VARIANT[incident.severity] ?? "outline"}>{incident.severity}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Endpoint: </span>
                {incident.endpointName ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Status: </span>
                {incident.status ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Detectado em: </span>
                {incident.detectedAt ? new Date(incident.detectedAt).toLocaleString("pt-BR") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">ID: </span>
                {incident.id}
              </p>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
