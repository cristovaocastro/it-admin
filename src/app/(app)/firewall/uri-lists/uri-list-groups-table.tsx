"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FirewallUriListGroup } from "@/lib/firewall/uri-lists";
import { EditUriListGroupDialog } from "./uri-list-group-dialog";

export function UriListGroupsTable({ groups, connectionId }: { groups: FirewallUriListGroup[]; connectionId: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>URI lists membro</TableHead>
          <TableHead>Grupos membro</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <TableRow key={g.uuid}>
            <TableCell className="font-medium">{g.name}</TableCell>
            <TableCell className="text-muted-foreground">
              {g.objectNames.length > 0 ? g.objectNames.join(", ") : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {g.groupNames.length > 0 ? g.groupNames.join(", ") : "—"}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-0.5">
                <EditUriListGroupDialog connectionId={connectionId} group={g} />
              </div>
            </TableCell>
          </TableRow>
        ))}
        {groups.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
              Nenhum grupo cadastrado.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
