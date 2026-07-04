import type { Rol } from "@/data/authSupabase";
import { permisosDeRol } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ESTILOS: Record<Rol, string> = {
  admin: "border-violet-500/40 bg-violet-950/40 text-violet-300",
  analista_sae: "border-teal-500/40 bg-teal-950/40 text-teal-300",
  autoridad: "border-amber-500/40 bg-amber-950/40 text-amber-300",
  supervisor: "border-sky-500/40 bg-sky-950/40 text-sky-300",
  operador: "border-emerald-500/40 bg-emerald-950/40 text-emerald-300",
};

export function BadgeRol({ rol, className }: { rol: Rol; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] uppercase", ESTILOS[rol] ?? "text-muted-foreground", className)}
    >
      {permisosDeRol(rol).etiqueta}
    </Badge>
  );
}
