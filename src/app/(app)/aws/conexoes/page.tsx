import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

const TEST_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  SUCCESS: "secondary",
  FAILURE: "destructive",
  NEVER_TESTED: "outline",
};
const TEST_LABEL: Record<string, string> = { SUCCESS: "conectado", FAILURE: "falhou", NEVER_TESTED: "não testado" };

export default async function AwsConnectionsPage() {
  await requireRole(["ADMIN"]);
  const connections = await db.awsConnection.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conexões AWS</h1>
          <p className="text-sm text-muted-foreground">Cadastre e teste conexões com contas da AWS.</p>
        </div>
        <Button render={<Link href="/aws/conexoes/novo" />}>
          <Plus className="size-4" />
          Nova conexão
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Access Key ID</TableHead>
                <TableHead>Regiões monitoradas</TableHead>
                <TableHead>Último teste</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/aws/conexoes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {!c.isActive && (
                      <Badge variant="outline" className="ml-2">
                        inativa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.accessKeyId}</TableCell>
                  <TableCell className="text-muted-foreground">{c.regions.join(", ") || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.lastTestAt ? c.lastTestAt.toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TEST_VARIANT[c.lastTestStatus]}>{TEST_LABEL[c.lastTestStatus]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {connections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma conexão cadastrada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
