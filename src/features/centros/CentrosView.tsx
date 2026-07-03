import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  X,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PanelFlotante } from "@/components/PanelFlotante";
import { cn } from "@/lib/utils";
import { BASES_DISPONIBLES, type BaseMapa } from "@/map/estiloMapa";
import { db, sembrarCentrosSiVacio } from "@/data/db";
import {
  CATALOGO_CUERPOS,
  normalizarCuerpo,
  type CentroTransitorio,
  type ClaveCuerpo,
} from "@/domain/centrosTransitorios";
import type { Sesion } from "@/data/auth";
import { puedeEditarMapa } from "@/domain/permisos";
import { CentrosMap, type CentrosMapHandle } from "./CentrosMap";
import { DetalleCentro } from "./DetalleCentro";
import { CentroForm } from "./CentroForm";
import { TableroCentros } from "./TableroCentros";

interface Props {
  sesion: Sesion;
}

type Vista = "mapa" | "tablero";

/** Vista de conjunto: mapa/tablero de Caracas con los 50 Centros Transitorios. */
export function CentrosView({ sesion }: Props) {
  const puedeEditar = puedeEditarMapa(sesion.user.rol);
  const [vista, setVista] = useState<Vista>("mapa");
  const [baseMapa, setBaseMapa] = useState<BaseMapa>("calles");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [editando, setEditando] = useState<CentroTransitorio | null>(null);
  const [cuerposVisibles, setCuerposVisibles] = useState<Set<ClaveCuerpo>>(
    () => new Set(CATALOGO_CUERPOS.map((c) => c.clave)),
  );
  const [expandidos, setExpandidos] = useState<Set<ClaveCuerpo>>(() => new Set());
  const [panelAbierto, setPanelAbierto] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 640,
  );
  const [exportando, setExportando] = useState(false);
  const mapaRef = useRef<CentrosMapHandle>(null);

  // Los centros viven en Dexie (entidad sincronizable). Se siembran del catálogo
  // estático en instalaciones nuevas que no ejecutaron la migración v10.
  useEffect(() => {
    void sembrarCentrosSiVacio();
  }, []);
  const centros = useLiveQuery(
    () => db.centros.orderBy("nro").toArray(),
    [],
    [] as CentroTransitorio[],
  );

  async function exportarVista() {
    setExportando(true);
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      await mapaRef.current?.exportarImagen(`centros-transitorios-caracas-${fecha}.png`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar la imagen del mapa.");
    } finally {
      setExportando(false);
    }
  }

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

  const centrosVisibles = useMemo(
    () => centros.filter((c) => cuerposVisibles.has(normalizarCuerpo(c.cuerpo))),
    [centros, cuerposVisibles],
  );

  const centroSel = useMemo(
    () => centros.find((c) => c.id === seleccionado) ?? null,
    [centros, seleccionado],
  );

  function toggleCuerpo(clave: ClaveCuerpo) {
    setCuerposVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }

  function setExpandido(clave: ClaveCuerpo, abierto: boolean) {
    setExpandidos((prev) => {
      const s = new Set(prev);
      if (abierto) s.add(clave);
      else s.delete(clave);
      return s;
    });
  }

  function seleccionarCentro(centro: CentroTransitorio) {
    if (!centro.geom) return;
    const clave = normalizarCuerpo(centro.cuerpo);
    setCuerposVisibles((prev) => (prev.has(clave) ? prev : new Set(prev).add(clave)));
    setSeleccionado(centro.id);
  }

  useEffect(() => {
    if (!seleccionado) return;
    const centro = centros.find((c) => c.id === seleccionado);
    if (centro) setExpandido(normalizarCuerpo(centro.cuerpo), true);
  }, [seleccionado, centros]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link to="/">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Mapa</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-foreground lg:text-2xl">
              Centros Transitorios — Caracas
            </h1>
            <p className="truncate text-xs text-muted-foreground lg:text-sm">
              {centros.length} centros · red distribuida por el área metropolitana
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Conmutador Mapa / Tablero */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={vista === "mapa" ? "secondary" : "ghost"}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setVista("mapa")}
            >
              <MapIcon className="size-3.5" />
              <span className="hidden sm:inline">Mapa</span>
            </Button>
            <Button
              size="sm"
              variant={vista === "tablero" ? "secondary" : "ghost"}
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => setVista("tablero")}
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Prioridades</span>
            </Button>
          </div>

          {vista === "mapa" && (
            <>
              <div className="hidden items-center gap-1 sm:flex">
                {BASES_DISPONIBLES.map((b) => (
                  <Button
                    key={b.valor}
                    size="sm"
                    variant={baseMapa === b.valor ? "secondary" : "outline"}
                    className="h-8 px-2 text-xs"
                    onClick={() => setBaseMapa(b.valor)}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 px-2.5 text-xs"
                disabled={exportando}
                onClick={exportarVista}
                title="Exportar la vista actual del mapa como imagen (para imprimir)"
              >
                {exportando ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                <span className="hidden sm:inline">Exportar</span>
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {vista === "mapa" ? (
          <>
            <CentrosMap
              ref={mapaRef}
              centros={centrosVisibles}
              baseMapa={baseMapa}
              seleccionado={seleccionado}
              onSeleccionar={setSeleccionado}
            />

            {panelAbierto ? (
              <div className="absolute left-3 top-3 z-10 flex max-h-[min(34rem,75dvh)] w-[min(22rem,88vw)] flex-col overflow-hidden rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-2.5 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cuerpo asignado
                  </p>
                  <button
                    type="button"
                    onClick={() => setPanelAbierto(false)}
                    title="Ocultar panel"
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                  <div className="space-y-0.5">
                    {CATALOGO_CUERPOS.map((c) => {
                      const activo = cuerposVisibles.has(c.clave);
                      const centrosCuerpo = centrosPorCuerpo.get(c.clave) ?? [];
                      if (centrosCuerpo.length === 0) return null;
                      const abierto = expandidos.has(c.clave);
                      return (
                        <Collapsible
                          key={c.clave}
                          open={abierto}
                          onOpenChange={(o) => setExpandido(c.clave, o)}
                        >
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => toggleCuerpo(c.clave)}
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
                                    abierto && "rotate-180",
                                  )}
                                />
                              </button>
                            </CollapsibleTrigger>
                          </div>

                          <CollapsibleContent>
                            <div className="ml-3 mt-0.5 mb-1 space-y-0.5 border-l border-border/60 pl-2">
                              {centrosCuerpo.map((centro) => {
                                const sinGeom = !centro.geom;
                                return (
                                  <button
                                    key={centro.id}
                                    disabled={sinGeom}
                                    onClick={() => seleccionarCentro(centro)}
                                    title={
                                      sinGeom
                                        ? "Sin coordenadas aún"
                                        : `Centro N.° ${centro.nro} — ${centro.nombre}`
                                    }
                                    className={cn(
                                      "flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug transition-colors",
                                      sinGeom
                                        ? "cursor-not-allowed text-muted-foreground/60"
                                        : "text-foreground hover:bg-muted/60",
                                      seleccionado === centro.id && "bg-primary/10 text-primary",
                                    )}
                                  >
                                    {sinGeom ? (
                                      <MapPinOff className="mt-0.5 size-3 shrink-0" />
                                    ) : (
                                      <MapPin className="mt-0.5 size-3 shrink-0" />
                                    )}
                                    <span className="min-w-0">{centro.nombre}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>

                  {sinUbicar.length > 0 && (
                    <div className="mt-2 flex items-start gap-1.5 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
                      <MapPinOff className="mt-0.5 size-3 shrink-0" />
                      <span>{sinUbicar.length} centro(s) sin coordenadas aún.</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPanelAbierto(true)}
                title="Mostrar cuerpos asignados"
                className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-xl border border-border bg-card/95 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-muted/60"
              >
                <List className="size-3.5" />
                Cuerpos
              </button>
            )}
          </>
        ) : (
          <TableroCentros
            centros={centros}
            seleccionado={seleccionado}
            onSeleccionar={setSeleccionado}
          />
        )}

        {/* Panel de detalle del centro seleccionado */}
        {centroSel && (
          <PanelFlotante
            titulo={`N.° ${centroSel.nro} · ${centroSel.nombre}`}
            descripcion={centroSel.parroquia}
            onCerrar={() => setSeleccionado(null)}
          >
            <DetalleCentro
              centro={centroSel}
              puedeEditar={puedeEditar}
              onEditar={() => setEditando(centroSel)}
            />
          </PanelFlotante>
        )}
      </div>

      {/* Formulario de registro/edición */}
      {editando && (
        <CentroForm
          centro={editando}
          soloLectura={!puedeEditar}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
