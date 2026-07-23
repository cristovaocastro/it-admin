"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { FirewallConnection } from "@/generated/prisma/client";

export function FirewallConnectionPicker({
  connections,
  selectedId,
  basePath,
}: {
  connections: Pick<FirewallConnection, "id" | "name">[];
  selectedId: string;
  basePath: string;
}) {
  const router = useRouter();
  const items = Object.fromEntries(connections.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">Conexão de firewall</Label>
      <Select items={items} value={selectedId} onValueChange={(value) => router.push(`${basePath}?conexao=${value}`)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {connections.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
