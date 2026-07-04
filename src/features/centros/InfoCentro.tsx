import { ExternalLink } from "lucide-react";
import { metaCuerpoDe, poblacionCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import { alertasCentro, analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { IconosAlerta } from "./IconosAlerta";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  className?: string;
  /** Abrir el panel de detalle completo del centro. */
  onAbrirDetalle?: () => void;
}

/** Ficha básica de un centro transitorio: cuerpo asignado, ubicación y estado. */
export function InfoCentro({ centro, className, onAbrirDetalle }: Props) {
  const meta = metaCuerpoDe(centro.cuerpo);
  const analisis = analisisCentro(centro);
  const alertas = alertasCentro(centro);
  const refugiados = poblacionCentro(centro);
  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];

  return (
    <div className={cn("min-w-[220px] max-w-[280px] space-y-2 text-left", className)}>
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Centro N.° {centro.nro} · {centro.grupo}
        </p>
        <p className="font-semibold leading-snug text-foreground">{centro.nombre}</p>
      </div>

      <div
        className="inline-flex items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-2.5"
        style={{ borderColor: meta.color }}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"
          aria-hidden
        >
          {meta.logo ? (
            <img src={meta.logo} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-sm leading-none">{meta.icono}</span>
          )}
        </span>
        <span className="text-xs font-semibold text-foreground">{meta.label}</span>
      </div>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p>{centro.parroquia}</p>
        {centro.direccion && <p className="leading-snug">{centro.direccion}</p>}
      </div>

      {centro.mapsUrl && (
        <a
          href={centro.mapsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(ev) => ev.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Abrir en Google Maps
          <ExternalLink className="size-3" />
        </a>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1.5 text-[11px]">
        <span className="text-muted-foreground">
          {refugiados > 0
            ? `${refugiados.toLocaleString("es")} refugiados`
            : "Sin ocupación registrada"}
          {analisis.personal > 0 && (
            <> · {analisis.personal.toLocaleString("es")} personal</>
          )}
        </span>
        <span className="font-semibold" style={{ color: colorSemaforo }}>
          {analisis.cupoReal != null ? `Cupo: +${analisis.cupoReal.toLocaleString("es")}` : "Sin datos"}
        </span>
      </div>
      {alertas.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>En déficit:</span>
          <IconosAlerta alertas={alertas} />
        </div>
      )}
      {onAbrirDetalle && (
        <button
          type="button"
          onClick={onAbrirDetalle}
          className="w-full rounded-md bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ver detalle completo
        </button>
      )}
    </div>
  );
}
