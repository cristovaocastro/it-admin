import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, ShieldCheck, ShieldOff } from "lucide-react";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", OPERATOR: "Operador", AUDITOR: "Auditor" };
const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  ACTIVE: "secondary",
  INACTIVE: "outline",
  LOCKED: "destructive",
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo", LOCKED: "Bloqueado" };

export default async function PanelUsersPage() {
  await requireRole(["ADMIN"]);
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usuários do painel</h1>
          <p className="text-sm text-muted-foreground">Contas com acesso ao IT Admin, MFA e permissões.</p>
        </div>
        <Button render={<Link href="/usuarios/novo" />}>
          <Plus className="size-4" />
          Novo usuário
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead>Último login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/usuarios/${u.id}`} className="font-medium hover:underline">
                      {u.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">@{u.username}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[u.status]}>{STATUS_LABEL[u.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {u.mfaEnabled ? (
                      <ShieldCheck className="size-4 text-emerald-600" />
                    ) : (
                      <ShieldOff className="size-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.lastLoginAt ? u.lastLoginAt.toLocaleString("pt-BR") : "Nunca"}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum usuário cadastrado.
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
