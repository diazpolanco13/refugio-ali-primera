import {
  LoadingStatCards,
  LoadingTable,
  SectionSkeletonFrame,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /** Variante con pestañas (censo rápido). */
  conTabs?: boolean;
  etiqueta?: string;
}

/**
 * Skeleton de vistas tipo listado/tabla de red
 * (reportes diarios, censo rápido, población) — silueta MarcoVista.
 */
export function TablaRedSkeleton({
  conTabs = false,
  etiqueta = "Cargando listado de la red",
}: Props) {
  return (
    <SectionSkeletonFrame
      enMarco
      etiqueta={etiqueta}
      cuerpoClassName="overflow-auto"
    >
      <div
        className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 lg:px-6"
        aria-hidden
      >
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="space-y-2 pt-0.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="flex flex-col gap-3 p-4 lg:p-6" aria-hidden>
        {conTabs && (
          <div className="flex gap-1.5">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        )}

        <LoadingStatCards count={4} className="sm:grid-cols-4" />

        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-48 max-w-full flex-1 sm:flex-none" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>

        <LoadingTable rows={8} cols={5} conToolbar={false} />
      </div>
    </SectionSkeletonFrame>
  );
}
