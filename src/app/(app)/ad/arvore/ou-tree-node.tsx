"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Loader2, Folder, Building2 } from "lucide-react";
import { getOuChildrenAction } from "@/lib/actions/ad-tree-actions";
import type { AdContainerNode } from "@/lib/ad/tree";

export type TreeNode = AdContainerNode | { dn: string; name: string; kind: "ROOT" };

export function OuTreeNode({
  connectionId,
  node,
  depth,
  parentPath,
  selectedPath,
  onSelect,
}: {
  connectionId: string;
  node: TreeNode;
  depth: number;
  /** DNs dos ancestrais deste nó, sem incluir ele mesmo. */
  parentPath: string[];
  /** Caminho completo (raiz → nó selecionado) que a árvore deve refletir. */
  selectedPath: string[];
  onSelect: (path: string[]) => void;
}) {
  const myPath = [...parentPath, node.dn];
  const isOnSelectedPath = selectedPath.length >= myPath.length && myPath.every((dn, i) => selectedPath[i] === dn);
  const isSelected = selectedPath[selectedPath.length - 1] === node.dn && isOnSelectedPath;
  const shouldBeExpanded = depth === 0 || (isOnSelectedPath && selectedPath.length > myPath.length);

  const [expanded, setExpanded] = useState(shouldBeExpanded);
  const [children, setChildren] = useState<AdContainerNode[] | null>(null);
  const [loading, startLoading] = useTransition();

  function loadChildren() {
    if (children !== null || loading) return;
    startLoading(async () => {
      const result = await getOuChildrenAction(connectionId, node.dn);
      if (result.error) {
        toast.error(result.error);
        setChildren([]);
      } else {
        setChildren(result.containers ?? []);
      }
    });
  }

  // Se este nó faz parte do caminho selecionado (ex: navegação feita pelo painel da direita),
  // garante que ele esteja expandido e com os filhos carregados para revelar o próximo passo.
  useEffect(() => {
    if (shouldBeExpanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza expansão com a seleção vinda de fora
      setExpanded(true);
      loadChildren();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldBeExpanded]);

  function toggleExpand() {
    if (!expanded) loadChildren();
    setExpanded((e) => !e);
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded py-1 pr-2 text-sm hover:bg-muted",
          isSelected && "bg-primary/10 font-medium"
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button type="button" onClick={toggleExpand} className="shrink-0 rounded p-0.5 hover:bg-muted-foreground/10">
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
          onClick={() => onSelect(myPath)}
        >
          {depth === 0 ? (
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {expanded && children && (
        <div>
          {children.map((c) => (
            <OuTreeNode
              key={c.dn}
              connectionId={connectionId}
              node={c}
              depth={depth + 1}
              parentPath={myPath}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
          {children.length === 0 && (
            <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}>
              Vazio
            </p>
          )}
        </div>
      )}
    </div>
  );
}
