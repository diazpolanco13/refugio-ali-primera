import { DemografiaResumen } from "@/features/tablero/DemografiaResumen";
import {
  totalPoblacion,
  type EstadoSector,
  type Sector,
} from "@/domain/tipos";
import { cn } from "@/lib/utils";

const ESTADO_LABEL: Record<EstadoSector, string> = {
  verde: "Cobertura OK",
  amarillo: "Brechas menores",
  rojo: "Brechas críticas",
};

interface Props {
  sector: Pick<
    Sector,
    "nombre" | "carpas" | "familias" | "poblacion_estimada" | "vulnerables"
  >;
  colorEstado: string;
  estado: EstadoSector;
  /** Muestra “Clic para editar” (p. ej. popup del polígono). */
  mostrarAccion?: boolean;
  className?: string;
}

export function PreviewSectorDatos({
  sector,
  colorEstado,
  estado,
  mostrarAccion = false,
  className,
}: Props) {
  const poblacion =
    totalPoblacion(sector.vulnerables) || sector.poblacion_estimada || 0;
  const carpas = sector.carpas ?? 0;
  const familias = sector.familias ?? 0;
  const tieneCenso = carpas > 0 || familias > 0 || poblacion > 0;
  const tieneDesglose =
    totalPoblacion(sector.vulnerables) > 0 ||
    (sector.vulnerables?.embarazadas ?? 0) > 0;

  const stats: string[] = [];
  if (carpas > 0) stats.push(`${carpas} carpas`);
  if (familias > 0) stats.push(`${familias} fam.`);
  if (poblacion > 0) stats.push(`${poblacion.toLocaleString("es")} pers.`);

  return (
    <div className={cn("min-w-[180px] max-w-[240px] space-y-2 text-left", className)}>
      <div className="flex items-center gap-2">
        <span
          className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-background"
          style={{ background: colorEstado }}
          aria-hidden
        />
        <span className="truncate font-semibold text-foreground">{sector.nombre}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {ESTADO_LABEL[estado]}
        </span>
      </div>

      {stats.length > 0 ? (
        <p className="text-xs text-muted-foreground">{stats.join(" · ")}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Sin datos de censo</p>
      )}

      {tieneCenso && tieneDesglose && (
        <DemografiaResumen
          vulnerables={sector.vulnerables}
          compacto
          className="border-border/50"
        />
      )}

      {mostrarAccion && (
        <p className="text-[10px] text-muted-foreground/80">Clic para editar</p>
      )}
    </div>
  );
}

export { ESTADO_LABEL };
