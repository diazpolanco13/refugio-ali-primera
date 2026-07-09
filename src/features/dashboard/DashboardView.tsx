// Sala situacional 24/7 (proyectable en pantalla ultrawide, SIN scroll en
// escritorio): mapa de la red a la izquierda (25%) y métricas en vivo a la
// derecha (75%). Todo se refresca solo vía Realtime. En pantallas pequeñas
// (< xl) degrada a una columna con scroll normal.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  DoorOpen,
  HeartPulse,
  Home,
  PawPrint,
  Users,
  Utensils,
} from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { claveDia } from "@/data/reposSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { aplicarPartesActualesACentros } from "@/domain/parteActualCentros";
import { contarAtenciones, racionesDelDia } from "@/domain/reporteDiario";
import { poblacionCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  conteoPorNivel,
  demografiaRed,
  ETIQUETA_NIVEL,
  kpisRedCentros,
  topPrioridadCentros,
} from "@/domain/redCentros";
import {
  casosSaludPendientes,
  totalCasosSaludActivosRed,
} from "@/domain/seguimientoReportes";
import { COLOR_NIVEL, ORDEN_NIVELES } from "@/domain/prioridadCentros";
import type { Sesion } from "@/data/authSupabase";
import { useSupabaseConectado } from "@/data/useSupabaseConectado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GraficoOcupacionRed } from "./GraficoOcupacionRed";
import { MapaRedSala } from "./MapaRedSala";
import { NovedadesEnVivo } from "./NovedadesEnVivo";

type CentroFila = CentroTransitorio & { deleted: boolean };

function Reloj() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fecha = ahora.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hora = ahora.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <div className="text-right">
      <div className="text-2xl font-bold tabular-nums text-foreground lg:text-3xl">
        {hora}
      </div>
      <div className="text-xs capitalize text-muted-foreground lg:text-sm">{fecha}</div>
    </div>
  );
}

/** Sala situacional proyectable: red agregada de Campamentos Transitorios. */
export function DashboardView({ sesion: _sesion }: { sesion: Sesion }) {
  const navegar = useNavigate();
  const conectado = useSupabaseConectado();

  // Centros con geom + último parte diario aplicado (misma base que el mapa
  // de /centros): así los KPIs reflejan el parte más reciente, no el blob viejo.
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const snapshots = useOcupacionesCentros();
  const centros = useMemo(
    () =>
      aplicarPartesActualesACentros(
        [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
        snapshots,
      ),
    [filasCentros, snapshots],
  );

  const kpis = useMemo(() => kpisRedCentros(centros), [centros]);
  const demografia = useMemo(() => demografiaRed(centros), [centros]);
  const conteoNivel = useMemo(() => conteoPorNivel(centros), [centros]);
  const prioridades = useMemo(() => topPrioridadCentros(centros, 8), [centros]);
  const ocupados = useMemo(
    () => centros.filter((c) => poblacionCentro(c) > 0).length,
    [centros],
  );
  const desocupados = kpis.centrosTotal - ocupados;

  const nombresCentros = useMemo(
    () =>
      new Map(
        centros.map((c) => [c.id, `N.° ${c.nro ?? "?"} · ${c.nombre}`] as const),
      ),
    [centros],
  );

  // Casos de salud en seguimiento en toda la red (Realtime).
  const { casos: casosSalud } = useCasosSaludCentros({ soloActivos: true });
  const casosPendientes = useMemo(() => casosSaludPendientes(casosSalud), [casosSalud]);
  const casosActivos = useMemo(
    () => totalCasosSaludActivosRed(casosSalud),
    [casosSalud],
  );
  const casosEnProceso = useMemo(
    () => casosSalud.filter((c) => c.estatus === "en_proceso").length,
    [casosSalud],
  );

  // Reporte diario de HOY: raciones, atenciones médicas y novedades (eventos).
  const hoy = claveDia(Date.now());
  const reportesHoy = useReportesCentros({ dia: hoy });
  const { eventos: eventosHoy } = useEventosReportes({ dia: hoy });
  const racionesHoy = useMemo(
    () => reportesHoy.reduce((acc, r) => acc + racionesDelDia(r), 0),
    [reportesHoy],
  );
  const atencionesHoy = useMemo(
    () =>
      reportesHoy.reduce(
        (acc, r) =>
          acc + contarAtenciones(r.atenciones_medicas_detalle, r.atenciones_medicas),
        0,
      ),
    [reportesHoy],
  );
  const eventosPositivos = useMemo(
    () => eventosHoy.filter((e) => e.tipo === "positivo").length,
    [eventosHoy],
  );
  const eventosNegativos = eventosHoy.length - eventosPositivos;

  // Campamentos con novedad: caso de salud pendiente o evento negativo hoy.
  const centrosConNovedad = useMemo(() => {
    const ids = new Set<string>();
    for (const c of casosPendientes) ids.add(c.centro_id);
    for (const e of eventosHoy) if (e.tipo === "negativo") ids.add(e.centro_id);
    return ids.size;
  }, [casosPendientes, eventosHoy]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link to="/centros/mapa">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Campamentos</span>
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-foreground lg:text-2xl">
              Campamentos Transitorios
            </h1>
            <p className="truncate text-xs text-muted-foreground lg:text-sm">
              Área Metropolitana de Caracas · Sala situacional
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <IndicadorConexion conectado={conectado} />
          <Reloj />
        </div>
      </header>

      {/* Cuerpo: en xl+ ocupa exactamente el alto restante SIN scroll.
          Mapa = 1/4 del ancho, métricas = 3/4. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 xl:overflow-hidden lg:p-4">
        <div className="grid h-full grid-cols-1 gap-3 xl:grid-cols-4">
          <div className="h-[320px] min-h-0 xl:h-full">
            <MapaRedSala
              centros={centros}
              onAbrirCentro={(id) => navegar(`/centro/${id}`)}
            />
          </div>

          <div className="flex min-h-0 flex-col gap-3 xl:col-span-3">
            {/* Fila 1: 12 KPIs en vivo (6 × 2 en ultrawide). */}
            <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <KpiSala
                label="Damnificados"
                valor={kpis.refugiadosTotal}
                icono={<Users className="size-4" />}
                acento="text-sky-300"
              />
              <KpiSala
                label="Familias"
                valor={kpis.familiasTotal}
                icono={<Home className="size-4" />}
              />
              <KpiSala
                label="Mascotas"
                valor={demografia.mascotas}
                icono={<PawPrint className="size-4" />}
                acento="text-amber-200"
              />
              <KpiSala
                label="Personal operativo"
                valor={kpis.personalTotal}
                acento="text-violet-300"
              />
              <KpiSala
                label="Campamentos ocupados"
                valor={ocupados}
                sub={`de ${kpis.centrosTotal} · ${desocupados} vacíos`}
                icono={<Building2 className="size-4" />}
              />
              <KpiSala
                label="Cupo disponible"
                valor={kpis.cupoDisponible}
                sub="plazas en la red"
                icono={<DoorOpen className="size-4" />}
                acento="text-emerald-300"
              />
              <KpiSala
                label="Campamentos críticos"
                valor={kpis.centrosCriticos}
                sub="nivel crítico o alto"
                icono={<AlertTriangle className="size-4" />}
                acento={kpis.centrosCriticos > 0 ? "text-red-300" : "text-emerald-300"}
              />
              <KpiSala
                label="Salud activa"
                valor={casosActivos}
                sub={
                  casosEnProceso > 0
                    ? `${casosEnProceso} en proceso`
                    : "casos del reporte"
                }
                icono={<HeartPulse className="size-4" />}
                acento={casosActivos > 0 ? "text-rose-300" : "text-emerald-300"}
              />
              <KpiSala
                label="Atenciones hoy"
                valor={atencionesHoy}
                sub="atenciones médicas"
                icono={<Activity className="size-4" />}
              />
              <KpiSala
                label="Con novedad"
                valor={centrosConNovedad}
                sub="campamentos con seguimiento"
                acento={centrosConNovedad > 0 ? "text-amber-300" : "text-emerald-300"}
              />
              <KpiEventosHoy positivos={eventosPositivos} negativos={eventosNegativos} />
              <KpiSala
                label="Raciones hoy"
                valor={racionesHoy}
                sub={`de ${kpis.refugiadosTotal.toLocaleString("es")} damnificados`}
                icono={<Utensils className="size-4" />}
                acento="text-orange-300"
              />
            </div>

            {/* Fila 2 (flexible): histórico + novedades en vivo + estado de la red. */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-12">
              <Card className="flex min-h-[260px] flex-col gap-2 py-4 xl:col-span-6 xl:min-h-0">
                <CardHeader className="shrink-0 pb-0">
                  <CardTitle className="text-base">
                    Histórico de ocupación de la red
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-h-0 flex-1">
                  <GraficoOcupacionRed flexible />
                </CardContent>
              </Card>

              <Card className="flex min-h-0 flex-col gap-2 py-4 xl:col-span-3">
                <CardHeader className="shrink-0 pb-0">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    Novedades en vivo
                    {casosPendientes.length + eventosHoy.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {casosPendientes.length + eventosHoy.length}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 overflow-y-auto">
                  <NovedadesEnVivo
                    casos={casosPendientes}
                    eventos={eventosHoy}
                    nombresCentros={nombresCentros}
                    hoy={hoy}
                  />
                </CardContent>
              </Card>

              <Card className="flex min-h-0 flex-col gap-2 py-4 xl:col-span-3">
                <CardHeader className="shrink-0 pb-0">
                  <CardTitle className="text-base">Estado de la red</CardTitle>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {ORDEN_NIVELES.map((nivel) => {
                    const n = conteoNivel[nivel];
                    if (n === 0 && nivel !== "sin_datos") return null;
                    const pct =
                      kpis.centrosTotal > 0
                        ? Math.round((n / kpis.centrosTotal) * 100)
                        : 0;
                    return (
                      <div key={nivel}>
                        <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                          <span className="text-foreground">{ETIQUETA_NIVEL[nivel]}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                            {n} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(pct, n > 0 ? 4 : 0)}%`,
                              background: COLOR_NIVEL[nivel],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <p className="pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Atención prioritaria
                  </p>
                  <div className="space-y-1.5">
                    {prioridades
                      .filter(({ prioridad }) =>
                        ["critico", "alto"].includes(prioridad.nivel),
                      )
                      .map(({ centro, prioridad }) => (
                        <Link
                          key={centro.id}
                          to={`/centro/${centro.id}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/60 px-2 py-1.5 hover:bg-muted/40"
                        >
                          <span className="truncate text-xs font-medium text-foreground">
                            N.° {centro.nro} · {centro.nombre}
                          </span>
                          <Badge
                            variant="outline"
                            className="shrink-0 px-1.5 py-0 text-[10px]"
                            style={{
                              borderColor: `${COLOR_NIVEL[prioridad.nivel]}66`,
                              color: COLOR_NIVEL[prioridad.nivel],
                            }}
                          >
                            {ETIQUETA_NIVEL[prioridad.nivel]}
                          </Badge>
                        </Link>
                      ))}
                    {prioridades.every(
                      ({ prioridad }) => !["critico", "alto"].includes(prioridad.nivel),
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        Ningún campamento en nivel crítico o alto.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IndicadorConexion({ conectado }: { conectado: boolean }) {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Sin conexión
      </Badge>
    );
  }
  if (!conectado) {
    return (
      <Badge variant="destructive" className="gap-1">
        <span className="size-1.5 rounded-full bg-red-400" />
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

function KpiSala({
  label,
  valor,
  sub,
  subClassName,
  icono,
  acento = "text-foreground",
}: {
  label: string;
  valor: number;
  sub?: string;
  /** Clases extra para el subtexto (p. ej. destacar urgentes en rojo). */
  subClassName?: string;
  icono?: ReactNode;
  acento?: string;
}) {
  return (
    <Card className="justify-center gap-0 py-2.5">
      <CardContent className="flex flex-col gap-0.5 px-3 py-0">
        <div className="flex items-center justify-between gap-1 text-muted-foreground">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide 2xl:text-xs">
            {label}
          </span>
          {icono}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-2xl font-bold tabular-nums 2xl:text-4xl", acento)}>
            {valor.toLocaleString("es")}
          </span>
          {sub && (
            <span className={cn("truncate text-[11px] text-muted-foreground", subClassName)}>
              {sub}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** KPI doble: eventos del día positivos (verde) y negativos (rojo). */
function KpiEventosHoy({ positivos, negativos }: { positivos: number; negativos: number }) {
  return (
    <Card className="justify-center gap-0 py-2.5">
      <CardContent className="flex flex-col gap-0.5 px-3 py-0">
        <div className="flex items-center justify-between gap-1 text-muted-foreground">
          <span className="truncate text-[11px] font-medium uppercase tracking-wide 2xl:text-xs">
            Eventos hoy
          </span>
          <Activity className="size-4" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-emerald-300 2xl:text-4xl">
            +{positivos.toLocaleString("es")}
          </span>
          <span className="text-2xl font-bold tabular-nums text-red-300 2xl:text-4xl">
            −{negativos.toLocaleString("es")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
