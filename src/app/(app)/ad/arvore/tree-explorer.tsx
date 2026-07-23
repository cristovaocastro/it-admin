"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { OuTreeNode } from "./ou-tree-node";
import { OuContentsPanel } from "./ou-contents-panel";

export function TreeExplorer({
  connectionId,
  rootDn,
  rootLabel,
}: {
  connectionId: string;
  rootDn: string;
  rootLabel: string;
}) {
  const [selectedPath, setSelectedPath] = useState<string[]>([rootDn]);
  const [treeVersion, setTreeVersion] = useState(0);

  const selectedDn = selectedPath[selectedPath.length - 1];

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <Card className="w-72 shrink-0 overflow-auto p-2">
        <OuTreeNode
          key={treeVersion}
          connectionId={connectionId}
          node={{ dn: rootDn, name: rootLabel, kind: "ROOT" }}
          depth={0}
          parentPath={[]}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
        />
      </Card>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        <OuContentsPanel
          connectionId={connectionId}
          dn={selectedDn}
          onNavigate={(childDn) => setSelectedPath((prev) => [...prev, childDn])}
          onTreeChange={() => setTreeVersion((v) => v + 1)}
        />
      </Card>
    </div>
  );
}
