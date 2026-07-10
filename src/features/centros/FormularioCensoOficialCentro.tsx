import { Building2 } from "lucide-react";
import {
  ESTATUS_INSTALACION_OFICIAL,
  type CensoOficialCentro,
  type EstatusInstalacionOficial,
} from "@/domain/centrosTransitorios";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Campo numérico que admite vacío (= null). */
function NumNullable({
  value,
  onChange,
  disabled,
  className,
  id,
  placeholder = "—",
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}) {
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
      value={value == null ? "" : String(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (digits === "") {
          onChange(null);
          return;
        }
        onChange(Number.parseInt(digits, 10) || 0);
      }}
    />
  );
}

/** Formulario del bloque censo oficial: aforo y ente responsable. */
export function FormularioCensoOficialCentro({
  censo,
  onChange,
  deshabilitado,
}: {
  censo: CensoOficialCentro;
  onChange: (c: CensoOficialCentro) => void;
  deshabilitado?: boolean;
}) {
  const set =
    <K extends keyof CensoOficialCentro>(campo: K) =>
    (valor: CensoOficialCentro[K]) =>
      onChange({ ...censo, [campo]: valor });

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground">Censo oficial (aforo)</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          El cupo disponible se calcula como capacidad instalada − damnificados (puede ser
          negativo si hay sobrecupo). No depende de las camas.
        </p>
      </div>

      <Card size="sm" className="py-2">
        <CardContent className="space-y-3 px-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Building2 className="size-4 text-teal-400" />
            Aforo del campamento
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="cap-maxima" className="text-[11px] text-muted-foreground">
                Capacidad máxima
              </Label>
              <NumNullable
                id="cap-maxima"
                className="mt-1"
                value={censo.capacidad_maxima}
                disabled={deshabilitado}
                onChange={set("capacidad_maxima")}
              />
            </div>
            <div>
              <Label htmlFor="cap-instalada" className="text-[11px] text-muted-foreground">
                Capacidad instalada
              </Label>
              <NumNullable
                id="cap-instalada"
                className="mt-1"
                value={censo.capacidad_instalada}
                disabled={deshabilitado}
                onChange={set("capacidad_instalada")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ministerio-ente" className="text-[11px] text-muted-foreground">
              Ministerio / ente responsable
            </Label>
            <Input
              id="ministerio-ente"
              className="mt-1"
              value={censo.ministerio_ente}
              disabled={deshabilitado}
              placeholder="Ej. Ministerio de Educación"
              onChange={(e) => set("ministerio_ente")(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground">Estatus de instalación</Label>
            <Select
              value={censo.estatus_instalacion ?? "sin_dato"}
              disabled={deshabilitado}
              onValueChange={(v) => {
                if (v === "sin_dato") {
                  set("estatus_instalacion")(null);
                  return;
                }
                set("estatus_instalacion")(v as EstatusInstalacionOficial);
              }}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Sin dato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sin_dato">Sin dato</SelectItem>
                {ESTATUS_INSTALACION_OFICIAL.map((e) => (
                  <SelectItem key={e.valor} value={e.valor}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
