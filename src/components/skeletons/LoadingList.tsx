import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  count?: number;
  className?: string;
  /** Mostrar círculo a la izquierda (marcador / avatar). */
  conMarcador?: boolean;
}

/** Lista de filas fantasma (título + subtítulo). */
export function LoadingList({
  count = 8,
  className,
  conMarcador = true,
}: Props) {
  return (
    <ul className={cn("flex flex-col gap-1.5", className)} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-2.5 rounded-lg px-2 py-2"
        >
          {conMarcador && (
            <Skeleton className="size-8 shrink-0 rounded-full" />
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton
              className="h-3.5"
              style={{ width: `${58 + ((i * 11) % 28)}%` }}
            />
            <Skeleton
              className="h-2.5"
              style={{ width: `${36 + ((i * 7) % 22)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
