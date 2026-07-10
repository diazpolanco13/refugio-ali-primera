import {
  LoadingList,
  LoadingTable,
  SectionSkeletonFrame,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  /**
   * `true` como fallback de Suspense (ruta completa).
   * `false` cuando ya estás dentro de `IncidenciasLayout` (evita doble marco).
   */
  enMarco?: boolean;
}

/** Skeleton de bandejas de incidencias. */
export function BandejaIncidenciasSkeleton({ enMarco = true }: Props) {
  return (
    <SectionSkeletonFrame
      enMarco={enMarco}
      etiqueta="Cargando incidencias"
      cuerpoClassName="overflow-auto"
    >
      {enMarco && (
        <div
          className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 lg:px-6"
          aria-hidden
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="space-y-2 pt-0.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      )}

      <div
        className={
          enMarco ? "flex flex-col gap-3 p-4 lg:p-6" : "flex flex-col gap-3 p-4 lg:p-6"
        }
        aria-hidden
      >
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[260px_1fr]">
          <div className="rounded-xl border border-border/40 p-3">
            <Skeleton className="mb-3 h-36 w-full rounded-lg" />
            <LoadingList count={4} conMarcador={false} />
          </div>
          <LoadingTable rows={6} cols={4} conToolbar={false} />
        </div>
      </div>
    </SectionSkeletonFrame>
  );
}
