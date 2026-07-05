import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Home,
  MapPin,
  Siren,
  Users,
  Utensils,
} from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { useIncidencias } from "@/data/useIncidencias";
import { useReportesCentros } from "@/data/useReportesCentros";
import { claveDia } from "@/data/reposSupabase";
import { racionesDelDia } from "@/domain/reporteDiario";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import {
  conteoPorNivel,
  demografiaRed,
  ETIQUETA_NIVEL,
  kpisRedCentros,
  poblacionPorParroquia,
  topPrioridadCentros,
  totalVulnerables,
} from "@/domain/redCentros";
import { ORDEN_NIVELES, type NivelPrioridad } from "@/domain/prioridadCentros";
import type { Sesion } from "@/data/authSupabase";
import { useSupabaseConectado } from "@/data/useSupabaseConectado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DemografiaResumen } from "../tablero/DemografiaResumen";
import { GraficoOcupacionRed } from "./GraficoOcupacionRed";

interface FilaCentroBlob {
  id: string;
  updated_at: number;
  updated_by: string;
  deleted: boolean;
  data: CentroTransitorio;
}

/** Filtra filas no borradas y aplana `data` al tipo de dominio. */
function desenredarCentros(filas: FilaCentroBlob[]): CentroTransitorio[] {
  return filas.filter((f) => !f.deleted).map((f) => f.data);
}

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

const COLOR_NIVEL: Record<NivelPrioridad, string> = {
  critico: "#ef4444",
  alto: "#f97316",
  medio: "#f59e0b",
  estable: "#22c55e",
  sin_datos: "#64748b",
};

/** Sala de control proyectable: red agregada de Centros Transitorios. */
export function DashboardView({ sesion: _sesion }: { sesion: Sesion }) {
  const filasCentros = useSupabaseQuery<FilaCentroBlob>("centros");
  const centros = useMemo(
    () =>
      desenredarCentros(filasCentros).sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const conectado = useSupabaseConectado();

  const kpis = useMemo(() => kpisRedCentros(centros), [centros]);
  const demografia = useMemo(() => demografiaRed(centros), [centros]);
  const parroquias = useMemo(() => poblacionPorParroquia(centros), [centros]);
  const prioridades = useMemo(() => topPrioridadCentros(centros, 15), [centros]);
  const conteoNivel = useMemo(() => conteoPorNivel(centros), [centros]);
  const maxParroquia = parroquias[0]?.refugiados ?? 1;

  // Incidencias abiertas de toda la red (Realtime); las urgentes se destacan.
  const abiertas = useIncidencias({ estado: "abierta" });
  const urgentes = useMemo(
    () => abiertas.filter((i) => i.etiqueta === "urgente").length,
    [abiertas],
  );

  // Raciones reportadas hoy (suma de las tres jornadas de todos los centros)
  // frente a la población alojada. "Hoy" en fecha local, como `claveDia`.
  const hoy = claveDia(Date.now());
  const reportesHoy = useReportesCentros({ dia: hoy });
  const racionesHoy = useMemo(
    () => reportesHoy.reduce((acc, r) => acc + racionesDelDia(r), 0),
    [reportesHoy],
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
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
              Área Metropolitana de Caracas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <IndicadorConexion conectado={conectado} />
          <Reloj />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <KpiGrande
            label="Refugiados"
            valor={kpis.refugiadosTotal}
            icono={<Users className="size-5" />}
            acento="text-sky-300"
          />
          <KpiGrande
            label="Familias"
            valor={kpis.familiasTotal}
            icono={<Home className="size-5" />}
          />
          <KpiGrande
            label="Personal operativo"
            valor={kpis.personalTotal}
            acento="text-violet-300"
          />
          <KpiGrande
            label="Campamentos con datos"
            valor={kpis.centrosConDatos}
            sub={`de ${kpis.centrosTotal}`}
            icono={<Building2 className="size-5" />}
          />
          <KpiGrande
            label="Cupo disponible"
            valor={kpis.cupoDisponible}
            sub="en toda la red"
            acento="text-emerald-300"
          />
          <KpiGrande
            label="Campamentos críticos"
            valor={kpis.centrosCriticos}
            icono={<AlertTriangle className="size-5" />}
            acento={kpis.centrosCriticos > 0 ? "text-red-300" : "text-emerald-300"}
          />
          <KpiGrande
            label="Incidencias abiertas"
            valor={abiertas.length}
            sub={urgentes > 0 ? `${urgentes} urgente(s)` : "sin urgentes"}
            subClassName={urgentes > 0 ? "font-semibold text-red-400" : undefined}
            icono={<Siren className="size-5" />}
            acento={
              urgentes > 0
                ? "text-red-300"
                : abiertas.length > 0
                  ? "text-amber-300"
                  : "text-emerald-300"
            }
          />
          <KpiGrande
            label="Raciones hoy"
            valor={racionesHoy}
            sub={`de ${kpis.refugiadosTotal.toLocaleString("es")} refugiados`}
            icono={<Utensils className="size-5" />}
            acento="text-orange-300"
          />
        </div>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg">
              Histórico de ocupación de la red
            </CardTitle>
            <CardDescription>
              Refugiados alojados por día con carry-forward del último snapshot
              conocido de cada campamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GraficoOcupacionRed />
          </CardContent>
        </Card>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base lg:text-lg">
                Población por parroquia
              </CardTitle>
              <CardDescription>
                Refugiados alojados en campamentos activos, agrupados por parroquia
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {parroquias.length === 0 || kpis.refugiadosTotal === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay ocupación registrada en los campamentos. Completa el
                  levantamiento de campo (pestaña V · Población) para ver la
                  distribución territorial.
                </p>
              ) : (
                parroquias.map((p) => (
                  <BarraParroquia key={p.parroquia} fila={p} max={maxParroquia} />
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estado de la red</CardTitle>
                <CardDescription>Campamentos por nivel de urgencia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {ORDEN_NIVELES.map((nivel) => {
                  const n = conteoNivel[nivel];
                  if (n === 0 && nivel !== "sin_datos") return null;
                  const pct =
                    kpis.centrosTotal > 0
                      ? Math.round((n / kpis.centrosTotal) * 100)
                      : 0;
                  return (
                    <div key={nivel}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="text-foreground">{ETIQUETA_NIVEL[nivel]}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                          {n} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
              </CardContent>
            </Card>

            <Card className="min-h-0 flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Demografía de la red</CardTitle>
                <CardDescription>
                  {totalVulnerables(demografia).toLocaleString("es")} personas ·{" "}
                  {kpis.familiasTotal.toLocaleString("es")} familias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DemografiaResumen
                  vulnerables={demografia}
                  mostrarEstructura={kpis.refugiadosTotal > 0}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base lg:text-lg">
              Campamentos que requieren atención
            </CardTitle>
            <CardDescription>
              Ordenados por urgencia operativa (saturación, agua, saneamiento,
              vulnerables y requerimientos pendientes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {prioridades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay campamentos registrados.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {prioridades.map(({ centro, prioridad }) => (
                  <div
                    key={centro.id}
                    className="rounded-lg border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          N.° {centro.nro} · {centro.nombre}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {centro.parroquia}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px]"
                        style={{
                          borderColor: `${COLOR_NIVEL[prioridad.nivel]}66`,
                          color: COLOR_NIVEL[prioridad.nivel],
                        }}
                      >
                        {ETIQUETA_NIVEL[prioridad.nivel]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prioridad.factores.slice(0, 3).map((f) => (
                        <span
                          key={f.clave + f.label}
                          className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                    {prioridad.analisis.cupoReal != null && (
                      <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                        Cupo: {prioridad.analisis.cupoReal.toLocaleString("es")} ·{" "}
                        <span
                          style={{
                            color: COLOR_SEMAFORO[prioridad.analisis.semaforo],
                          }}
                        >
                          {prioridad.analisis.porcentajeOcupacion ?? 0}% ocupación
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {kpis.centrosSaturados > 0 && (
          <Card className="mt-4 border-red-500/30 bg-red-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-red-300">
                <AlertTriangle className="size-4" />
                {kpis.centrosSaturados} campamento(s) saturado(s)
              </CardTitle>
              <CardDescription>
                Ocupación ≥ 100% de la capacidad efectiva. Evalúe reubicación hacia
                campamentos con cupo disponible ({kpis.cupoDisponible.toLocaleString("es")}{" "}
                plazas en la red).
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}

function BarraParroquia({
  fila,
  max,
}: {
  fila: { parroquia: string; refugiados: number; familias: number; centros: number };
  max: number;
}) {
  const pct = max > 0 ? Math.round((fila.refugiados / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-foreground">
          <MapPin className="size-3.5 text-muted-foreground" />
          {fila.parroquia}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {fila.refugiados.toLocaleString("es")} pers · {fila.centros} campamento(s)
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${Math.max(pct, fila.refugiados > 0 ? 4 : 0)}%` }}
        />
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

function KpiGrande({
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
    <Card className="justify-center">
      <CardContent className="flex flex-col gap-1 py-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wide lg:text-sm">
            {label}
          </span>
          {icono}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-3xl font-bold tabular-nums lg:text-4xl", acento)}>
            {valor.toLocaleString("es")}
          </span>
          {sub && (
            <span className={cn("text-xs text-muted-foreground", subClassName)}>
              {sub}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
