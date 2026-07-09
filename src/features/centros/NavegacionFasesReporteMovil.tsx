// Barra inferior móvil del reporte diario: fases secuenciales con flechas.

import { ChevronRight } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { IconoFaseReporte } from "./IconoFaseReporte";
import { ProgresoFasesReporte, type FaseReporteNav } from "./ProgresoFasesReporte";

export type { FaseReporteNav } from "./ProgresoFasesReporte";

interface Props {
  fases: FaseReporteNav[];
  faseActiva: string;
}

/** Posición horizontal (%) de cada flecha entre columnas iguales. */
function posicionFlecha(indice: number, total: number): number {
  return ((indice + 1) / total) * 100;
}

export function NavegacionFasesReporteMovil({ fases, faseActiva }: Props) {
  const total = fases.length;

  return (
    <div className="box-border w-full max-w-[100dvw] overflow-hidden border-t border-border/80 bg-background shadow-[0_-6px_28px_rgba(0,0,0,0.45)]">
      <div className="space-y-1.5 border-b border-border/50 px-4 pb-2.5 pt-2.5">
        <ProgresoFasesReporte fases={fases} faseActiva={faseActiva} />
      </div>

      <div className="relative box-border px-4 pb-3 pt-3">
        {fases.slice(0, -1).map((fase, i) => (
          <ChevronRight
            key={`flecha-${fase.value}`}
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-1/2 z-0 size-3.5 -translate-x-1/2 -translate-y-1/2",
              fase.estado === "completa" ? "text-emerald-500/80" : "text-muted-foreground/55",
            )}
            style={{ left: `${posicionFlecha(i, total)}%` }}
            strokeWidth={2.5}
          />
        ))}

        <TabsList
          className={cn(
            "relative z-10 !grid w-full gap-0",
            "rounded-none border-0 bg-transparent p-0",
            "!inline-grid",
          )}
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {fases.map((fase) => {
            const activa = fase.value === faseActiva;

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
                <IconoFaseReporte
                  icono={fase.icono}
                  estado={fase.estado}
                  activa={activa}
                />
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
    </div>
  );
}
