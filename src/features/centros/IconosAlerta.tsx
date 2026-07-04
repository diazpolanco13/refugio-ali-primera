import {
  BedDouble,
  Droplets,
  Shirt,
  ShowerHead,
  Toilet,
  Trash,
} from "lucide-react";
import type { AlertaCentro, ClaveAlerta } from "@/domain/capacidadCentros";
import { cn } from "@/lib/utils";

export const ICONO_ALERTA: Record<ClaveAlerta, typeof BedDouble> = {
  camas: BedDouble,
  pocetas: Toilet,
  duchas: ShowerHead,
  lavaderos: Shirt,
  contenedores: Trash,
  agua: Droplets,
};

/**
 * Fila de íconos de alerta de un centro (cama, poceta, ducha, lavadero, basura,
 * agua) en rojo (déficit grave) o ámbar (requiere atención). El tooltip de cada
 * ícono explica qué falta y cuánto según el estándar Esfera.
 */
export function IconosAlerta({
  alertas,
  className,
  tamano = "size-3.5",
}: {
  alertas: AlertaCentro[];
  className?: string;
  tamano?: string;
}) {
  if (alertas.length === 0) return null;
  return (
    <span
      className={cn("flex items-center gap-1", className)}
      aria-label="Servicios en déficit"
    >
      {alertas.map((a) => {
        const Icono = ICONO_ALERTA[a.clave];
        return (
          <span key={a.clave} title={a.detalle} className="inline-flex">
            <Icono
              className={cn(
                tamano,
                a.severidad === "rojo" ? "text-red-500" : "text-amber-400",
              )}
            />
          </span>
        );
      })}
    </span>
  );
}
