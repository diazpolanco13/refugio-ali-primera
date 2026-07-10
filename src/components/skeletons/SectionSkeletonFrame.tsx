import type { ReactNode } from "react";
import {
  ANCHO_VISTA_PRINCIPAL,
  MarcoVista,
} from "@/components/VistaContenedor";
import { cn } from "@/lib/utils";

interface Props {
  children?: ReactNode;
  className?: string;
  /** Etiqueta accesible mientras carga (lectores de pantalla). */
  etiqueta?: string;
  /**
   * Envuelve el skeleton en el mismo marco que las vistas reales
   * (`max-w-7xl` + borde redondeado). Usar en listados/tablas/gestión.
   * Desactivar en mapa full-bleed o dashboard fuera del shell.
   */
  enMarco?: boolean;
  /** Clases del cuerpo interno (padding del contenido). */
  cuerpoClassName?: string;
}

/**
 * Contenedor de loading de sección dentro del shell.
 * Con `enMarco` replica la silueta de `VistaPagina` / `MarcoVista`.
 */
export function SectionSkeletonFrame({
  children,
  className,
  etiqueta = "Cargando sección",
  enMarco = false,
  cuerpoClassName,
}: Props) {
  const cuerpo = (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={etiqueta}
      className={cn(
        enMarco ? "flex min-h-0 flex-1 flex-col" : "flex h-full min-h-0 flex-col",
        cuerpoClassName,
        className,
      )}
    >
      <span className="sr-only">{etiqueta}…</span>
      {children}
    </div>
  );

  if (!enMarco) return cuerpo;

  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col"
    >
      {cuerpo}
    </MarcoVista>
  );
}
