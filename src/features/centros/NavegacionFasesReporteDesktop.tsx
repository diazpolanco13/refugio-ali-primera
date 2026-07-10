// Barra superior desktop del reporte diario: progreso + fases compactas en una franja.

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { IconoFaseReporte } from "./IconoFaseReporte";
import { ProgresoFasesReporte, type FaseReporteNav } from "./ProgresoFasesReporte";

interface Props {
  fases: FaseReporteNav[];
  faseActiva: string;
}

const ETIQUETAS_CORTAS: Record<string, string> = {
  requerimientos: "Req.",
  novedades: "Noved.",
};

export function NavegacionFasesReporteDesktop({ fases, faseActiva }: Props) {
  const cols = Math.max(fases.length, 1);
  return (
    <div className="hidden shrink-0 overflow-hidden border-b border-border/80 bg-background sm:block">
      <div className="border-b border-border/40 px-4 py-2 sm:px-6">
        <ProgresoFasesReporte fases={fases} faseActiva={faseActiva} />
      </div>

      <TabsList
        variant="line"
        className={cn(
          "!grid h-10 w-full min-w-0 gap-0 overflow-hidden rounded-none bg-background p-0",
        )}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {fases.map((fase) => {
          const activa = fase.value === faseActiva;
          const etiqueta = ETIQUETAS_CORTAS[fase.value] ?? fase.titulo;

          return (
            <TabsTrigger
              key={fase.value}
              value={fase.value}
              title={fase.etiquetaMovil || fase.titulo}
              aria-label={fase.titulo}
              className={cn(
                "relative flex h-full min-h-0 min-w-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-none px-0.5 py-0",
                "!border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
                "text-[10px] font-medium leading-none text-muted-foreground",
                "transition-colors hover:text-foreground",
                "after:!hidden after:!content-none",
                "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
                "data-active:!bg-transparent data-active:!text-foreground data-active:!shadow-none",
                "dark:data-active:!border-x-transparent dark:data-active:!border-t-transparent dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
                "sm:gap-1.5 sm:px-1 sm:text-xs",
              )}
            >
              <IconoFaseReporte
                icono={fase.icono}
                estado={fase.estado}
                activa={activa}
                tamano="xs"
              />
              <span
                className={cn(
                  "min-w-0 truncate",
                  fase.estado === "completa" && "text-emerald-400",
                  activa && fase.estado !== "completa" && "text-teal-300",
                  !activa && fase.estado === "en_progreso" && "text-amber-400",
                  !activa && fase.estado === "pendiente" && "text-muted-foreground",
                )}
              >
                {etiqueta}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
