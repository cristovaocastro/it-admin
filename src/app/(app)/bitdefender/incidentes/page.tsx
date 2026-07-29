import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { listBitdefenderIncidents } from "@/lib/bitdefender/incidents";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { BitdefenderConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

const SEVERITY_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
  critical: "destructive",
};

export default async function BitdefenderIncidentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.bitdefenderConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Incidentes (EDR)</h1>
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Nenhuma conexão Bitdefender cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o GravityZone antes de consultar incidentes.{" "}
            <Link href="/bitdefender/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let incidents: Awaited<ReturnType<typeof listBitdefenderIncidents>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadBitdefenderConnectionConfig(connection.id);
    incidents = await listBitdefenderIncidents(config);
  } catch (err) {
    loadError =
      err instanceof BitdefenderOperationError
        ? err.message
        : "Falha ao consultar o GravityZone (confira se a licença inclui o módulo EDR/XDR).";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incidentes (EDR)</h1>
        <p className="text-sm text-muted-foreground">Incidentes detectados pelo módulo de EDR/XDR do GravityZone.</p>
      </div>

      <BitdefenderConnectionPicker connections={connections} selectedId={connection.id} basePath="/bitdefender/incidentes" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar o GravityZone</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detectado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">
                      <Link href={`/bitdefender/incidentes/${i.id}?conexao=${connection.id}`} className="hover:underline">
                        {i.name ?? i.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.endpointName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[i.severity] ?? "outline"}>{i.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.status ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.detectedAt ? new Date(i.detectedAt).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {incidents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum incidente encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
