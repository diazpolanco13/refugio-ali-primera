import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado, type AcentoVista } from "@/components/VistaEncabezado";
import { cn } from "@/lib/utils";

interface Props {
  icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  acento?: AcentoVista;
  acciones?: ReactNode;
  encabezadoDebajo?: ReactNode;
  className?: string;
  marcoClassName?: string;
  cuerpoClassName?: string;
  pie?: ReactNode;
  pieClassName?: string;
  scrollCuerpo?: boolean;
  children: ReactNode;
}

/** Shell estándar: marco + encabezado con icono + cuerpo scrollable. */
export function VistaPagina({
  icono,
  titulo,
  descripcion,
  acento,
  acciones,
  encabezadoDebajo,
  className,
  marcoClassName,
  cuerpoClassName,
  pie,
  pieClassName,
  scrollCuerpo = true,
  children,
}: Props) {
  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className={cn("overflow-hidden", className)}
      marcoClassName={cn("flex min-h-0 flex-col", marcoClassName)}
    >
      <VistaEncabezado
        icono={icono}
        titulo={titulo}
        descripcion={descripcion}
        acento={acento}
        acciones={acciones}
        debajo={encabezadoDebajo}
      />
      <div
        className={cn(
          scrollCuerpo && "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          cuerpoClassName,
        )}
      >
        {children}
      </div>
      {pie ? (
        <footer
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            pieClassName,
          )}
        >
          {pie}
        </footer>
      ) : null}
    </MarcoVista>
  );
}
