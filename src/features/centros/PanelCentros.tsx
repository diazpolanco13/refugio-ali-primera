import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  MapPinOff,
  PanelLeftClose,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CATALOGO_CUERPOS,
  normalizarCuerpo,
  type CentroTransitorio,
  type ClaveCuerpo,
} from "@/domain/centrosTransitorios";
import {
  ESTADO_FILA_VACIO,
  FilaCentroLista,
  calcularEstadosFilas,
  normalizarTextoBusqueda,
} from "./CentrosListaItems";

interface Props {
  centros: CentroTransitorio[];
  cuerposVisibles: Set<ClaveCuerpo>;
  onToggleCuerpo: (clave: ClaveCuerpo) => void;
  expandidos: Set<ClaveCuerpo>;
  onSetExpandido: (clave: ClaveCuerpo, abierto: boolean) => void;
  seleccionado: string | null;
  onSeleccionarCentro: (centro: CentroTransitorio) => void;
  abierto: boolean;
  onCambiarAbierto: (abierto: boolean) => void;
}

/**
 * Panel lateral del mapa: búsqueda, listado por cuerpo, toggles de visibilidad
 * y semáforos. Cerrado por defecto; se abre desde ControlesMapaFlotantes.
 */
export function PanelCentros({
  centros,
  cuerposVisibles,
  onToggleCuerpo,
  expandidos,
  onSetExpandido,
  seleccionado,
  onSeleccionarCentro,
  abierto,
  onCambiarAbierto,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const estados = useMemo(() => calcularEstadosFilas(centros), [centros]);

  const centrosPorCuerpo = useMemo(() => {
    const m = new Map<ClaveCuerpo, CentroTransitorio[]>();
    for (const c of centros) {
      const clave = normalizarCuerpo(c.cuerpo);
      const lista = m.get(clave) ?? [];
      lista.push(c);
      m.set(clave, lista);
    }
    return m;
  }, [centros]);

  const sinUbicar = useMemo(() => centros.filter((c) => !c.geom), [centros]);

  const termino = normalizarTextoBusqueda(busqueda.trim());
  const resultados = useMemo(() => {
    if (!termino) return null;
    return centros.filter((c) =>
      normalizarTextoBusqueda(
        `${c.nombre} ${c.parroquia} ${c.direccion} ${c.cuerpo}`,
      ).includes(termino),
    );
  }, [centros, termino]);

  function elegirCentro(centro: CentroTransitorio) {
    onSeleccionarCentro(centro);
    if (window.innerWidth < 640) onCambiarAbierto(false);
  }

  return (
    <div
      className={cn(
        "absolute inset-y-0 left-0 z-10 flex w-[min(21rem,86vw)] flex-col border-r border-border bg-background/95 shadow-xl backdrop-blur-sm transition-transform duration-300",
        !abierto && "pointer-events-none -translate-x-full",
      )}
      aria-hidden={!abierto}
    >
      <div className="shrink-0 space-y-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lista de centros
          </p>
          <button
            type="button"
            onClick={() => onCambiarAbierto(false)}
            title="Plegar panel"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar centro, parroquia, dirección…"
            className="h-8 pl-8 pr-7 text-xs"
            aria-label="Buscar centro"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                inputRef.current?.focus();
              }}
              title="Limpiar búsqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {resultados ? (
          <div className="space-y-0.5">
            <p className="px-2 pb-1 text-[10px] text-muted-foreground">
              {resultados.length === 0
                ? "Sin coincidencias."
                : `${resultados.length} centro(s) encontrado(s)`}
            </p>
            {resultados.map((centro) => (
              <FilaCentroLista
                key={centro.id}
                centro={centro}
                estado={estados.get(centro.id) ?? ESTADO_FILA_VACIO}
                seleccionado={seleccionado === centro.id}
                mostrarCuerpo
                onSeleccionar={elegirCentro}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {CATALOGO_CUERPOS.map((c) => {
              const activo = cuerposVisibles.has(c.clave);
              const centrosCuerpo = centrosPorCuerpo.get(c.clave) ?? [];
              if (centrosCuerpo.length === 0) return null;
              const grupoAbierto = expandidos.has(c.clave);
              const alertasGrupo = centrosCuerpo.reduce(
                (n, centro) =>
                  n + ((estados.get(centro.id)?.alertas.length ?? 0) > 0 ? 1 : 0),
                0,
              );
              return (
                <Collapsible
                  key={c.clave}
                  open={grupoAbierto}
                  onOpenChange={(o) => onSetExpandido(c.clave, o)}
                >
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => onToggleCuerpo(c.clave)}
                      title="Mostrar/ocultar en el mapa"
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted/60",
                        !activo && "opacity-40",
                      )}
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-white text-[11px]"
                        style={{ borderColor: c.color }}
                        aria-hidden
                      >
                        {c.logo ? (
                          <img src={c.logo} alt="" className="size-full object-cover" />
                        ) : (
                          c.icono
                        )}
                      </span>
                      <span className="flex-1 truncate text-foreground">{c.label}</span>
                      {alertasGrupo > 0 && (
                        <span
                          title={`${alertasGrupo} centro(s) con servicios en déficit`}
                          className="flex size-4 items-center justify-center rounded-full bg-red-500/15 text-[9px] font-bold text-red-500"
                        >
                          {alertasGrupo}
                        </span>
                      )}
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {centrosCuerpo.length}
                      </Badge>
                    </button>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        title="Ver centros asignados"
                        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        <ChevronDown
                          className={cn(
                            "size-3.5 transition-transform",
                            grupoAbierto && "rotate-180",
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="ml-3 mb-1 mt-0.5 space-y-0.5 border-l border-border pl-2">
                      {centrosCuerpo.map((centro) => (
                        <FilaCentroLista
                          key={centro.id}
                          centro={centro}
                          estado={estados.get(centro.id) ?? ESTADO_FILA_VACIO}
                          seleccionado={seleccionado === centro.id}
                          onSeleccionar={elegirCentro}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {sinUbicar.length > 0 && (
              <div className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-[10px] text-muted-foreground">
                <MapPinOff className="mt-0.5 size-3 shrink-0" />
                <span>{sinUbicar.length} centro(s) sin coordenadas aún.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-3 py-1.5 text-[9.5px] leading-snug text-muted-foreground/80">
        Íconos <span className="font-semibold text-red-500">rojos</span> /{" "}
        <span className="font-semibold text-amber-400">ámbar</span>: servicios en
        déficit según el estándar Esfera (camas, baños, duchas, lavaderos, basura, agua).
      </div>
    </div>
  );
}

/** Estados precalculados exportados para ControlesMapaFlotantes. */
export { calcularEstadosFilas };
