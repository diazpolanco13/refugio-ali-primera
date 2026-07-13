import type { LucideIcon } from "lucide-react";
import { Check, CheckCircle2, ClipboardCheck, Loader2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AcentoBloqueReporte = "teal" | "sky" | "amber" | "violet" | "rose";

const ESTILOS_ACENTO: Record<
  AcentoBloqueReporte,
  { borde: string; fondo: string; icono: string }
> = {
  teal: {
    borde: "border-teal-500/35 bg-teal-500/5",
    fondo: "border-teal-500/35 bg-teal-500/5",
    icono: "text-teal-400",
  },
  sky: {
    borde: "border-sky-500/35 bg-sky-500/5",
    fondo: "border-sky-500/35 bg-sky-500/5",
    icono: "text-sky-400",
  },
  amber: {
    borde: "border-amber-500/35 bg-amber-500/5",
    fondo: "border-amber-500/35 bg-amber-500/5",
    icono: "text-amber-400",
  },
  violet: {
    borde: "border-violet-500/35 bg-violet-500/5",
    fondo: "border-violet-500/35 bg-violet-500/5",
    icono: "text-violet-400",
  },
  rose: {
    borde: "border-rose-500/35 bg-rose-500/5",
    fondo: "border-rose-500/35 bg-rose-500/5",
    icono: "text-rose-400",
  },
};

interface Props {
  titulo: string;
  tituloRevisado?: string;
  descripcion: string;
  icono: LucideIcon;
  acento?: AcentoBloqueReporte;
  revisado: boolean;
  modificado: boolean;
  guardando?: boolean;
  deshabilitado?: boolean;
  onConfirmar: () => void;
  onDesmarcar?: () => void;
  /** Texto del botón cuando hay cambios sin guardar. */
  etiquetaGuardar?: string;
  /** Texto cuando no hay cambios y aún no está revisado. */
  etiquetaConfirmar?: string;
  /** Texto cuando ya está revisado y no hay cambios pendientes. */
  etiquetaActualizar?: string;
  badgeExtra?: React.ReactNode;
  className?: string;
  /** Bloquea el botón principal (p. ej. formulario de ítem sin guardar). */
  confirmacionBloqueada?: boolean;
  mensajeConfirmacionBloqueada?: string;
}

export function BloqueConfirmacionReporte({
  titulo,
  tituloRevisado,
  descripcion,
  icono: Icono,
  acento = "teal",
  revisado,
  modificado,
  guardando,
  deshabilitado,
  onConfirmar,
  onDesmarcar,
  etiquetaGuardar = "Guardar cambios",
  etiquetaConfirmar = "Confirmar sin cambios",
  etiquetaActualizar = "Actualizar revisión",
  badgeExtra,
  className,
  confirmacionBloqueada,
  mensajeConfirmacionBloqueada,
}: Props) {
  const estilos = ESTILOS_ACENTO[acento];
  const tituloMostrado = revisado && !modificado ? (tituloRevisado ?? titulo) : titulo;

  const textoBoton = modificado
    ? etiquetaGuardar
    : revisado
      ? etiquetaActualizar
      : etiquetaConfirmar;

  const textoBadge = revisado && !modificado ? "Revisado" : modificado ? "Con cambios" : "Pendiente";
  const botonDeshabilitado = deshabilitado || guardando || confirmacionBloqueada;
  const mostrarDesmarcar = Boolean(revisado && !modificado && onDesmarcar);

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 sm:py-3",
        revisado && !modificado
          ? "border-emerald-500/35 bg-emerald-500/5"
          : modificado
            ? "border-amber-500/30 bg-amber-500/5"
            : estilos.fondo,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold leading-snug">
            {revisado && !modificado ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            ) : (
              <Icono className={cn("size-4 shrink-0", estilos.icono)} />
            )}
            <span className="min-w-0 truncate">{tituloMostrado}</span>
          </p>
          <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {descripcion}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {badgeExtra}
          <Badge
            variant="outline"
            className="w-fit shrink-0 gap-1 px-1.5 py-0.5 text-[10px] tabular-nums"
          >
            {revisado && !modificado ? <Check className="size-3 text-emerald-400" /> : null}
            {textoBadge}
          </Badge>
        </div>
      </div>
      {confirmacionBloqueada && mensajeConfirmacionBloqueada ? (
        <p className="mt-2 text-xs leading-snug text-amber-400/95">{mensajeConfirmacionBloqueada}</p>
      ) : null}
      <div
        className={cn(
          "flex gap-2",
          confirmacionBloqueada && mensajeConfirmacionBloqueada ? "mt-2" : "mt-2.5",
        )}
      >
        <Button
          type="button"
          size="sm"
          className={cn(
            "h-9 min-w-0 bg-teal-600 font-semibold text-white shadow-sm hover:bg-teal-500",
            mostrarDesmarcar ? "flex-1 sm:flex-none" : "w-full sm:w-auto",
          )}
          disabled={botonDeshabilitado}
          onClick={onConfirmar}
        >
          {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          <span className="truncate">{textoBoton}</span>
        </Button>
        {mostrarDesmarcar ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 min-w-0 flex-1 sm:flex-none"
            disabled={botonDeshabilitado}
            onClick={onDesmarcar}
          >
            <Undo2 className="size-3.5" />
            <span className="truncate sm:hidden">Desmarcar</span>
            <span className="hidden truncate sm:inline">Desmarcar revisión</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Icono por defecto cuando el bloque aún no está revisado. */
export { ClipboardCheck };
