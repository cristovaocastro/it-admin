import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadBitdefenderConnectionConfig } from "@/lib/bitdefender/connection";
import { listBitdefenderInstallationLinks } from "@/lib/bitdefender/install";
import { BitdefenderOperationError } from "@/lib/bitdefender/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { BitdefenderConnectionPicker } from "../connection-picker";
import { InstallPackageForm } from "./install-package-form";

type SearchParams = { conexao?: string };

export default async function BitdefenderInstallPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.bitdefenderConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Instalação</h1>
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>Nenhuma conexão Bitdefender cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com o GravityZone antes de gerenciar instalação remota.{" "}
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

  let links: Awaited<ReturnType<typeof listBitdefenderInstallationLinks>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadBitdefenderConnectionConfig(connection.id);
    links = await listBitdefenderInstallationLinks(config);
  } catch (err) {
    loadError = err instanceof BitdefenderOperationError ? err.message : "Falha ao consultar o GravityZone.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Instalação</h1>
        <p className="text-sm text-muted-foreground">Links e pacotes de instalação remota do agente GravityZone.</p>
      </div>

      <BitdefenderConnectionPicker connections={connections} selectedId={connection.id} basePath="/bitdefender/instalacao" />

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
                  <TableHead>Sistema</TableHead>
                  <TableHead>Tipo de kit</TableHead>
                  <TableHead>Link de download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.osType}</TableCell>
                    <TableCell className="text-muted-foreground">{l.kitType ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      <a href={l.downloadUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {l.downloadUrl}
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
                {links.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nenhum link de instalação encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Gerar novo pacote de instalação</CardTitle>
          <CardDescription>Cria um pacote customizado de instalação para essa conta GravityZone.</CardDescription>
        </CardHeader>
        <CardContent>
          <InstallPackageForm connectionId={connection.id} />
        </CardContent>
      </Card>
    </div>
  );
}
