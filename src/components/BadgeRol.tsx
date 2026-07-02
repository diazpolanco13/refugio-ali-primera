import type { Rol } from "@/data/auth";
import { INFO_ROLES } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ESTILOS: Record<Rol, string> = {
  admin: "border-violet-500/40 bg-violet-950/40 text-violet-300",
  coordinador: "border-teal-500/40 bg-teal-950/40 text-teal-300",
  campo: "border-sky-500/40 bg-sky-950/40 text-sky-300",
  visor: "text-muted-foreground",
};

export function BadgeRol({ rol, className }: { rol: Rol; className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] uppercase", ESTILOS[rol], className)}>
      {INFO_ROLES[rol].etiqueta}
    </Badge>
  );
}
