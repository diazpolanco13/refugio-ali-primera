import { BedDouble, Droplets, Shirt, ShowerHead, Trash } from "lucide-react";
import type { CapacidadCentro } from "@/domain/centrosTransitorios";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";

function ParRecurso({
  icono,
  label,
  instaladas,
  operativas,
  onInstaladas,
  onOperativas,
  deshabilitado,
}: {
  icono: React.ReactNode;
  label: string;
  instaladas: number;
  operativas: number;
  onInstaladas: (n: number) => void;
  onOperativas: (n: number) => void;
  deshabilitado?: boolean;
}) {
  return (
    <Card size="sm" className="py-2">
      <CardContent className="px-3">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-foreground">
          {icono}
          {label}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Instaladas</Label>
            <NumInput
              className="mt-1"
              value={instaladas}
              disabled={deshabilitado}
              onChange={onInstaladas}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Operativas</Label>
            <NumInput
              className="mt-1"
              value={operativas}
              disabled={deshabilitado}
              onChange={onOperativas}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Formulario de capacidad instalada vs. operativa (camas, baños, agua…). */
export function FormularioCapacidadCentro({
  capacidad,
  onChange,
  deshabilitado,
}: {
  capacidad: CapacidadCentro;
  onChange: (c: CapacidadCentro) => void;
  deshabilitado?: boolean;
}) {
  const setCap =
    (campo: keyof CapacidadCentro) => (valor: number | boolean) =>
      onChange({ ...capacidad, [campo]: valor });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Diagnóstico Esfera: lo instalado vs. operativo. El cupo de personas usa la capacidad
        instalada del censo oficial, no estas camas/baños.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <ParRecurso
          icono={<BedDouble className="size-4 text-primary" />}
          label="Camas"
          instaladas={capacidad.camas_instaladas}
          operativas={capacidad.camas_operativas}
          onInstaladas={setCap("camas_instaladas")}
          onOperativas={setCap("camas_operativas")}
          deshabilitado={deshabilitado}
        />
        <ParRecurso
          icono={<span className="text-base leading-none">🚽</span>}
          label="Pocetas / baños"
          instaladas={capacidad.pocetas_instaladas}
          operativas={capacidad.pocetas_operativas}
          onInstaladas={setCap("pocetas_instaladas")}
          onOperativas={setCap("pocetas_operativas")}
          deshabilitado={deshabilitado}
        />
        <ParRecurso
          icono={<ShowerHead className="size-4 text-cyan-400" />}
          label="Duchas"
          instaladas={capacidad.duchas_instaladas}
          operativas={capacidad.duchas_operativas}
          onInstaladas={setCap("duchas_instaladas")}
          onOperativas={setCap("duchas_operativas")}
          deshabilitado={deshabilitado}
        />
        <ParRecurso
          icono={<Shirt className="size-4 text-violet-400" />}
          label="Lavaderos de ropa"
          instaladas={capacidad.lavaderos_instalados}
          operativas={capacidad.lavaderos_operativos}
          onInstaladas={setCap("lavaderos_instalados")}
          onOperativas={setCap("lavaderos_operativos")}
          deshabilitado={deshabilitado}
        />
        <ParRecurso
          icono={<Trash className="size-4 text-lime-500" />}
          label="Contenedores de basura"
          instaladas={capacidad.contenedores_instalados}
          operativas={capacidad.contenedores_operativos}
          onInstaladas={setCap("contenedores_instalados")}
          onOperativas={setCap("contenedores_operativos")}
          deshabilitado={deshabilitado}
        />
      </div>

      <Card size="sm" className="py-2">
        <CardContent className="space-y-2 px-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <Droplets className="size-4 text-sky-400" />
            Agua potable
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-sky-500"
                checked={capacidad.agua_tanque}
                disabled={deshabilitado}
                onChange={(e) => setCap("agua_tanque")(e.target.checked)}
              />
              Hay tanque
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-emerald-500"
                checked={capacidad.agua_operativa}
                disabled={deshabilitado}
                onChange={(e) => setCap("agua_operativa")(e.target.checked)}
              />
              Suministro operativo
            </label>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">
              Capacidad del tanque (litros)
            </Label>
            <NumInput
              className="mt-1 w-40"
              value={capacidad.agua_litros}
              disabled={deshabilitado}
              onChange={setCap("agua_litros")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
