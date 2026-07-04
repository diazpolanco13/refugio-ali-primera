import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Badge reutilizable para ítems del menú aún no disponibles. */
export function BadgeEnDesarrollo({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "pointer-events-none ml-auto text-[9px] font-normal text-muted-foreground",
        className,
      )}
    >
      Por desarrollar
    </Badge>
  );
}
