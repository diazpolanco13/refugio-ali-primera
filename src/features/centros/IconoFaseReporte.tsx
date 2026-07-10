// Icono circular de una fase del reporte diario (completa / en progreso / pendiente / activa).

import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoFaseReporte } from "./ProgresoFasesReporte";

interface Props {
  icono: LucideIcon;
  estado: EstadoFaseReporte;
  activa: boolean;
  /** Tamaño del círculo: xs (desktop), sm (móvil). */
  tamano?: "xs" | "sm";
}

export function IconoFaseReporte({ icono: Icono, estado, activa, tamano = "sm" }: Props) {
  const circulo = tamano === "xs" ? "size-6" : "size-10";
  const iconoSize = tamano === "xs" ? "size-3" : "size-[1.125rem]";
  const checkBadge = tamano === "xs" ? "size-2.5" : "size-3.5";
  const checkIcon = tamano === "xs" ? "size-1.5" : "size-2";
  const completa = estado === "completa";
  // Completa gana sobre activa: el icono queda verde (p. ej. Novedades al cerrar el parte).
  const resaltarActiva = activa && !completa;

  return (
    <span
      className={cn(
        "relative z-10 flex items-center justify-center rounded-full bg-background transition-colors",
        tamano === "xs" ? "border" : "border-2",
        circulo,
        resaltarActiva && "border-teal-400 bg-teal-500/20",
        completa && "border-emerald-500 bg-emerald-500/15",
        !completa && !activa && estado === "en_progreso" && "border-amber-500/80 bg-amber-500/10",
        !completa && !activa && estado === "pendiente" && "border-border bg-muted/40",
      )}
    >
      <Icono
        className={cn(
          iconoSize,
          resaltarActiva && "text-teal-300",
          completa && "text-emerald-400",
          !completa && !activa && estado === "en_progreso" && "text-amber-400",
          !completa && !activa && estado === "pendiente" && "text-muted-foreground",
        )}
      />
      {completa && (
        <span
          className={cn(
            "absolute -bottom-px -right-px flex items-center justify-center rounded-full border border-background bg-emerald-500",
            checkBadge,
          )}
        >
          <Check className={cn(checkIcon, "text-white")} strokeWidth={3} />
        </span>
      )}
    </span>
  );
}
