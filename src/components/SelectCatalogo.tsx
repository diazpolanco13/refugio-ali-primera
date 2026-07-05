// Select genérico sobre un catálogo de strings (nacionalidad, país, etc.).

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { opcionesConLegacy } from "@/domain/catalogosHumanitarios";

interface Props {
  id?: string;
  label: string;
  value: string;
  opciones: readonly string[];
  onChange: (valor: string) => void;
  disabled?: boolean;
  placeholder?: string;
  descripcion?: string;
  permitirLegacy?: boolean;
  className?: string;
}

export function SelectCatalogo({
  id,
  label,
  value,
  opciones,
  onChange,
  disabled,
  placeholder = "Seleccionar…",
  descripcion,
  permitirLegacy = true,
  className,
}: Props) {
  const lista = permitirLegacy ? opcionesConLegacy([...opciones], value) : [...opciones];
  const selectValue = value.trim() || "none";

  return (
    <div className={className}>
      <Label htmlFor={id} className="text-[10px] text-muted-foreground">
        {label}
      </Label>
      {descripcion && <p className="mt-0.5 text-[10px] text-muted-foreground/80">{descripcion}</p>}
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === "none" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="mt-1 h-9">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{placeholder}</SelectItem>
          {lista.map((op) => (
            <SelectItem key={op} value={op}>
              {op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
