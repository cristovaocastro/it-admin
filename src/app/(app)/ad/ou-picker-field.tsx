"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdOrganizationalUnit } from "@/lib/ad/ou";

/**
 * Campo de seleção de OU. Mostra o nome amigável da OU (não o DN completo) quando a lista já
 * carregou; se não houver lista (ex: falha ao carregar), cai para um campo de texto livre com
 * o DN como placeholder, evitando bloquear o formulário.
 */
export function OuPickerField({
  fieldName,
  label,
  placeholder,
  selectPlaceholder = "Usar a Base DN",
  value,
  onChange,
  options,
}: {
  fieldName: string;
  label: string;
  placeholder: string;
  selectPlaceholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: AdOrganizationalUnit[] | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldName} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {options && options.length > 0 ? (
        <Select
          items={Object.fromEntries(options.map((o) => [o.dn, o.name]))}
          value={value || undefined}
          onValueChange={(v) => onChange(v ?? "")}
        >
          <SelectTrigger id={fieldName} className="w-full">
            <SelectValue placeholder={selectPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.dn} value={o.dn}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input id={fieldName} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      <input type="hidden" name={fieldName} value={value} />
    </div>
  );
}
