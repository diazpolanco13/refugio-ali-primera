import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Paleta del recuadro de icono (misma lógica que Reportes diarios). */
export type AcentoVista =
  | "teal"
  | "rojo"
  | "primary"
  | "sky"
  | "violet"
  | "amber"
  | "emerald";

const ESTILOS_ACENTO: Record<
  AcentoVista,
  { borde: string; fondo: string; icono: string }
> = {
  teal: {
    borde: "border-teal-400/25",
    fondo: "bg-teal-400/10",
    icono: "text-teal-300",
  },
  rojo: {
    borde: "border-red-400/25",
    fondo: "bg-red-400/10",
    icono: "text-red-400",
  },
  primary: {
    borde: "border-primary/25",
    fondo: "bg-primary/10",
    icono: "text-primary",
  },
  sky: {
    borde: "border-sky-400/25",
    fondo: "bg-sky-400/10",
    icono: "text-sky-300",
  },
  violet: {
    borde: "border-violet-400/25",
    fondo: "bg-violet-400/10",
    icono: "text-violet-300",
  },
  amber: {
    borde: "border-amber-400/25",
    fondo: "bg-amber-400/10",
    icono: "text-amber-300",
  },
  emerald: {
    borde: "border-emerald-400/25",
    fondo: "bg-emerald-400/10",
    icono: "text-emerald-300",
  },
};

interface Props {
  icono: LucideIcon;
  titulo: string;
  descripcion?: string;
  acento?: AcentoVista;
  acciones?: ReactNode;
  debajo?: ReactNode;
  className?: string;
}

/** Encabezado unificado de vistas principales: icono + título + descripción. */
export function VistaEncabezado({
  icono: Icono,
  titulo,
  descripcion,
  acento = "primary",
  acciones,
  debajo,
  className,
}: Props) {
  const est = ESTILOS_ACENTO[acento];

  return (
    <header
      className={cn(
        "shrink-0 border-b border-border/70 px-4 pb-4 pt-4 lg:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base lg:text-lg">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                est.borde,
                est.fondo,
              )}
            >
              <Icono className={cn("size-4", est.icono)} />
            </span>
            <span className="min-w-0">{titulo}</span>
          </CardTitle>
          {descripcion ? (
            <CardDescription className="mt-1">{descripcion}</CardDescription>
          ) : null}
        </div>
        {acciones ? (
          <div className="flex flex-wrap items-center gap-1.5">{acciones}</div>
        ) : null}
      </div>
      {debajo ? <div className="mt-3">{debajo}</div> : null}
    </header>
  );
}
