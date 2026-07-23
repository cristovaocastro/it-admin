import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

const ENCRYPTION_LABEL: Record<string, string> = { NONE: "Nenhuma", STARTTLS: "StartTLS", LDAPS: "LDAPS" };
const TEST_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  SUCCESS: "secondary",
  FAILURE: "destructive",
  NEVER_TESTED: "outline",
};
const TEST_LABEL: Record<string, string> = { SUCCESS: "conectado", FAILURE: "falhou", NEVER_TESTED: "não testado" };

export default async function AdConnectionsPage() {
  await requireRole(["ADMIN"]);
  const connections = await db.adConnection.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conexões Active Directory</h1>
          <p className="text-sm text-muted-foreground">Cadastre e teste conexões com domínios AD externos.</p>
        </div>
        <Button render={<Link href="/ad/conexoes/novo" />}>
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
                <TableHead>Host</TableHead>
                <TableHead>Base DN</TableHead>
                <TableHead>Criptografia</TableHead>
                <TableHead>Último teste</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connections.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/ad/conexoes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {!c.isActive && (
                      <Badge variant="outline" className="ml-2">
                        inativa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.host}:{c.port}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.baseDN}</TableCell>
                  <TableCell>{ENCRYPTION_LABEL[c.encryption]}</TableCell>
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
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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
