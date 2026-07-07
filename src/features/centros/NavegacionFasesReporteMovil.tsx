// Barra inferior móvil del reporte diario: fases secuenciales con flechas.

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface FaseReporteNav {
  value: string;
  titulo: string;
  /** Etiqueta accesible / tooltip. */
  etiquetaMovil: string;
  icono: LucideIcon;
  completa: boolean;
}

interface Props {
  fases: FaseReporteNav[];
  faseActiva: string;
}

/** Posición horizontal (%) de cada flecha entre columnas iguales. */
function posicionFlecha(indice: number, total: number): number {
  return ((indice + 1) / total) * 100;
}

export function NavegacionFasesReporteMovil({ fases, faseActiva }: Props) {
  const indiceActivo = fases.findIndex((f) => f.value === faseActiva);
  const completadas = fases.filter((f) => f.completa).length;
  const progreso = fases.length > 0 ? (completadas / fases.length) * 100 : 0;
  const tituloActivo = fases[indiceActivo]?.titulo ?? "";
  const total = fases.length;

  return (
    <div className="box-border w-full max-w-[100dvw] overflow-hidden border-t border-border/80 bg-background shadow-[0_-6px_28px_rgba(0,0,0,0.45)]">
      <div className="space-y-1.5 border-b border-border/50 px-4 pb-2.5 pt-2.5">
        <div className="flex min-h-[1.75rem] items-center justify-between gap-2 text-[10px] leading-snug text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">
            {indiceActivo >= 0 ? (
              <>
                Fase{" "}
                <span className="font-semibold text-foreground">{tituloActivo}</span>
                {" · confirma y avanza"}
              </>
            ) : (
              "Reporte por fases"
            )}
          </span>
          <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 tabular-nums text-[10px] font-medium text-foreground">
            {completadas}/{total}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full rounded-full bg-teal-500 transition-[width] duration-300 ease-out"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      {/* Pasos: 5 columnas iguales; flechas superpuestas (no ocupan ancho) */}
      <div className="relative box-border px-4 pb-3 pt-3">
        <div
          aria-hidden
          className="pointer-events-none absolute left-[12%] right-[12%] top-[1.65rem] h-px bg-border/80"
        />

        {fases.slice(0, -1).map((fase, i) => (
          <ChevronRight
            key={`flecha-${fase.value}`}
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-[1.35rem] size-3.5 -translate-x-1/2",
              fase.completa ? "text-emerald-500/75" : "text-muted-foreground/50",
            )}
            style={{ left: `${posicionFlecha(i, total)}%` }}
            strokeWidth={2.5}
          />
        ))}

        <TabsList
          className={cn(
            "relative z-10 !grid w-full grid-cols-5 gap-0",
            "rounded-none border-0 bg-transparent p-0",
            "!inline-grid",
          )}
        >
          {fases.map((fase) => {
            const activa = fase.value === faseActiva;
            const Icono = fase.icono;

            return (
              <TabsTrigger
                key={fase.value}
                value={fase.value}
                title={fase.etiquetaMovil || fase.titulo}
                aria-label={fase.titulo}
                className={cn(
                  "flex h-auto min-w-0 flex-col items-center justify-center rounded-lg border-0 bg-transparent p-0 shadow-none",
                  "text-muted-foreground transition-colors",
                  "hover:bg-muted/15 hover:text-foreground",
                  "data-active:bg-transparent data-active:shadow-none",
                  "after:!hidden focus-visible:ring-2 focus-visible:ring-teal-500/40",
                )}
              >
                <span
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full border-2 transition-colors",
                    activa &&
                      "border-teal-400 bg-teal-500/20",
                    !activa &&
                      fase.completa &&
                      "border-emerald-500 bg-emerald-500/15",
                    !activa && !fase.completa && "border-border bg-muted/30",
                  )}
                >
                  <Icono
                    className={cn(
                      "size-[1.125rem]",
                      activa && "text-teal-300",
                      !activa && fase.completa && "text-emerald-400",
                      !activa && !fase.completa && "text-muted-foreground",
                    )}
                  />
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </div>
  );
}
