import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowLeft,
  Brush,
  Clock,
  Home,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { db } from "@/data/db";
import type {
  CensoSnapshot,
  PuntoServicio,
  RegistroDistribucion,
  RegistroLimpieza,
  Sector,
} from "@/domain/tipos";
import { META_POR_TIPO, sumarVulnerables } from "@/domain/tipos";
import {
  coberturaGlobal,
  generarAlertas,
  kpisGlobales,
  type Cobertura,
} from "@/domain/brechas";
import { formatoDuracion } from "@/domain/limpieza";
import { resumenSalubridad } from "@/domain/salubridad";
import {
  claveDiaLocal,
  formatoHora,
  resumenDistribucion,
  type ResumenJornada,
} from "@/domain/distribucion";
import {
  serieDiariaPoblacion,
  variacionUltimoDia,
  type PuntoSerie,
} from "@/domain/poblacion";
import type { Sesion } from "@/data/auth";
import { useEstadoSync } from "@/data/sync";
import { permisosDeRol } from "@/domain/permisos";
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { DemografiaResumen } from "../tablero/DemografiaResumen";

const chartConfig = {
  poblacion: { label: "Población", color: "var(--chart-1)" },
  familias: { label: "Familias", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** Reloj en vivo (segundos). Aislado para no re-renderizar los gráficos. */
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

export function DashboardView({ sesion }: { sesion: Sesion }) {
  const sectores = useLiveQuery(() => db.sectores.toArray(), [], [] as Sector[]);
  const puntos = useLiveQuery(() => db.puntos.toArray(), [], [] as PuntoServicio[]);
  const censos = useLiveQuery(() => db.censos.toArray(), [], [] as CensoSnapshot[]);
  const distribuciones = useLiveQuery(
    () => db.distribuciones.toArray(),
    [],
    [] as RegistroDistribucion[],
  );
  const limpiezas = useLiveQuery(
    () => db.limpiezas.toArray(),
    [],
    [] as RegistroLimpieza[],
  );
  const estadoSync = useEstadoSync();
  const permisos = permisosDeRol(sesion.user.rol);

  // Reloj para los cronómetros de limpieza (cada 30 s).
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const kpis = useMemo(() => kpisGlobales(sectores, puntos), [sectores, puntos]);
  const demografia = useMemo(() => sumarVulnerables(sectores), [sectores]);
  const cobertura = useMemo(() => coberturaGlobal(sectores, puntos), [sectores, puntos]);
  const alertas = useMemo(
    () => generarAlertas(sectores, puntos, distribuciones, ahora),
    [sectores, puntos, distribuciones, ahora],
  );
  const serie = useMemo(() => serieDiariaPoblacion(censos), [censos]);
  const variacion = useMemo(() => variacionUltimoDia(serie), [serie]);
  const alimentacion = useMemo(
    () => resumenDistribucion(claveDiaLocal(), distribuciones, sectores),
    [distribuciones, sectores],
  );

  const salubridad = useMemo(
    () => resumenSalubridad(claveDiaLocal(), puntos, limpiezas, ahora),
    [puntos, limpiezas, ahora],
  );
  const mantenimiento = useMemo(() => {
    const rank: Record<string, number> = {
      vencido: 0,
      pronto: 1,
      sin_programar: 2,
      ok: 3,
    };
    return [...salubridad.puntos].sort(
      (a, b) =>
        (rank[a.info?.estado ?? "ok"] ?? 3) - (rank[b.info?.estado ?? "ok"] ?? 3),
    );
  }, [salubridad]);
  const vencidos = salubridad.vencidos;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Cabecera */}
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
              Sala Situacional
            </h1>
            <p className="truncate text-xs text-muted-foreground lg:text-sm">
              Refugio transitorio Parque del Oeste "Alí Primera"
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <IndicadorConexion estado={estadoSync} />
          <Reloj />
        </div>
      </header>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiGrande
            label="Población"
            valor={kpis.poblacionTotal}
            icono={<Users className="size-5" />}
            acento="text-sky-300"
          />
          <KpiGrande
            label="Familias"
            valor={kpis.familiasTotal}
            icono={<Home className="size-5" />}
          />
          <KpiGrande
            label="Vulnerables"
            valor={kpis.vulnerablesTotal}
            acento="text-amber-300"
          />
          <KpiGrande label="Sectores" valor={kpis.sectores} />
          <KpiGrande
            label="Puntos operativos"
            valor={kpis.puntosOperativos}
            sub={`de ${kpis.puntosTotal}`}
            acento="text-emerald-300"
          />
          <KpiGrande
            label="Alertas activas"
            valor={alertas.length}
            icono={<AlertTriangle className="size-5" />}
            acento={alertas.length > 0 ? "text-red-300" : "text-emerald-300"}
          />
        </div>

        {/* Gráfico + panel lateral */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {/* Registro poblacional */}
          <Card className="xl:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base lg:text-lg">
                  Registro poblacional por fechas
                </CardTitle>
                <CardDescription>
                  Evolución de la población y familias en el refugio
                </CardDescription>
              </div>
              <IndicadorVariacion delta={variacion.delta} />
            </CardHeader>
            <CardContent>
              {serie.length === 0 ? (
                <div className="flex h-[38vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <TrendingUp className="size-8 opacity-40" />
                  <p className="max-w-sm text-sm">
                    Aún no hay registros de población. Guarda el censo de un sector
                    desde el mapa para empezar a graficar la evolución.
                  </p>
                </div>
              ) : (
                <GraficoPoblacion serie={serie} />
              )}
            </CardContent>
          </Card>

          {/* Panel lateral: semáforo + demografía */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cobertura de servicios</CardTitle>
                <CardDescription>
                  Disponibles vs. necesarios (Esfera) para toda la población del parque
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {cobertura.every((c) => c.requerido === 0) ? (
                  <p className="text-sm text-muted-foreground">
                    Sin población registrada para calcular la cobertura.
                  </p>
                ) : (
                  cobertura.map((c) => <BarraCobertura key={c.tipo} c={c} />)
                )}
              </CardContent>
            </Card>

            <Card className="min-h-0 flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Demografía por edad y sexo</CardTitle>
              </CardHeader>
              <CardContent>
                <DemografiaResumen
                  vulnerables={demografia}
                  mostrarEstructura={sectores.length > 0}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Alimentación de hoy */}
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <UtensilsCrossed className="size-4 text-primary" />
              Alimentación de hoy
            </CardTitle>
            <CardDescription>
              Llegada de la comida e hidratación y sectores servidos por jornada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {alimentacion.map((r) => (
                <JornadaTarjeta key={r.jornada} r={r} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alertas + limpieza */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="size-4 text-amber-400" />
                Alertas ({alertas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin alertas activas.</p>
              ) : (
                <ul className="space-y-1.5">
                  {alertas.slice(0, 12).map((a, i) => (
                    <li
                      key={i}
                      className={cn(
                        "rounded-lg border-l-4 bg-muted/30 px-3 py-2 text-sm",
                        a.nivel === "critico"
                          ? "border-destructive"
                          : "border-amber-500",
                      )}
                    >
                      <div className="font-medium text-foreground">{a.titulo}</div>
                      <div className="text-xs text-muted-foreground">{a.detalle}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brush className="size-4 text-primary" />
                Limpieza y recolección
                {vencidos > 0 && (
                  <Badge variant="destructive">
                    {vencidos} vencido{vencidos > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mantenimiento.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin puntos de limpieza registrados.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {mantenimiento.map(({ punto: p, info, vecesHoy, meta, cumpleMeta, ultima, ultimaPor }) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2"
                    >
                      <span
                        className="inline-block size-3 shrink-0 rounded-full"
                        style={{ background: info?.color ?? "#94a3b8" }}
                      />
                      <span className="text-base">
                        {META_POR_TIPO[p.tipo]?.icono ?? "❓"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {p.nombre || META_POR_TIPO[p.tipo]?.label || p.tipo}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {ultima
                            ? `Hace ${formatoDuracion(ahora - ultima)}`
                            : "Sin registro"}
                          {ultimaPor ? ` · @${ultimaPor}` : ""}
                          {info?.venceEnMs != null &&
                            info.estado !== "sin_programar" &&
                            (info.venceEnMs >= 0
                              ? ` · vence en ${formatoDuracion(info.venceEnMs)}`
                              : ` · vencida hace ${formatoDuracion(Math.abs(info.venceEnMs))}`)}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 tabular-nums",
                          cumpleMeta
                            ? "border-emerald-500/40 text-emerald-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {vecesHoy}/{meta}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Vista de solo lectura · {permisos.etiqueta} · @{sesion.user.username}
        </p>
      </div>
    </div>
  );
}

function JornadaTarjeta({ r }: { r: ResumenJornada }) {
  const pct = r.total > 0 ? Math.round((r.servidos / r.total) * 100) : 0;
  const iniciada = r.horaLlegada != null || r.servidos > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-muted/20 p-3",
        r.completo
          ? "border-emerald-500/40"
          : iniciada
            ? "border-amber-500/30"
            : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{r.icono}</span>
          <span className="text-sm font-semibold text-foreground">{r.label}</span>
        </div>
        {r.completo && (
          <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-300">
            Completo
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        {r.horaLlegada ? (
          <span className="tabular-nums text-foreground">
            Llegó {formatoHora(r.horaLlegada)}
          </span>
        ) : (
          <span>Sin llegada</span>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold tabular-nums text-foreground">
            {r.servidos}
            <span className="text-sm font-normal text-muted-foreground">/{r.total}</span>
          </span>
          <span className="text-[11px] text-muted-foreground">sectores</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              r.completo ? "bg-emerald-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function GraficoPoblacion({ serie }: { serie: PuntoSerie[] }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[38vh] w-full">
      <AreaChart accessibilityLayer data={serie} margin={{ left: -12, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="fillPoblacion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-poblacion)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-poblacion)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="fillFamilias" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-familias)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--color-familias)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="familias"
          type="monotone"
          fill="url(#fillFamilias)"
          stroke="var(--color-familias)"
          strokeWidth={2}
        />
        <Area
          dataKey="poblacion"
          type="monotone"
          fill="url(#fillPoblacion)"
          stroke="var(--color-poblacion)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

function IndicadorVariacion({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
        <Minus className="size-3.5" />
        Sin cambios hoy
      </Badge>
    );
  }
  const positivo = delta > 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1",
        positivo
          ? "border-emerald-500/40 text-emerald-300"
          : "border-red-500/40 text-red-300",
      )}
    >
      {positivo ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {positivo ? "+" : "−"}
      {Math.abs(delta).toLocaleString("es")} {positivo ? "ingresos" : "salidas"} hoy
    </Badge>
  );
}

function IndicadorConexion({ estado }: { estado: string }) {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Sin conexión
      </Badge>
    );
  }
  if (estado === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <span className="size-1.5 rounded-full bg-red-400" />
        Sin sync
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-300">
      <span
        className={cn(
          "size-1.5 rounded-full bg-emerald-400",
          estado === "sincronizando" && "animate-pulse",
        )}
      />
      {estado === "sincronizando" ? "Actualizando…" : "En vivo"}
    </Badge>
  );
}

function KpiGrande({
  label,
  valor,
  sub,
  icono,
  acento = "text-foreground",
}: {
  label: string;
  valor: number;
  sub?: string;
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
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function BarraCobertura({ c }: { c: Cobertura }) {
  if (c.requerido === 0) return null;
  const pct = Math.min(100, c.porcentaje);
  const color =
    c.porcentaje >= 100 ? "#22c55e" : c.porcentaje >= 50 ? "#f59e0b" : "#ef4444";
  const textoColor =
    c.porcentaje >= 100
      ? "text-emerald-300"
      : c.porcentaje >= 50
        ? "text-amber-300"
        : "text-red-300";
  return (
    <div title={c.descripcion}>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-foreground">
          <span>{META_POR_TIPO[c.tipo]?.icono ?? "❓"}</span>
          {META_POR_TIPO[c.tipo]?.label ?? c.tipo}
        </span>
        <span className={cn("shrink-0 font-semibold tabular-nums", textoColor)}>
          {c.disponible}/{c.requerido} · {c.porcentaje}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
