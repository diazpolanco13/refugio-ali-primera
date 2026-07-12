import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marca visual del campamento sandbox (no cuenta en totales de la red). */
export function BadgePruebaCentro({
  className,
  compacto = false,
}: {
  className?: string;
  compacto?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-amber-500/60 bg-amber-500/15 font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400",
        compacto ? "px-1 py-0 text-[9px]" : "text-[10px]",
        className,
      )}
    >
      Prueba
    </Badge>
  );
}
