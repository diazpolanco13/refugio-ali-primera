import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  rows?: number;
  cols?: number;
  className?: string;
  /** Barra de herramientas encima de la tabla. */
  conToolbar?: boolean;
}

/** Tabla fantasma con thead + filas. */
export function LoadingTable({
  rows = 8,
  cols = 5,
  className,
  conToolbar = true,
}: Props) {
  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)} aria-hidden>
      {conToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-48 max-w-full flex-1 sm:flex-none" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-border/40">
        <div
          className="grid gap-2 border-b border-border/40 bg-muted/30 px-3 py-2.5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }, (_, i) => (
            <Skeleton key={i} className="h-3 w-[70%]" />
          ))}
        </div>
        <div className="divide-y divide-border/30">
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={r}
              className="grid gap-2 px-3 py-3"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: cols }, (_, c) => (
                <Skeleton
                  key={c}
                  className="h-3.5"
                  style={{ width: `${55 + ((r + c) * 9) % 40}%` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
