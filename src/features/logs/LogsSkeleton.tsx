import {
  LoadingList,
  LoadingTable,
  SectionSkeletonFrame,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de la bitácora (`/logs`) — silueta MarcoVista. */
export function LogsSkeleton() {
  return (
    <SectionSkeletonFrame
      enMarco
      etiqueta="Cargando bitácora"
      cuerpoClassName="overflow-auto"
    >
      <div
        className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 lg:px-6"
        aria-hidden
      >
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="space-y-2 pt-0.5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52 max-w-full" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4 lg:p-6" aria-hidden>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <LoadingTable rows={8} cols={4} conToolbar={false} />
          <div className="rounded-xl border border-border/40 p-3">
            <Skeleton className="mb-3 h-4 w-28" />
            <LoadingList count={5} conMarcador={false} />
          </div>
        </div>
      </div>
    </SectionSkeletonFrame>
  );
}
