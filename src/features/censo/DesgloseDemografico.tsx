import { PawPrint } from "lucide-react";
import {
  totalHombres,
  totalMujeres,
  totalPoblacion,
  totalVulnerables,
  type Vulnerables,
} from "@/domain/tipos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { cn } from "@/lib/utils";

interface Props {
  vulnerables: Vulnerables;
  /** Cambia un campo del desglose. */
  onCampo: (campo: keyof Vulnerables, valor: number) => void;
  deshabilitado?: boolean;
  /** Mostrar la fila de totales (hombres/mujeres/total + vulnerables). */
  mostrarTotales?: boolean;
}

/**
 * Grid demográfico por edad y sexo compartido entre el censo de sectores del
 * Parque "Alí Primera" y la ocupación de los Centros Transitorios. Recién
 * nacidos, niñez, adolescentes, adultos, adultos mayores, discapacidad,
 * embarazadas y mascotas (estas no cuentan como población).
 */
export function DesgloseDemografico({
  vulnerables,
  onCampo,
  deshabilitado,
  mostrarTotales = true,
}: Props) {
  const set = (campo: keyof Vulnerables) => (n: number) => onCampo(campo, n);
  const hombres = totalHombres(vulnerables);
  const mujeres = totalMujeres(vulnerables);
  const poblacion = totalPoblacion(vulnerables);
  const vulnerablesCount = totalVulnerables(vulnerables);

  return (
    <div>
      <div className="space-y-2">
        <GrupoSexo
          titulo="Recién nacidos (0-2)"
          etiquetaH="Niños"
          etiquetaM="Niñas"
          valorH={vulnerables.recien_nacidos_h}
          valorM={vulnerables.recien_nacidos_m}
          onH={set("recien_nacidos_h")}
          onM={set("recien_nacidos_m")}
          deshabilitado={deshabilitado}
        />
        <GrupoSexo
          titulo="Niñez (3-11)"
          etiquetaH="Niños"
          etiquetaM="Niñas"
          valorH={vulnerables.ninos}
          valorM={vulnerables.ninas}
          onH={set("ninos")}
          onM={set("ninas")}
          deshabilitado={deshabilitado}
        />
        <GrupoSexo
          titulo="Adolescentes (12-17)"
          valorH={vulnerables.adolescentes_h}
          valorM={vulnerables.adolescentes_m}
          onH={set("adolescentes_h")}
          onM={set("adolescentes_m")}
          deshabilitado={deshabilitado}
        />
        <GrupoSexo
          titulo="Adultos (18-59)"
          valorH={vulnerables.adultos_h}
          valorM={vulnerables.adultos_m}
          onH={set("adultos_h")}
          onM={set("adultos_m")}
          deshabilitado={deshabilitado}
        />
        <GrupoSexo
          titulo="Adultos mayores (60+)"
          valorH={vulnerables.adultos_mayores_h}
          valorM={vulnerables.adultos_mayores_m}
          onH={set("adultos_mayores_h")}
          onM={set("adultos_mayores_m")}
          deshabilitado={deshabilitado}
        />
        <GrupoSexo
          titulo="Discapacidad / patologías"
          valorH={vulnerables.discapacidad_h}
          valorM={vulnerables.discapacidad_m}
          onH={set("discapacidad_h")}
          onM={set("discapacidad_m")}
          deshabilitado={deshabilitado}
        />
        <Card size="sm" className="py-2">
          <CardContent className="flex items-center justify-between gap-3 px-3">
            <span className="text-xs text-muted-foreground">Embarazadas</span>
            <NumInput
              className="w-24"
              value={vulnerables.embarazadas}
              disabled={deshabilitado}
              onChange={set("embarazadas")}
            />
          </CardContent>
        </Card>
        <Card size="sm" className="py-2">
          <CardContent className="flex items-center justify-between gap-3 px-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PawPrint className="size-3.5" />
              Mascotas
              <span className="text-[10px] text-muted-foreground/70">
                (no cuenta como población)
              </span>
            </span>
            <NumInput
              className="w-24"
              value={vulnerables.mascotas}
              disabled={deshabilitado}
              onChange={set("mascotas")}
            />
          </CardContent>
        </Card>
      </div>

      {mostrarTotales && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <TotalBadge etiqueta="♂ Hombres" valor={hombres} clase="text-sky-300" />
            <TotalBadge etiqueta="♀ Mujeres" valor={mujeres} clase="text-pink-300" />
            <TotalBadge etiqueta="Total" valor={poblacion} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Grupos vulnerables prioritarios:{" "}
            <span className="font-medium text-foreground">{vulnerablesCount}</span>
          </p>
        </>
      )}
    </div>
  );
}

function GrupoSexo({
  titulo,
  etiquetaH = "Hombres",
  etiquetaM = "Mujeres",
  valorH,
  valorM,
  onH,
  onM,
  deshabilitado,
}: {
  titulo: string;
  etiquetaH?: string;
  etiquetaM?: string;
  valorH: number;
  valorM: number;
  onH: (n: number) => void;
  onM: (n: number) => void;
  deshabilitado?: boolean;
}) {
  return (
    <Card size="sm" className="py-2">
      <CardHeader className="px-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 px-3 pt-0">
        <div>
          <Label className="text-[11px] text-muted-foreground">{etiquetaH}</Label>
          <NumInput className="mt-1" value={valorH} disabled={deshabilitado} onChange={onH} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">{etiquetaM}</Label>
          <NumInput className="mt-1" value={valorM} disabled={deshabilitado} onChange={onM} />
        </div>
      </CardContent>
    </Card>
  );
}

function TotalBadge({
  etiqueta,
  valor,
  clase,
}: {
  etiqueta: string;
  valor: number;
  clase?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2 py-1.5 text-center">
      <div className={cn("text-base font-bold text-foreground", clase)}>
        {valor.toLocaleString("es")}
      </div>
      <div className="text-[10px] text-muted-foreground">{etiqueta}</div>
    </div>
  );
}
