import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  count?: number;
  className?: string;
}

/** Fila de KPIs fantasma (mirror de TotalesMapaCentros / cintas de métricas). */
export function LoadingStatCards({ count = 5, className }: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5 sm:grid-cols-5 sm:gap-2",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 bg-card/40 px-2.5 py-2 sm:px-3"
        >
          <Skeleton className="size-7 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-2 w-10" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
