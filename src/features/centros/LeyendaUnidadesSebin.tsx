import { cn } from "@/lib/utils";
import {
  CATALOGO_UNIDADES_SEBIN,
  type ClaveUnidadSebin,
} from "@/domain/centrosTransitorios";

interface Props {
  unidadesPresentes: Set<ClaveUnidadSebin>;
  unidadSeleccionada: ClaveUnidadSebin | null;
  onSeleccionarUnidad: (clave: ClaveUnidadSebin | null) => void;
  className?: string;
}

/** Leyenda vertical clickeable: filtra marcadores por dirección SEBIN. */
export function LeyendaUnidadesSebin({
  unidadesPresentes,
  unidadSeleccionada,
  onSeleccionarUnidad,
  className,
}: Props) {
  const items = CATALOGO_UNIDADES_SEBIN.filter(
    (u) => u.clave !== "sin_asignar" && unidadesPresentes.has(u.clave),
  );

  if (items.length === 0) return null;

  function alternarUnidad(clave: ClaveUnidadSebin) {
    onSeleccionarUnidad(unidadSeleccionada === clave ? null : clave);
  }

  return (
    <div
      className={cn(
        "map-controls-overlay pointer-events-auto absolute bottom-3 left-3 z-10 w-[min(11.5rem,calc(100%-1.5rem))] rounded-xl border border-border bg-background/95 px-2.5 py-2 shadow-lg backdrop-blur-sm",
        className,
      )}
      aria-label="Leyenda de direcciones SEBIN"
    >
      <p className="mb-1.5 border-b border-border/60 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Direcciones SEBIN
      </p>
      <ul className="scrollbar-oculto max-h-[min(46vh,20rem)] space-y-0.5 overflow-y-auto">
        {items.map((u) => {
          const activa = unidadSeleccionada === u.clave;
          const atenuada = unidadSeleccionada != null && !activa;
          return (
            <li key={u.clave}>
              <button
                type="button"
                onClick={() => alternarUnidad(u.clave)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors",
                  activa
                    ? "bg-primary/15 font-semibold text-primary"
                    : "text-foreground hover:bg-muted/60",
                  atenuada && "opacity-45",
                )}
                aria-pressed={activa}
              >
                <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                  {activa && (
                    <span
                      className="marcador-latido-aura absolute size-3.5 rounded-full opacity-60"
                      style={{ backgroundColor: u.color }}
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "relative size-2.5 rounded-full border border-white/80",
                      activa && "ring-1 ring-white/50",
                    )}
                    style={{ backgroundColor: u.color }}
                  />
                </span>
                <span className="min-w-0 flex-1">{u.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {unidadSeleccionada && (
        <button
          type="button"
          onClick={() => onSeleccionarUnidad(null)}
          className="mt-1.5 w-full rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          Ver todas las direcciones
        </button>
      )}
    </div>
  );
}
