import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadOciConnectionConfig } from "@/lib/oci/connection";
import { listOciVolumes } from "@/lib/oci/storage";
import { OciOperationError } from "@/lib/oci/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Cloud } from "lucide-react";
import { OciConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

const KIND_LABEL: Record<string, string> = { block: "Volume de bloco", boot: "Volume de boot" };
const STATE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  AVAILABLE: "secondary",
  PROVISIONING: "outline",
  RESTORING: "outline",
  TERMINATING: "destructive",
  TERMINATED: "destructive",
  FAULTY: "destructive",
};

export default async function OciBlockStoragePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.ociConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Block Storage OCI</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão OCI cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a OCI antes de consultar block storage.{" "}
            <Link href="/oci/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let volumes: Awaited<ReturnType<typeof listOciVolumes>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadOciConnectionConfig(connection.id);
    volumes = await listOciVolumes(config);
  } catch (err) {
    loadError = err instanceof OciOperationError ? err.message : "Falha ao consultar a OCI.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Block Storage OCI</h1>
        <p className="text-sm text-muted-foreground">Volumes de bloco e de boot nas regiões/compartments monitorados.</p>
      </div>

      <OciConnectionPicker connections={connections} selectedId={connection.id} basePath="/oci/block-storage" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a OCI</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Desempenho (VPUs/GB)</TableHead>
                  <TableHead>Região / AD</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{KIND_LABEL[v.kind]}</TableCell>
                    <TableCell className="text-muted-foreground">{v.sizeInGBs ? `${v.sizeInGBs} GB` : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{v.vpusPerGB ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{v.region}</div>
                      <div className="text-xs text-muted-foreground">{v.availabilityDomain || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[v.state] ?? "outline"}>{v.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {volumes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum volume encontrado nas regiões/compartments monitorados.
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
