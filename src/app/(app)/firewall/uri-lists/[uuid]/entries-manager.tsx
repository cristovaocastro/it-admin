"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateUriListObjectEntriesAction } from "@/lib/actions/firewall-uri-lists-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Save, Search, Trash2, Undo2, X } from "lucide-react";
import type { FirewallUriListObject } from "@/lib/firewall/uri-lists";

const PAGE_SIZE = 20;

type EntryKind = "uris" | "domains" | "keywords";

const KIND_LABEL: Record<EntryKind, { tab: string; singular: string; placeholder: string }> = {
  uris: { tab: "URIs", singular: "URI", placeholder: "exemplo.com/pagina" },
  domains: { tab: "Domínios", singular: "domínio", placeholder: "exemplo.com" },
  keywords: { tab: "Palavras-chave", singular: "palavra-chave", placeholder: "palavra" },
};

function EntryList({
  kind,
  values,
  onAdd,
  onRemove,
  onEdit,
}: {
  kind: EntryKind;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onEdit: (oldValue: string, newValue: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newValue, setNewValue] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const label = KIND_LABEL[kind];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? values.filter((v) => v.toLowerCase().includes(q)) : values;
    return [...list].sort((a, b) => a.localeCompare(b));
  }, [values, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleAdd() {
    const value = newValue.trim();
    if (!value) return;
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      toast.warning(`Esse ${label.singular} já está na lista.`);
      return;
    }
    onAdd(value);
    setNewValue("");
    setSearch("");
    setPage(1);
  }

  function startEdit(value: string) {
    setEditingValue(value);
    setEditDraft(value);
  }

  function cancelEdit() {
    setEditingValue(null);
    setEditDraft("");
  }

  function confirmEdit(oldValue: string) {
    const value = editDraft.trim();
    if (!value) return;
    if (value !== oldValue && values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      toast.warning(`Esse ${label.singular} já está na lista.`);
      return;
    }
    if (value !== oldValue) onEdit(oldValue, value);
    cancelEdit();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={`Adicionar ${label.singular} (ex: ${label.placeholder})`}
          className="max-w-sm"
        />
        <Button type="button" variant="outline" onClick={handleAdd} disabled={!newValue.trim()}>
          <Plus className="size-4" />
          Adicionar
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar..."
            className="w-56"
          />
        </div>
      </div>

      <div className="rounded-md border">
        {paged.length > 0 ? (
          <div className="divide-y">
            {paged.map((value) =>
              editingValue === value ? (
                <div key={value} className="flex items-center gap-2 px-3 py-1.5">
                  <Input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmEdit(value);
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    className="h-8"
                  />
                  <Button variant="ghost" size="icon-sm" title="Salvar" onClick={() => confirmEdit(value)}>
                    <Check className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Cancelar" onClick={cancelEdit}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div key={value} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="truncate" title={value}>
                    {value}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => startEdit(value)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Remover" onClick={() => onRemove(value)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {values.length === 0 ? `Nenhum ${label.singular} cadastrado.` : "Nenhum resultado para a busca."}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length} {filtered.length === 1 ? "item" : "itens"}
          {search && ` (de ${values.length} no total)`} · página {currentPage} de {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EntriesManager({
  connectionId,
  object,
}: {
  connectionId: string;
  object: FirewallUriListObject;
}) {
  const router = useRouter();
  const [uris, setUris] = useState(object.uris);
  const [domains, setDomains] = useState(object.domains);
  const [keywords, setKeywords] = useState(object.keywords);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty =
    !arraysEqual(uris, object.uris) || !arraysEqual(domains, object.domains) || !arraysEqual(keywords, object.keywords);

  function handleSave() {
    setError(null);
    startSaving(async () => {
      const result = await updateUriListObjectEntriesAction({
        connectionId,
        uuid: object.uuid,
        name: object.name,
        uris,
        domains,
        keywords,
      });
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(result?.success ?? "Salvo.");
        router.refresh();
      }
    });
  }

  function handleDiscard() {
    setUris(object.uris);
    setDomains(object.domains);
    setKeywords(object.keywords);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {dirty && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">Há alterações não salvas</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={handleDiscard}>
              <Undo2 className="size-4" />
              Descartar
            </Button>
            <Button size="sm" disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar alterações
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="uris">
            <TabsList>
              <TabsTrigger value="uris">
                URIs <Badge variant="outline" className="ml-1.5">{uris.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="domains">
                Domínios <Badge variant="outline" className="ml-1.5">{domains.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="keywords">
                Palavras-chave <Badge variant="outline" className="ml-1.5">{keywords.length}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="uris" className="pt-4">
              <EntryList
                kind="uris"
                values={uris}
                onAdd={(v) => setUris((prev) => [...prev, v])}
                onRemove={(v) => setUris((prev) => prev.filter((x) => x !== v))}
                onEdit={(oldV, newV) => setUris((prev) => prev.map((x) => (x === oldV ? newV : x)))}
              />
            </TabsContent>
            <TabsContent value="domains" className="pt-4">
              <EntryList
                kind="domains"
                values={domains}
                onAdd={(v) => setDomains((prev) => [...prev, v])}
                onRemove={(v) => setDomains((prev) => prev.filter((x) => x !== v))}
                onEdit={(oldV, newV) => setDomains((prev) => prev.map((x) => (x === oldV ? newV : x)))}
              />
            </TabsContent>
            <TabsContent value="keywords" className="pt-4">
              <EntryList
                kind="keywords"
                values={keywords}
                onAdd={(v) => setKeywords((prev) => [...prev, v])}
                onRemove={(v) => setKeywords((prev) => prev.filter((x) => x !== v))}
                onEdit={(oldV, newV) => setKeywords((prev) => prev.map((x) => (x === oldV ? newV : x)))}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}
