import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumInputProps {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

/**
 * Campo numérico táctil: evita el bug de `type="number"` en móvil donde el 0
 * inicial no se puede borrar y los dígitos quedan prefijados (p. ej. "0300").
 */
export function NumInput({
  value,
  onChange,
  disabled,
  className,
  id,
  placeholder = "0",
}: NumInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const display = disabled
    ? String(value)
    : draft !== null
      ? draft
      : value === 0
        ? ""
        : String(value);

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      className={cn("text-right tabular-nums", className)}
      value={display}
      onFocus={() => setDraft(value === 0 ? "" : String(value))}
      onBlur={() => {
        const parsed =
          draft === null || draft === "" ? 0 : Number.parseInt(draft, 10) || 0;
        onChange(parsed);
        setDraft(null);
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        setDraft(digits);
      }}
    />
  );
}
