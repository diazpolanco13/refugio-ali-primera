// Barra inferior móvil del reporte diario: fases secuenciales con flechas.

import { Fragment } from "react";
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

export function NavegacionFasesReporteMovil({ fases, faseActiva }: Props) {
  return (
    <div className="box-border w-full max-w-[100dvw] border-t border-border/80 bg-background shadow-[0_-6px_28px_rgba(0,0,0,0.45)]">
      <div className="space-y-1.5 border-b border-border/50 px-3 pb-2 pt-2 sm:px-4">
        <ProgresoFasesReporte fases={fases} faseActiva={faseActiva} />
      </div>

      <TabsList
        className={cn(
          "flex h-auto w-full items-center gap-0.5 overflow-visible rounded-none border-0 bg-transparent",
          "px-2 pb-3.5 pt-3 sm:gap-1 sm:px-3 sm:pb-4 sm:pt-3.5",
        )}
      >
        {fases.map((fase, i) => {
          const activa = fase.value === faseActiva;
          const esUltima = i === fases.length - 1;

          return (
            <Fragment key={fase.value}>
              <TabsTrigger
                value={fase.value}
                title={fase.etiquetaMovil || fase.titulo}
                aria-label={`${fase.titulo}${fase.completa ? " (completa)" : " (pendiente)"}`}
                className={cn(
                  "flex h-auto min-w-0 flex-1 flex-col items-center justify-center overflow-visible rounded-lg border-0 bg-transparent p-1 shadow-none",
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
              {!esUltima ? (
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "pointer-events-none size-3 shrink-0",
                    fase.estado === "completa"
                      ? "text-emerald-500/70"
                      : "text-muted-foreground/35",
                  )}
                  strokeWidth={2.5}
                />
              ) : null}
            </Fragment>
          );
        })}
      </TabsList>
    </div>
  );
}
