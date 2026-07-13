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
  const circulo = tamano === "xs" ? "size-6" : "size-9";
  const iconoSize = tamano === "xs" ? "size-3" : "size-4";
  const checkBadge = tamano === "xs" ? "size-2.5" : "size-3.5";
  const checkIcon = tamano === "xs" ? "size-1.5" : "size-2";
  const completa = estado === "completa";
  // Completa gana sobre activa: el icono queda verde (p. ej. Novedades al cerrar el parte).
  const resaltarActiva = activa && !completa;
  const pendiente = !completa && !activa && estado === "pendiente";
  const enProgreso = !completa && !activa && estado === "en_progreso";

  return (
    <span
      className={cn(
        "relative z-10 flex items-center justify-center rounded-full bg-background transition-colors",
        tamano === "xs" ? "border" : "border-2",
        circulo,
        resaltarActiva && "border-teal-400 bg-teal-500/20 shadow-[0_0_0_2px_rgba(45,212,191,0.2)]",
        completa && "border-emerald-500 bg-emerald-500/15",
        enProgreso && "border-amber-500/90 bg-amber-500/15",
        pendiente && "border-dashed border-amber-500/55 bg-amber-500/5",
      )}
    >
      <Icono
        className={cn(
          iconoSize,
          resaltarActiva && "text-teal-300",
          completa && "text-emerald-400",
          enProgreso && "text-amber-400",
          pendiente && "text-amber-400/80",
        )}
      />
      {completa ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 flex items-center justify-center rounded-full border border-background bg-emerald-500",
            checkBadge,
          )}
        >
          <Check className={cn(checkIcon, "text-white")} strokeWidth={3} />
        </span>
      ) : pendiente ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border border-background bg-amber-500",
            tamano === "xs" ? "size-2" : "size-2.5",
          )}
          aria-hidden
        />
      ) : null}
    </span>
  );
}
