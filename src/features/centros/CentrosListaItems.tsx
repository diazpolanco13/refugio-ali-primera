import { Badge } from "@/components/ui/badge";
import { MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  metaUnidadSebinCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  alertasCentro,
  analisisCentro,
  COLOR_SEMAFORO,
  type AlertaCentro,
} from "@/domain/capacidadCentros";
import { IconosAlerta } from "./IconosAlerta";

/** Estado precalculado de un centro para pintar su fila (semáforo + alertas). */
export interface EstadoFilaCentro {
  refugiados: number;
  semaforoColor: string | null;
  alertas: AlertaCentro[];
}

/** Quita acentos y baja a minúsculas para buscar sin exigir tildes exactas. */
export function normalizarTextoBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function calcularEstadosFilas(
  centros: CentroTransitorio[],
): Map<string, EstadoFilaCentro> {
  const m = new Map<string, EstadoFilaCentro>();
  for (const c of centros) {
    const analisis = analisisCentro(c);
    m.set(c.id, {
      refugiados: poblacionCentro(c),
      semaforoColor:
        analisis.semaforo === "sin_datos" ? null : COLOR_SEMAFORO[analisis.semaforo],
      alertas: alertasCentro(c),
    });
  }
  return m;
}

export const ESTADO_FILA_VACIO: EstadoFilaCentro = {
  refugiados: 0,
  semaforoColor: null,
  alertas: [],
};

/** Fila de un centro: nombre, población, semáforo y alertas. */
export function FilaCentroLista({
  centro,
  estado,
  seleccionado,
  mostrarUnidad,
  onSeleccionar,
}: {
  centro: CentroTransitorio;
  estado: EstadoFilaCentro;
  seleccionado: boolean;
  mostrarUnidad?: boolean;
  onSeleccionar: (centro: CentroTransitorio) => void;
}) {
  const sinGeom = !centro.geom;
  const metaUnidad = metaUnidadSebinCentro(centro);
  return (
    <button
      type="button"
      disabled={sinGeom}
      onClick={() => onSeleccionar(centro)}
      title={
        sinGeom ? "Sin coordenadas aún" : `Campamento N.° ${centro.nro} — ${centro.nombre}`
      }
      className={cn(
        "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
        sinGeom
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-muted/60 active:bg-muted",
        seleccionado && "bg-primary/10 ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        {sinGeom ? (
          <MapPinOff className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <Badge
            variant="outline"
            className="h-5 min-w-5 justify-center rounded-full px-1 text-[10px] font-bold tabular-nums"
            style={{
              borderColor: metaUnidad.color,
              color: metaUnidad.color,
              backgroundColor: `${metaUnidad.color}18`,
            }}
            aria-label={`Campamento N.° ${centro.nro}`}
          >
            {centro.nro}
          </Badge>
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px] leading-snug",
            seleccionado ? "font-semibold text-primary" : "text-foreground",
          )}
        >
          {centro.nombre}
        </span>
        {estado.semaforoColor && (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: estado.semaforoColor }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-0.5 flex items-center gap-2 pl-[26px] text-[10px] text-muted-foreground">
        <span className="min-w-0 truncate">
          {mostrarUnidad ? `${metaUnidad.label} · ` : ""}
          {estado.refugiados > 0
            ? `${estado.refugiados.toLocaleString("es")} pers.`
            : "sin ocupación"}
        </span>
        <IconosAlerta alertas={estado.alertas} />
      </div>
    </button>
  );
}
