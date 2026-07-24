import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loadAwsConnectionConfig } from "@/lib/aws/connection";
import { listVpcs, listVpnConnections, listVpcEndpoints } from "@/lib/aws/network";
import { AwsOperationError } from "@/lib/aws/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Cloud } from "lucide-react";
import { AwsConnectionPicker } from "../connection-picker";

type SearchParams = { conexao?: string };

export default async function AwsNetworkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(["ADMIN", "OPERATOR"]);
  const sp = await searchParams;

  const connections = await db.awsConnection.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Rede (VPC / VPN / Endpoints)</h1>
        <Alert>
          <Cloud className="size-4" />
          <AlertTitle>Nenhuma conexão AWS cadastrada</AlertTitle>
          <AlertDescription>
            Cadastre uma conexão com a AWS antes de consultar a rede.{" "}
            <Link href="/aws/conexoes/novo" className="font-medium underline">
              Cadastrar conexão
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const connectionId = sp.conexao || connections[0].id;
  const connection = connections.find((c) => c.id === connectionId) ?? connections[0];

  let vpcs: Awaited<ReturnType<typeof listVpcs>> = [];
  let vpnConnections: Awaited<ReturnType<typeof listVpnConnections>> = [];
  let endpoints: Awaited<ReturnType<typeof listVpcEndpoints>> = [];
  let loadError: string | null = null;
  try {
    const config = await loadAwsConnectionConfig(connection.id);
    [vpcs, vpnConnections, endpoints] = await Promise.all([
      listVpcs(config),
      listVpnConnections(config),
      listVpcEndpoints(config),
    ]);
  } catch (err) {
    loadError = err instanceof AwsOperationError ? err.message : "Falha ao consultar a AWS.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rede (VPC / VPN / Endpoints)</h1>
        <p className="text-sm text-muted-foreground">Status da rede nas regiões monitoradas.</p>
      </div>

      <AwsConnectionPicker connections={connections} selectedId={connection.id} basePath="/aws/rede" />

      {loadError ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erro ao consultar a AWS</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">VPCs ({vpcs.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>CIDR</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vpcs.map((v) => (
                    <TableRow key={v.vpcId}>
                      <TableCell className="font-medium">
                        {v.name || "—"} {v.isDefault && <Badge variant="outline">padrão</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{v.vpcId}</TableCell>
                      <TableCell className="text-muted-foreground">{v.cidrBlock || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{v.region}</TableCell>
                      <TableCell>
                        <Badge variant={v.state === "available" ? "secondary" : "outline"}>{v.state}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vpcs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nenhuma VPC encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">VPN Site-to-Site ({vpnConnections.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Túneis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vpnConnections.map((c) => (
                    <TableRow key={c.vpnConnectionId}>
                      <TableCell className="font-medium">{c.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.vpnConnectionId}</TableCell>
                      <TableCell className="text-muted-foreground">{c.region}</TableCell>
                      <TableCell>
                        <Badge variant={c.state === "available" ? "secondary" : "outline"}>{c.state}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.tunnels.map((t, idx) => (
                            <Badge key={idx} variant={t.status === "UP" ? "secondary" : "destructive"} title={t.outsideIp}>
                              {t.status}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vpnConnections.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Nenhuma conexão VPN encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">VPC Endpoints ({endpoints.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>VPC</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((e) => (
                    <TableRow key={e.vpcEndpointId}>
                      <TableCell className="font-medium">{e.name || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground" title={e.serviceName}>
                        {e.serviceName || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.type}</TableCell>
                      <TableCell className="text-muted-foreground">{e.vpcId || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.region}</TableCell>
                      <TableCell>
                        <Badge variant={e.state === "available" ? "secondary" : "outline"}>{e.state}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {endpoints.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Nenhum VPC endpoint encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
