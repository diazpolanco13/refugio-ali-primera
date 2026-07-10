import {
  LoadingStatCards,
  SectionSkeletonFrame,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Posiciones fijas de marcadores fantasma (evita layout aleatorio / CLS). */
const MARCADORES_FANTASMA = [
  { top: "18%", left: "42%" },
  { top: "24%", left: "58%" },
  { top: "32%", left: "36%" },
  { top: "38%", left: "72%" },
  { top: "45%", left: "48%" },
  { top: "52%", left: "63%" },
  { top: "58%", left: "40%" },
  { top: "64%", left: "55%" },
  { top: "70%", left: "78%" },
  { top: "42%", left: "28%" },
] as const;

/**
 * Skeleton del mapa. Replica el estado inicial real: panel de lista CERRADO
 * (`panelCentrosAbierto` default false), controles flotantes a la izquierda
 * y cinta de KPIs sin solapar el menú/sidebar.
 */
export function MapaSectionSkeleton() {
  return (
    <SectionSkeletonFrame
      etiqueta="Cargando mapa de campamentos"
      className="relative overflow-hidden bg-[#0c0f12]"
    >
      {/* Basemap + grid */}
      <div className="absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 55%, transparent) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(0,0,0,0.45)_100%)]" />

        {MARCADORES_FANTASMA.map((pos, i) => (
          <Skeleton
            key={i}
            className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background/40"
            style={{ top: pos.top, left: pos.left }}
          />
        ))}

        {/* Zoom / capas (derecha) */}
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="mt-2 size-8 rounded-md" />
        </div>

        {/* Leyenda */}
        <div className="absolute bottom-4 left-3 flex items-center gap-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="size-3 rounded-full" />
        </div>
      </div>

      {/* Controles flotantes izq. (panel cerrado → ButtonGroup, no lista expandida) */}
      <div
        className="absolute left-3 top-3 z-20 flex flex-col gap-1 overflow-hidden rounded-xl border border-border/60 bg-card/90 p-1 shadow-lg"
        aria-hidden
      >
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="size-8 rounded-md" />
      </div>

      {/* KPIs: franja superior del mapa, sin panel que las tape */}
      <div
        className="pointer-events-none absolute inset-x-3 bottom-8 z-10 sm:inset-x-14 md:bottom-auto md:left-16 md:right-14 md:top-3"
        aria-hidden
      >
        <LoadingStatCards count={5} />
      </div>
    </SectionSkeletonFrame>
  );
}
