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
  Home,
  Minus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { db } from "@/data/db";
import type { CensoSnapshot, PuntoServicio, Sector } from "@/domain/tipos";
import { ESTADO_SECTOR_COLOR, META_POR_TIPO, sumarVulnerables } from "@/domain/tipos";
import { generarAlertas, kpisGlobales } from "@/domain/brechas";
import { esMantenimiento, formatoDuracion, infoLimpieza } from "@/domain/limpieza";
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
  const alertas = useMemo(() => generarAlertas(sectores, puntos), [sectores, puntos]);
  const serie = useMemo(() => serieDiariaPoblacion(censos), [censos]);
  const variacion = useMemo(() => variacionUltimoDia(serie), [serie]);

  const mantenimiento = useMemo(() => {
    const rank: Record<string, number> = {
      vencido: 0,
      pronto: 1,
      sin_programar: 2,
      ok: 3,
    };
    return puntos
      .filter((p) => esMantenimiento(p.tipo))
      .map((p) => ({ p, info: infoLimpieza(p, ahora) }))
      .sort(
        (a, b) =>
          (rank[a.info?.estado ?? "ok"] ?? 3) - (rank[b.info?.estado ?? "ok"] ?? 3),
      );
  }, [puntos, ahora]);
  const vencidos = mantenimiento.filter((m) => m.info?.estado === "vencido").length;

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
                <CardTitle className="text-base">Estado de sectores</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Semaforo
                  color={ESTADO_SECTOR_COLOR.verde}
                  n={kpis.sectoresVerde}
                  label="OK"
                />
                <Semaforo
                  color={ESTADO_SECTOR_COLOR.amarillo}
                  n={kpis.sectoresAmarillo}
                  label="Alerta"
                />
                <Semaforo
                  color={ESTADO_SECTOR_COLOR.rojo}
                  n={kpis.sectoresRojo}
                  label="Crítico"
                />
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
                  {mantenimiento.map(({ p, info }) => (
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
                          {p.ultimaLimpieza
                            ? `Hace ${formatoDuracion(ahora - p.ultimaLimpieza)}`
                            : "Sin registro"}
                          {info?.venceEnMs != null &&
                            info.estado !== "sin_programar" &&
                            (info.venceEnMs >= 0
                              ? ` · vence en ${formatoDuracion(info.venceEnMs)}`
                              : ` · vencida hace ${formatoDuracion(Math.abs(info.venceEnMs))}`)}
                        </div>
                      </div>
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

function Semaforo({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-border bg-muted/20 px-2 py-3">
      <span className="inline-block size-3 rounded-full" style={{ background: color }} />
      <span className="text-2xl font-bold tabular-nums text-foreground">{n}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
