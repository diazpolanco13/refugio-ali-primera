import { LayoutGrid } from "lucide-react";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton de la ficha individual (`/centro/:id`): mismo marco, encabezado,
 * pestañas y cuerpo — sin el texto plano «Cargando campamento…».
 */
export function FichaCentroSkeleton() {
  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col"
    >
      <VistaEncabezado
        icono={LayoutGrid}
        acento="sky"
        titulo="Cargando campamento…"
        descripcion="Ficha del campamento en la red"
        acciones={
          <div className="flex gap-2" aria-hidden>
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        }
      />

      <div className="shrink-0 border-b border-border px-3 pt-2 sm:px-4 lg:px-6" aria-hidden>
        <div className="flex flex-wrap gap-1.5 pb-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-[4.5rem] rounded-lg sm:w-24" />
          ))}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6"
        aria-busy="true"
        aria-label="Cargando ficha del campamento"
      >
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-card/70 p-4">
              <Skeleton className="mb-3 h-4 w-32" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="space-y-1.5 rounded-lg border border-border/40 p-2.5"
                  >
                    <Skeleton className="h-2.5 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/70 p-4">
              <Skeleton className="mb-3 h-4 w-40" />
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-card/70 p-4">
              <Skeleton className="mb-3 h-4 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="mt-3 h-24 w-full rounded-lg" />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/70 p-4">
              <Skeleton className="mb-3 h-4 w-36" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </MarcoVista>
  );
}
