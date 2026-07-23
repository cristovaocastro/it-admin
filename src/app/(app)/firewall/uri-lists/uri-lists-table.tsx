import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { FirewallUriListObject } from "@/lib/firewall/uri-lists";

export function UriListsTable({ objects, connectionId }: { objects: FirewallUriListObject[]; connectionId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Entradas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {objects.map((o) => (
          <TableRow key={o.uuid}>
            <TableCell className="font-medium">
              <Link href={`/firewall/uri-lists/${o.uuid}?conexao=${connectionId}`} className="hover:underline">
                {o.name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{o.uris.length + o.domains.length + o.keywords.length}</Badge>
            </TableCell>
          </TableRow>
        ))}
        {objects.length === 0 && (
          <TableRow>
            <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">
              Nenhuma URI list cadastrada.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
