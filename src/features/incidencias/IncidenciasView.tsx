// Vista global de incidencias de la red (`/incidencias`). Es una vista de
// **análisis** (solo lectura para todos los roles): el alta y la resolución de
// incidencias se hacen desde la ficha de cada centro. Ofrece:
//   · calendario de la red con punto de color = severidad máxima del día
//   · filtros por etiqueta, categoría, centro y estado
//   · contadores por categoría (clasificación global)
//   · lista ordenada por severidad (urgentes primero) y fecha descendente
// En escritorio: calendario + filtros a un lado y lista al otro; en móvil una
// sola columna.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FilterX, Siren } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useIncidencias } from "@/data/useIncidencias";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { useSupabaseConectado } from "@/data/useSupabaseConectado";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_INCIDENCIA,
  ETIQUETAS_INCIDENCIA,
  compararSeveridad,
  severidadMaximaPorDia,
  type CategoriaIncidencia,
  type EstadoIncidencia,
  type EtiquetaIncidencia,
} from "@/domain/incidencias";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarioIncidencias } from "./CalendarioIncidencias";
import { ListaIncidencias } from "./ListaIncidencias";

type FiltroEtiqueta = EtiquetaIncidencia | "todas";
type FiltroCategoria = CategoriaIncidencia | "todas";
type FiltroEstado = EstadoIncidencia | "todas";

/** Vista global de incidencias de la red de Centros Transitorios. */
export function IncidenciasView({ sesion: _sesion }: { sesion: Sesion }) {
  const conectado = useSupabaseConectado();

  // Todas las incidencias de la red (Realtime); los filtros se aplican en
  // cliente para que calendario, contadores y lista compartan una sola carga.
  const incidencias = useIncidencias();

  // Centros (blob+jsonb con Realtime), como en FichaCentroView: para el select
  // de filtro por centro y para resolver el nombre en cada fila de la lista.
  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const centrosPorId = useMemo(
    () => new Map<string, CentroTransitorio>(centros.map((c) => [c.id, c])),
    [centros],
  );

  // ---- Filtros ----
  const [etiqueta, setEtiqueta] = useState<FiltroEtiqueta>("todas");
  const [categoria, setCategoria] = useState<FiltroCategoria>("todas");
  const [centroId, setCentroId] = useState<string>("todos");
  const [estado, setEstado] = useState<FiltroEstado>("todas");
  const [dia, setDia] = useState<string | null>(null);

  const hayFiltros =
    etiqueta !== "todas" ||
    categoria !== "todas" ||
    centroId !== "todos" ||
    estado !== "todas" ||
    dia !== null;

  function limpiarFiltros() {
    setEtiqueta("todas");
    setCategoria("todas");
    setCentroId("todos");
    setEstado("todas");
    setDia(null);
  }

  // Base: filtros de etiqueta/centro/estado (compartidos por todo).
  const filtradasBase = useMemo(
    () =>
      incidencias.filter(
        (i) =>
          (etiqueta === "todas" || i.etiqueta === etiqueta) &&
          (centroId === "todos" || i.centro_id === centroId) &&
          (estado === "todas" || i.estado === estado),
      ),
    [incidencias, etiqueta, centroId, estado],
  );

  // Calendario: base + categoría (sin filtro de día, para ver todos los puntos).
  const paraCalendario = useMemo(
    () =>
      categoria === "todas"
        ? filtradasBase
        : filtradasBase.filter((i) => i.categorias.includes(categoria)),
    [filtradasBase, categoria],
  );
  const severidadPorDia = useMemo(
    () => severidadMaximaPorDia(paraCalendario),
    [paraCalendario],
  );

  // Contadores por categoría: base + día (sin filtro de categoría, para que
  // cada contador refleje el total real de su categoría en el rango visible).
  const paraContadores = useMemo(
    () => (dia ? filtradasBase.filter((i) => i.dia === dia) : filtradasBase),
    [filtradasBase, dia],
  );
  const conteoPorCategoria = useMemo(() => {
    const m = new Map<CategoriaIncidencia, number>();
    for (const inc of paraContadores) {
      for (const cat of inc.categorias) m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return m;
  }, [paraContadores]);

  // Lista: todos los filtros, ordenada por severidad y luego fecha desc.
  const visibles = useMemo(() => {
    const arr =
      categoria === "todas"
        ? paraContadores
        : paraContadores.filter((i) => i.categorias.includes(categoria));
    return [...arr].sort(
      (a, b) =>
        compararSeveridad(a.etiqueta, b.etiqueta) ||
        b.dia.localeCompare(a.dia) ||
        b.ts - a.ts,
    );
  }, [paraContadores, categoria]);

  const abiertasVisibles = visibles.filter((i) => i.estado === "abierta").length;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Cabecera (mismo patrón que DashboardView) */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link to="/">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Centros</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-lg font-bold leading-tight text-foreground lg:text-2xl">
              <Siren className="size-5 shrink-0 text-red-400" />
              Incidencias de la red
            </h1>
            <p className="truncate text-xs text-muted-foreground lg:text-sm">
              Registro global de los Centros Transitorios — análisis y seguimiento
            </p>
          </div>
        </div>
        <IndicadorConexion conectado={conectado} />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Columna lateral: calendario + filtros + contadores */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Calendario de la red</CardTitle>
                <CardDescription>
                  Punto de color = severidad máxima del día. Clic en un día para
                  filtrar la lista.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CalendarioIncidencias
                  severidadPorDia={severidadPorDia}
                  diaSeleccionado={dia}
                  onSeleccionarDia={setDia}
                />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  {ETIQUETAS_INCIDENCIA.map((e) => (
                    <span
                      key={e.valor}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground"
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: e.color }}
                      />
                      {e.label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CampoFiltro label="Etiqueta">
                  <Select
                    value={etiqueta}
                    onValueChange={(v) => setEtiqueta(v as FiltroEtiqueta)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {ETIQUETAS_INCIDENCIA.map((e) => (
                        <SelectItem key={e.valor} value={e.valor}>
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: e.color }}
                          />
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>

                <CampoFiltro label="Categoría">
                  <Select
                    value={categoria}
                    onValueChange={(v) => setCategoria(v as FiltroCategoria)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {CATEGORIAS_INCIDENCIA.map((c) => (
                        <SelectItem key={c.valor} value={c.valor}>
                          {c.icono} {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>

                <CampoFiltro label="Centro">
                  <Select value={centroId} onValueChange={setCentroId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="todos">Todos los centros</SelectItem>
                      {centros.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          N.° {c.nro} · {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CampoFiltro>

                <CampoFiltro label="Estado">
                  <Select
                    value={estado}
                    onValueChange={(v) => setEstado(v as FiltroEstado)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="abierta">Abiertas</SelectItem>
                      <SelectItem value="resuelta">Resueltas</SelectItem>
                    </SelectContent>
                  </Select>
                </CampoFiltro>

                {hayFiltros && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={limpiarFiltros}
                  >
                    <FilterX className="size-3.5" />
                    Limpiar filtros
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por categoría</CardTitle>
                <CardDescription>
                  Clasificación global en el rango visible
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-1.5">
                {CATEGORIAS_INCIDENCIA.map((c) => {
                  const n = conteoPorCategoria.get(c.valor) ?? 0;
                  const activa = categoria === c.valor;
                  return (
                    <button
                      key={c.valor}
                      type="button"
                      onClick={() => setCategoria(activa ? "todas" : c.valor)}
                      className={cn(
                        "flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                        activa
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-muted/40",
                        n === 0 && !activa && "opacity-50",
                      )}
                      title={`Filtrar por ${c.label}`}
                    >
                      <span className="truncate">
                        {c.icono} {c.label}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
                        {n}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Columna principal: lista de incidencias */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base lg:text-lg">
                      Incidencias
                      {dia && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          del {dia}
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Ordenadas por severidad (urgentes primero) y fecha
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="tabular-nums">
                      {visibles.length} visible(s)
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "tabular-nums",
                        abiertasVisibles > 0 && "border-amber-500/40 text-amber-400",
                      )}
                    >
                      {abiertasVisibles} abierta(s)
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ListaIncidencias incidencias={visibles} centrosPorId={centrosPorId} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function CampoFiltro({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function IndicadorConexion({ conectado }: { conectado: boolean }) {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online || !conectado) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Sin conexión
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-400" />
      En vivo
    </Badge>
  );
}
