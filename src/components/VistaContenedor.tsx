import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Ancho máximo estándar de las vistas principales dentro del AppShell. */
export const ANCHO_VISTA_PRINCIPAL = "7xl" as const;

type AnchoVista = "4xl" | "5xl" | "6xl" | "7xl";

const ANCHOS: Record<AnchoVista, string> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

interface VistaContenedorProps {
  children: ReactNode;
  ancho?: AnchoVista;
  className?: string;
  contenidoClassName?: string;
}

/** Scroll y ancho máximo estándar para vistas dentro del AppShell. */
export function VistaContenedor({
  children,
  ancho = ANCHO_VISTA_PRINCIPAL,
  className,
  contenidoClassName,
}: VistaContenedorProps) {
  return (
    <div className={cn("h-full min-h-0 overflow-y-auto p-4 lg:p-6", className)}>
      <div className={cn("mx-auto w-full", ANCHOS[ancho], contenidoClassName)}>
        {children}
      </div>
    </div>
  );
}

interface MarcoVistaProps extends VistaContenedorProps {
  marcoClassName?: string;
  /** Ocupa la altura del viewport; el scroll queda en hijos con overflow-y-auto. */
  rellenarAltura?: boolean;
}

/** Marco visual compartido: la línea que delimita el contenido de la vista. */
export function MarcoVista({
  children,
  ancho = ANCHO_VISTA_PRINCIPAL,
  className,
  contenidoClassName,
  marcoClassName,
  rellenarAltura = false,
}: MarcoVistaProps) {
  return (
    <VistaContenedor
      ancho={ancho}
      className={className}
      contenidoClassName={cn(
        rellenarAltura && "flex h-full min-h-0 flex-col",
        contenidoClassName,
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-sm shadow-black/25",
          rellenarAltura && "flex min-h-0 flex-1 flex-col",
          marcoClassName,
        )}
      >
        {children}
      </div>
    </VistaContenedor>
  );
}
