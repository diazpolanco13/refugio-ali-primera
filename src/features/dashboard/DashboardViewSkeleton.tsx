import {
  LoadingList,
  LoadingStatCards,
  SectionSkeletonFrame,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton full-bleed de la sala situacional (`/dashboard`, fuera del AppShell). */
export function DashboardViewSkeleton() {
  return (
    <SectionSkeletonFrame
      etiqueta="Cargando sala situacional"
      className="h-[100dvh] gap-3 bg-background p-3 lg:flex-row lg:gap-4 lg:p-4"
    >
      {/* Columna mapa (~20%) */}
      <div
        className="relative min-h-[36vh] flex-1 overflow-hidden rounded-xl border border-border/40 bg-[#0c0f12] lg:min-h-0 lg:w-1/5 lg:flex-none"
        aria-hidden
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--border) 50%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 50%, transparent) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <Skeleton className="absolute left-[30%] top-[35%] size-7 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <Skeleton className="absolute left-[55%] top-[48%] size-7 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <Skeleton className="absolute left-[42%] top-[62%] size-7 -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>

      {/* Columna métricas (~80%) */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto lg:w-4/5 lg:flex-none">
        <div className="flex items-start justify-between gap-3" aria-hidden>
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
          <div className="space-y-1 text-right">
            <Skeleton className="ml-auto h-7 w-28" />
            <Skeleton className="ml-auto h-3 w-36" />
          </div>
        </div>
        {/* L1 globales */}
        <LoadingStatCards count={4} className="sm:grid-cols-4" />
        {/* L2 por zona */}
        <div className="grid gap-3 lg:grid-cols-2" aria-hidden>
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        {/* Cinta */}
        <Skeleton className="h-10 w-full rounded-xl" />
        {/* Paneles fila */}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 p-3" aria-hidden>
              <Skeleton className="mb-3 h-4 w-24" />
              <LoadingList count={4} conMarcador={false} />
            </div>
          ))}
        </div>
      </div>
    </SectionSkeletonFrame>
  );
}
