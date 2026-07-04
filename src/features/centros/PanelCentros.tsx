import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  MapPin,
  MapPinOff,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  CATALOGO_CUERPOS,
  metaCuerpoDe,
  normalizarCuerpo,
  poblacionCentro,
  type CentroTransitorio,
  type ClaveCuerpo,
} from "@/domain/centrosTransitorios";
import {
  alertasCentro,
  analisisCentro,
  COLOR_SEMAFORO,
  type AlertaCentro,
} from "@/domain/capacidadCentros";
import { IconosAlerta } from "./IconosAlerta";

/** Estado precalculado de un centro para pintar su fila (semáforo + alertas). */
interface EstadoFila {
  refugiados: number;
  semaforoColor: string | null;
  alertas: AlertaCentro[];
}

/** Quita acentos y baja a minúsculas para buscar sin exigir tildes exactas. */
function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Fila de un centro dentro del panel: nombre, población, semáforo y alertas. */
function FilaCentro({
  centro,
  estado,
  seleccionado,
  mostrarCuerpo,
  onSeleccionar,
}: {
  centro: CentroTransitorio;
  estado: EstadoFila;
  seleccionado: boolean;
  /** Mostrar logo del cuerpo y parroquia (para resultados de búsqueda). */
  mostrarCuerpo?: boolean;
  onSeleccionar: (centro: CentroTransitorio) => void;
}) {
  const sinGeom = !centro.geom;
  const meta = mostrarCuerpo ? metaCuerpoDe(centro.cuerpo) : null;
  return (
    <button
      type="button"
      disabled={sinGeom}
      onClick={() => onSeleccionar(centro)}
      title={
        sinGeom ? "Sin coordenadas aún" : `Centro N.° ${centro.nro} — ${centro.nombre}`
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
        {meta ? (
          <span
            className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white text-[10px]"
            style={{ borderColor: meta.color }}
            aria-hidden
          >
            {meta.logo ? (
              <img src={meta.logo} alt="" className="size-full object-cover" />
            ) : (
              meta.icono
            )}
          </span>
        ) : sinGeom ? (
          <MapPinOff className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <MapPin className="size-3 shrink-0 text-muted-foreground" />
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
          {mostrarCuerpo && centro.parroquia ? `${centro.parroquia} · ` : ""}
          {estado.refugiados > 0
            ? `${estado.refugiados.toLocaleString("es")} pers.`
            : "sin ocupación"}
        </span>
        <IconosAlerta alertas={estado.alertas} />
      </div>
    </button>
  );
}

/** 
 * Buscador compacto integrado al lado de los botones de control (panel plegado).
 * No abre el panel lateral: solo busca y, al elegir, vuela al centro y abre la
 * nube informativa. Se ancla a la derecha de la columna de botones (top-left) y
 * se cierra al pinchar fuera o al limpiar+cerrar.
 */
function BuscadorCompacto({
  centros,
  estados,
  seleccionado,
  onSeleccionar,
}: {
  centros: CentroTransitorio[];
  estados: Map<string, EstadoFila>;
  seleccionado: string | null;
  onSeleccionar: (centro: CentroTransitorio) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const estadoVacio: EstadoFila = { refugiados: 0, semaforoColor: null, alertas: [] };

  // Cerrar al pinchar fuera del contenedor del buscador.
  useEffect(() => {
    if (!abierto) return;
    function alClick(e: MouseEvent) {
      if (!contenedorRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClick);
    return () => document.removeEventListener("mousedown", alClick);
  }, [abierto]);

  const termino = normalizarTexto(busqueda.trim());
  const resultados = useMemo(() => {
    if (!termino) return [];
    return centros
      .filter((c) =>
        normalizarTexto(`${c.nombre} ${c.parroquia} ${c.direccion} ${c.cuerpo}`).includes(
          termino,
        ),
      )
      .slice(0, 30);
  }, [centros, termino]);

  return (
    <div ref={contenedorRef} className="contents">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              "h-10 w-10 min-w-10 shrink-0 border-0 shadow-none hover:bg-muted/80",
              abierto ? "bg-primary/15 text-primary" : "bg-card text-foreground",
            )}
            onClick={() => {
              setAbierto((v) => !v);
              if (!abierto) requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label="Buscar un centro"
            aria-expanded={abierto}
          >
            <Search className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Buscar un centro
        </TooltipContent>
      </Tooltip>

      {abierto && (
        <div
          className="absolute left-[3.25rem] top-0 z-30 flex max-h-[min(20rem,70dvh)] w-[min(18rem,calc(86vw-3.25rem))] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-sm"
          role="dialog"
          aria-label="Búsqueda de centros"
        >
          <div className="shrink-0 border-b border-border/60 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar centro, parroquia…"
                className="h-8 pl-8 pr-7 text-xs"
                aria-label="Buscar centro"
              />
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
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {!termino ? (
              <p className="px-2 py-2 text-[10px] text-muted-foreground">
                Escribe para buscar entre los {centros.length} centros.
              </p>
            ) : resultados.length === 0 ? (
              <p className="px-2 py-2 text-[10px] text-muted-foreground">
                Sin coincidencias.
              </p>
            ) : (
              <div className="space-y-0.5">
                {resultados.map((centro) => (
                  <FilaCentro
                    key={centro.id}
                    centro={centro}
                    estado={estados.get(centro.id) ?? estadoVacio}
                    seleccionado={seleccionado === centro.id}
                    mostrarCuerpo
                    onSeleccionar={(c) => {
                      onSeleccionar(c);
                      setAbierto(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  /** Abrir el formulario de alta de un centro nuevo (solo roles con edición). */
  onNuevoCentro?: () => void;
}

/**
 * Panel lateral plegable de la red de centros: búsqueda (nombre, parroquia,
 * dirección), listado agrupado por cuerpo asignado con visibilidad en el mapa,
 * y por centro: población, semáforo de ocupación e íconos de alerta por
 * servicio en déficit (Esfera). Al elegir un centro, el mapa vuela hacia él.
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
  onNuevoCentro,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const estados = useMemo(() => {
    const m = new Map<string, EstadoFila>();
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
  }, [centros]);

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

  const termino = normalizarTexto(busqueda.trim());
  const resultados = useMemo(() => {
    if (!termino) return null;
    return centros.filter((c) =>
      normalizarTexto(`${c.nombre} ${c.parroquia} ${c.direccion} ${c.cuerpo}`).includes(
        termino,
      ),
    );
  }, [centros, termino]);

  function elegirCentro(centro: CentroTransitorio) {
    onSeleccionarCentro(centro);
    // En pantallas chicas el panel tapa el mapa: al elegir, se pliega solo.
    if (window.innerWidth < 640) onCambiarAbierto(false);
  }

  const estadoVacio: EstadoFila = { refugiados: 0, semaforoColor: null, alertas: [] };

  return (
    <>
      {/* Controles flotantes cuando el panel está plegado (mismo estilo que los del mapa) */}
      {!abierto && (
        <TooltipProvider delayDuration={200}>
          <div className="map-controls-overlay pointer-events-none absolute left-3 top-3 z-10">
            <ButtonGroup
              orientation="vertical"
              className="pointer-events-auto w-10 min-w-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-foreground shadow-none hover:bg-muted/80"
                    onClick={() => onCambiarAbierto(true)}
                    aria-label="Lista de centros"
                  >
                    <PanelLeftOpen className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Lista de centros
                </TooltipContent>
              </Tooltip>
              <BuscadorCompacto
                centros={centros}
                estados={estados}
                seleccionado={seleccionado}
                onSeleccionar={onSeleccionarCentro}
              />
              {onNuevoCentro && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 min-w-10 shrink-0 border-0 bg-card text-foreground shadow-none hover:bg-muted/80"
                      onClick={onNuevoCentro}
                      aria-label="Nuevo centro"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Registrar centro nuevo
                  </TooltipContent>
                </Tooltip>
              )}
            </ButtonGroup>
          </div>
        </TooltipProvider>
      )}

      {/* Panel lateral */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 z-10 flex w-[min(21rem,86vw)] flex-col border-r border-border bg-card/95 shadow-xl backdrop-blur-sm transition-transform duration-300",
          !abierto && "pointer-events-none -translate-x-full",
        )}
        aria-hidden={!abierto}
      >
        <div className="shrink-0 space-y-2 border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Centros transitorios
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

          {onNuevoCentro && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={onNuevoCentro}
            >
              <Plus className="size-3.5" />
              Registrar centro nuevo
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {resultados ? (
            // Modo búsqueda: lista plana de coincidencias
            <div className="space-y-0.5">
              <p className="px-2 pb-1 text-[10px] text-muted-foreground">
                {resultados.length === 0
                  ? "Sin coincidencias."
                  : `${resultados.length} centro(s) encontrado(s)`}
              </p>
              {resultados.map((centro) => (
                <FilaCentro
                  key={centro.id}
                  centro={centro}
                  estado={estados.get(centro.id) ?? estadoVacio}
                  seleccionado={seleccionado === centro.id}
                  mostrarCuerpo
                  onSeleccionar={elegirCentro}
                />
              ))}
            </div>
          ) : (
            // Modo normal: agrupado por cuerpo asignado
            <div className="space-y-0.5">
              {CATALOGO_CUERPOS.map((c) => {
                const activo = cuerposVisibles.has(c.clave);
                const centrosCuerpo = centrosPorCuerpo.get(c.clave) ?? [];
                if (centrosCuerpo.length === 0) return null;
                const grupoAbierto = expandidos.has(c.clave);
                const alertasGrupo = centrosCuerpo.reduce(
                  (n, centro) => n + ((estados.get(centro.id)?.alertas.length ?? 0) > 0 ? 1 : 0),
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
                      <div className="ml-3 mb-1 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                        {centrosCuerpo.map((centro) => (
                          <FilaCentro
                            key={centro.id}
                            centro={centro}
                            estado={estados.get(centro.id) ?? estadoVacio}
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
                <div className="mt-2 flex items-start gap-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                  <MapPinOff className="mt-0.5 size-3 shrink-0" />
                  <span>{sinUbicar.length} centro(s) sin coordenadas aún.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/60 px-3 py-1.5 text-[9.5px] leading-snug text-muted-foreground/80">
          Íconos <span className="font-semibold text-red-500">rojos</span> /{" "}
          <span className="font-semibold text-amber-400">ámbar</span>: servicios en
          déficit según el estándar Esfera (camas, baños, duchas, lavaderos, basura, agua).
        </div>
      </div>
    </>
  );
}
