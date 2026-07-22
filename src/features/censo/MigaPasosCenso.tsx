// Miga de pan de los pasos del registro por cédula: muestra el avance de la
// verificación (Cédula → Identidad → Hogar) y permite saltar a cualquier
// paso ya alcanzado. En móvil solo el paso actual lleva etiqueta; los demás
// quedan como círculos numerados para no desbordar.

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PasoCensoId = "cedula" | "identidad" | "hogar";

export interface PasoCenso {
  id: PasoCensoId;
  label: string;
  estado: "completado" | "actual" | "pendiente";
  /** Solo los pasos con sección visible en pantalla se pueden visitar. */
  disponible: boolean;
}

interface Props {
  pasos: PasoCenso[];
  onIr: (id: PasoCensoId) => void;
  className?: string;
}

export function MigaPasosCenso({ pasos, onIr, className }: Props) {
  return (
    <nav aria-label="Pasos del registro" className={cn("flex items-center", className)}>
      {pasos.map((p, i) => (
        <Fragment key={p.id}>
          {i > 0 ? (
            <div
              className={cn(
                "h-px min-w-2 flex-1",
                p.estado === "pendiente" ? "bg-border" : "bg-primary/50",
              )}
              aria-hidden
            />
          ) : null}
          <button
            type="button"
            disabled={!p.disponible}
            onClick={() => onIr(p.id)}
            aria-current={p.estado === "actual" ? "step" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-1 py-0.5 text-[11px] font-medium transition-opacity",
              p.estado === "pendiente" && "opacity-50",
              p.disponible ? "cursor-pointer hover:opacity-80" : "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
                p.estado === "actual" && "bg-primary text-primary-foreground",
                p.estado === "completado" &&
                  "border border-primary/40 bg-primary/15 text-primary",
                p.estado === "pendiente" &&
                  "border border-muted-foreground/40 text-muted-foreground",
              )}
            >
              {p.estado === "completado" ? <Check className="size-3" /> : i + 1}
            </span>
            <span
              className={cn(
                "whitespace-nowrap",
                p.estado === "actual"
                  ? "text-foreground"
                  : "hidden text-muted-foreground min-[480px]:inline",
              )}
            >
              {p.label}
            </span>
          </button>
        </Fragment>
      ))}
    </nav>
  );
}
