// Cabecera de progreso compartida entre navegación móvil y desktop del reporte diario.

import { cn } from "@/lib/utils";

export type EstadoFaseReporte = "completa" | "en_progreso" | "pendiente";

export interface FaseReporteNav {
  value: string;
  titulo: string;
  /** Etiqueta accesible / tooltip. */
  etiquetaMovil: string;
  icono: import("lucide-react").LucideIcon;
  estado: EstadoFaseReporte;
  /** Derivado de `estado === "completa"` para contadores y barra. */
  completa: boolean;
}

/** Calcula el estado visual de una fase con revisión y cambios pendientes. */
export function estadoFaseReporte(revisado: boolean, modificado: boolean): EstadoFaseReporte {
  if (revisado && !modificado) return "completa";
  if (modificado || revisado) return "en_progreso";
  return "pendiente";
}

interface Props {
  fases: FaseReporteNav[];
  faseActiva: string;
  className?: string;
}

export function ProgresoFasesReporte({ fases, faseActiva, className }: Props) {
  const indiceActivo = fases.findIndex((f) => f.value === faseActiva);
  const completadas = fases.filter((f) => f.completa).length;
  const pendientes = fases.length - completadas;
  const progreso = fases.length > 0 ? (completadas / fases.length) * 100 : 0;
  const tituloActivo = fases[indiceActivo]?.titulo ?? "";
  const total = fases.length;
  const reporteCompleto = completadas === total && total > 0;

  return (
    <div className={className}>
      <div className="flex min-h-0 items-center justify-between gap-2 text-[10px] leading-snug text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">
          {reporteCompleto ? (
            <span className="font-semibold text-emerald-400">Reporte completo</span>
          ) : indiceActivo >= 0 ? (
            <>
              Fase{" "}
              <span className="font-semibold text-foreground">{tituloActivo}</span>
              {" · "}
              <span className="font-medium text-amber-400">
                {pendientes === 1 ? "1 pendiente" : `${pendientes} pendientes`}
              </span>
            </>
          ) : (
            "Reporte por fases"
          )}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 tabular-nums text-[10px] font-medium",
            reporteCompleto
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400",
          )}
        >
          {completadas}/{total}
        </span>
      </div>
      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-muted/60 sm:mt-1.5 sm:h-1">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            reporteCompleto ? "bg-emerald-500" : "bg-teal-500",
          )}
          style={{ width: `${progreso}%` }}
        />
      </div>
    </div>
  );
}
