import {
  LoadingForm,
  LoadingTable,
  SectionSkeletonFrame,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  variante?: "usuarios" | "unidades";
}

/** Skeleton de pantallas de configuración / gestión — silueta MarcoVista. */
export function GestionSkeleton({ variante = "usuarios" }: Props) {
  return (
    <SectionSkeletonFrame
      enMarco
      etiqueta="Cargando gestión"
      cuerpoClassName="overflow-auto"
    >
      <div
        className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 lg:px-6"
        aria-hidden
      >
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="space-y-2 pt-0.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="space-y-4 p-4 lg:p-6" aria-hidden>
        {variante === "usuarios" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-[4.5rem] rounded-xl" />
              <Skeleton className="h-[4.5rem] rounded-xl" />
              <Skeleton className="h-[4.5rem] rounded-xl" />
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-8 w-full max-w-xl rounded-lg" />
            <LoadingTable rows={6} cols={3} conToolbar={false} />
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <LoadingTable rows={7} cols={4} />
            <div className="rounded-xl border border-border/40 p-4">
              <LoadingForm fields={4} />
            </div>
          </div>
        )}
      </div>
    </SectionSkeletonFrame>
  );
}
