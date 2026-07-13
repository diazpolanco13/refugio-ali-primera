// Gráfico de ocupación AGREGADA de la red de Centros Transitorios
// (AreaChart de recharts vía shadcn). Se muestra en `DashboardView` como
// "Histórico de ocupación de la red".
//
// Con alcance limitado (supervisor/operador) el toggle es:
//  - Todos: total de la red vs total de centros asignados (áreas
//    superpuestas, sin apilar).
//  - Unidad: solo la serie de centros asignados al usuario (escala propia).
//
// Con alcance total (admin, etc.): una sola serie de la red (sin toggle).

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import {
  serieDiariaOcupacionRed,
  serieDiariaOcupacionRedVsAsignados,
  variacionUltimoDia,
  type CentroParaAgregado,
  type PuntoSerie,
  type PuntoSerieRedVsAsignados,
} from "@/domain/serieOcupacionCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { idCentroEsPrueba } from "@/domain/centrosTransitorios";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const configRed: ChartConfig = {
  total: {
    label: "Damnificados en la red",
    color: "var(--chart-1)",
  },
};

const configComparativa: ChartConfig = {
  totalRed: {
    label: "Total red",
    color: "var(--chart-1)",
  },
  totalAsignados: {
    label: "Mis centros",
    color: "var(--chart-2)",
  },
};

const configUnidad: ChartConfig = {
  total: {
    label: "Mis centros",
    color: "var(--chart-2)",
  },
};

function formatearDia(dia: string): string {
  // dia = YYYY-MM-DD → DD-MM
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}

function BadgeVariacion({ delta }: { delta: number }) {
  if (delta === 0) return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        delta > 0
          ? "border-emerald-500/40 text-emerald-400"
          : "border-red-500/40 text-red-400",
      )}
    >
      {delta > 0 ? "+" : ""}
      {delta.toLocaleString("es")} vs. día previo
    </Badge>
  );
}

type Vista = "todos" | "unidad";

interface Props {
  /**
   * Si es true, el gráfico llena la altura disponible del contenedor
   * (sala situacional) en vez de la altura fija.
   */
  flexible?: boolean;
  /**
   * IDs de centros asignados al usuario. Si hay set no vacío: toggle
   * Todos (red vs asignados) / Unidad (solo asignados).
   * `null`/`undefined` = solo serie de red (roles con alcance total).
   */
  idsAsignados?: ReadonlySet<string> | null;
}

export function GraficoOcupacionRed({
  flexible = false,
  idsAsignados = null,
}: Props = {}) {
  const snapshots = useOcupacionesCentros();
  const filasCentros = useSupabaseQuery<FilaCentroBlob>("centros");
  const centros = useMemo(() => desenredarCentros(filasCentros), [filasCentros]);
  const centrosParaAgregado = useMemo<CentroParaAgregado[]>(
    () =>
      centros
        .filter((c) => !idCentroEsPrueba(c.id))
        .map((c) => ({ id: c.id, grupo: c.grupo })),
    [centros],
  );

  const tieneAsignados = idsAsignados != null && idsAsignados.size > 0;

  const [vista, setVista] = useState<Vista>("todos");

  const serieRed = useMemo(
    () => serieDiariaOcupacionRed(snapshots, centrosParaAgregado),
    [snapshots, centrosParaAgregado],
  );
  const serieComparativa = useMemo(
    () =>
      tieneAsignados
        ? serieDiariaOcupacionRedVsAsignados(
            snapshots,
            centrosParaAgregado,
            idsAsignados!,
          )
        : [],
    [tieneAsignados, snapshots, centrosParaAgregado, idsAsignados],
  );
  const serieUnidad = useMemo(() => {
    if (!tieneAsignados) return [];
    const centrosAsig = centrosParaAgregado.filter((c) =>
      idsAsignados!.has(c.id),
    );
    return serieDiariaOcupacionRed(snapshots, centrosAsig);
  }, [tieneAsignados, snapshots, centrosParaAgregado, idsAsignados]);

  const variacionRed = useMemo(() => variacionUltimoDia(serieRed), [serieRed]);
  const variacionUnidad = useMemo(
    () => variacionUltimoDia(serieUnidad),
    [serieUnidad],
  );

  if (serieRed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay histórico de ocupación de la red. Se irá construyendo a
        medida que se registren cambios en el levantamiento de cada campamento
        (pestaña V · Población).
      </p>
    );
  }

  const ultimo = serieRed[serieRed.length - 1];
  const ultimoComp = tieneAsignados
    ? serieComparativa[serieComparativa.length - 1]
    : undefined;
  const ultimoUnidad = serieUnidad[serieUnidad.length - 1];

  const claseChart = flexible ? "min-h-0 w-full flex-1" : "h-[220px] w-full";
  const mostrarUnidad = tieneAsignados && vista === "unidad";

  return (
    <div className={cn(flexible ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3")}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {mostrarUnidad && ultimoUnidad ? (
            <>
              <span>
                Mis centros:{" "}
                <span className="font-semibold text-foreground">
                  {ultimoUnidad.total.toLocaleString("es")}
                </span>{" "}
                damnificados · {formatearDia(ultimoUnidad.dia)}
              </span>
              {variacionUnidad && (
                <BadgeVariacion delta={variacionUnidad.total} />
              )}
            </>
          ) : tieneAsignados && ultimoComp ? (
            <>
              <span>
                Red:{" "}
                <span className="font-semibold text-foreground">
                  {ultimoComp.totalRed.toLocaleString("es")}
                </span>
                {" · "}
                Mis centros:{" "}
                <span className="font-semibold text-foreground">
                  {ultimoComp.totalAsignados.toLocaleString("es")}
                </span>
                {" · "}
                {formatearDia(ultimoComp.dia)}
              </span>
              {variacionUnidad && (
                <BadgeVariacion delta={variacionUnidad.total} />
              )}
            </>
          ) : (
            <>
              <span>
                Último:{" "}
                <span className="font-semibold text-foreground">
                  {ultimo.total.toLocaleString("es")}
                </span>{" "}
                damnificados · {formatearDia(ultimo.dia)}
              </span>
              {variacionRed && <BadgeVariacion delta={variacionRed.total} />}
            </>
          )}
        </div>
        {tieneAsignados && (
          <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
            <Button
              type="button"
              variant={vista === "todos" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => setVista("todos")}
            >
              Todos
            </Button>
            <Button
              type="button"
              variant={vista === "unidad" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => setVista("unidad")}
            >
              Unidad
            </Button>
          </div>
        )}
      </div>

      {mostrarUnidad ? (
        <ChartContainer config={configUnidad} className={claseChart}>
          <AreaChart
            data={serieUnidad}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradOcupUnidad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.55}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="dia"
              tickFormatter={formatearDia}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => v.toLocaleString("es")}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as PuntoSerie | undefined;
                    return p ? `Mis centros al ${formatearDia(p.dia)}` : "";
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              fill="url(#gradOcupUnidad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : tieneAsignados ? (
        <ChartContainer config={configComparativa} className={claseChart}>
          <AreaChart
            data={serieComparativa}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradOcupRedTotal" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-totalRed)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-totalRed)"
                  stopOpacity={0.02}
                />
              </linearGradient>
              <linearGradient
                id="gradOcupAsignados"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="var(--color-totalAsignados)"
                  stopOpacity={0.55}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-totalAsignados)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="dia"
              tickFormatter={formatearDia}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => v.toLocaleString("es")}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as
                      | PuntoSerieRedVsAsignados
                      | undefined;
                    return p ? `Al ${formatearDia(p.dia)}` : "";
                  }}
                />
              }
            />
            {/* Sin stackId: superpuestas independientes (red detrás). */}
            <Area
              type="monotone"
              dataKey="totalRed"
              stroke="var(--color-totalRed)"
              strokeWidth={2}
              fill="url(#gradOcupRedTotal)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="totalAsignados"
              stroke="var(--color-totalAsignados)"
              strokeWidth={2}
              fill="url(#gradOcupAsignados)"
              isAnimationActive={false}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <ChartContainer config={configRed} className={claseChart}>
          <AreaChart
            data={serieRed}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradOcupRed" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.5}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="dia"
              tickFormatter={formatearDia}
              tickLine={false}
              axisLine={false}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => v.toLocaleString("es")}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as PuntoSerie | undefined;
                    return p ? `Red al ${formatearDia(p.dia)}` : "";
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-total)"
              strokeWidth={2}
              fill="url(#gradOcupRed)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </div>
  );
}
