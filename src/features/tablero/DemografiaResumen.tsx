import { Baby, Heart, PawPrint } from "lucide-react";
import {
  normalizarVulnerables,
  totalPoblacion,
  type Vulnerables,
} from "@/domain/tipos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  vulnerables: Partial<Vulnerables> | null | undefined;
  compacto?: boolean;
  /** Muestra filas etarias aunque estén en cero (p. ej. sector con población sin desglose). */
  mostrarEstructura?: boolean;
  className?: string;
}

function CeldaSexo({
  etiqueta,
  hombres,
  mujeres,
  siempre,
}: {
  etiqueta: string;
  hombres: number;
  mujeres: number;
  siempre?: boolean;
}) {
  if (!siempre && !hombres && !mujeres) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{etiqueta}</span>
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "gap-0.5 px-1.5",
            hombres > 0 ? "border-sky-500/30 text-sky-300" : "text-muted-foreground",
          )}
        >
          ♂ {hombres.toLocaleString("es")}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "gap-0.5 px-1.5",
            mujeres > 0 ? "border-pink-500/30 text-pink-300" : "text-muted-foreground",
          )}
        >
          ♀ {mujeres.toLocaleString("es")}
        </Badge>
      </div>
    </div>
  );
}

export function DemografiaResumen({
  vulnerables: raw,
  compacto = false,
  mostrarEstructura = false,
  className,
}: Props) {
  const v = normalizarVulnerables(raw);
  const tieneDatos =
    totalPoblacion(v) > 0 ||
    v.embarazadas > 0 ||
    v.discapacidad_h > 0 ||
    v.discapacidad_m > 0 ||
    v.mascotas > 0;

  const filas = mostrarEstructura || tieneDatos;

  if (!filas) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Sin desglose demográfico registrado.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "space-y-1.5",
        compacto && "rounded-lg border border-border/60 bg-muted/20 p-2",
        className,
      )}
    >
      {!compacto && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Baby className="size-3" />
          Por edad y sexo
        </div>
      )}
      <CeldaSexo siempre={mostrarEstructura} etiqueta="Recién nacidos (0-2)" hombres={v.recien_nacidos_h} mujeres={v.recien_nacidos_m} />
      <CeldaSexo siempre={mostrarEstructura} etiqueta="Niñez (3-11)" hombres={v.ninos} mujeres={v.ninas} />
      <CeldaSexo siempre={mostrarEstructura} etiqueta="Adolescentes (12-17)" hombres={v.adolescentes_h} mujeres={v.adolescentes_m} />
      <CeldaSexo siempre={mostrarEstructura} etiqueta="Adultos (18-59)" hombres={v.adultos_h} mujeres={v.adultos_m} />
      <CeldaSexo siempre={mostrarEstructura} etiqueta="Adultos mayores (60+)" hombres={v.adultos_mayores_h} mujeres={v.adultos_mayores_m} />
      <CeldaSexo siempre={mostrarEstructura} etiqueta="Discapacidad / patologías" hombres={v.discapacidad_h} mujeres={v.discapacidad_m} />
      {(v.embarazadas > 0 || mostrarEstructura) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Heart className="size-3" />
            Embarazadas
          </span>
          <Badge
            variant="outline"
            className={cn(
              "px-1.5",
              v.embarazadas > 0 ? "border-pink-500/30 text-pink-300" : "text-muted-foreground",
            )}
          >
            {v.embarazadas.toLocaleString("es")}
          </Badge>
        </div>
      )}
      {(v.mascotas > 0 || mostrarEstructura) && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <PawPrint className="size-3" />
            Mascotas
          </span>
          <Badge
            variant="outline"
            className={cn(
              "px-1.5",
              v.mascotas > 0 ? "border-amber-500/30 text-amber-300" : "text-muted-foreground",
            )}
          >
            {v.mascotas.toLocaleString("es")}
          </Badge>
        </div>
      )}
    </div>
  );
}
