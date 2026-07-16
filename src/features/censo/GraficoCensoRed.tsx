// Gráfico de avance del censo nominal (acumulado + altas del día).

import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  XAxis,
  YAxis,
} from "recharts";
import type { PuntoSerieCensoNominal } from "@/domain/serieCensoNominal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

const config: ChartConfig = {
  censados: {
    label: "Censados (acumulado)",
    color: "var(--chart-1)",
  },
  nuevos: {
    label: "Altas del día",
    color: "var(--chart-2)",
  },
};

function formatearDia(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}

interface Props {
  serie: PuntoSerieCensoNominal[];
  cargando?: boolean;
}

export function GraficoCensoRed({ serie, cargando = false }: Props) {
  const ultimo = serie.length > 0 ? serie[serie.length - 1] : null;
  const penultimo = serie.length > 1 ? serie[serie.length - 2] : null;
  const deltaAcumulado = useMemo(() => {
    if (!ultimo || !penultimo) return ultimo?.nuevos ?? 0;
    return ultimo.censados - penultimo.censados;
  }, [ultimo, penultimo]);

  if (cargando && serie.length === 0) {
    return (
      <Card size="sm" className="border-teal-500/15">
        <CardHeader className="px-4 pb-2 pt-3">
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Skeleton className="h-[160px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (serie.length === 0 || !ultimo) {
    return (
      <Card size="sm" className="border-teal-500/15">
        <CardContent className="px-4 py-6 text-center text-xs text-muted-foreground">
          Sin registros nominales aún. La curva aparece al censar la primera
          persona.
        </CardContent>
      </Card>
    );
  }

  const avanzando = deltaAcumulado > 0;

  return (
    <Card size="sm" className="border-teal-500/15">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-1 pt-3">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="text-sm font-semibold">
            Avance del censo por día
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">
            Acumulado de personas censadas · {formatearDia(serie[0].dia)} →{" "}
            {formatearDia(ultimo.dia)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            Hoy:{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {ultimo.censados.toLocaleString("es")}
            </span>
          </span>
          {deltaAcumulado !== 0 ? (
            <Badge
              variant="outline"
              className={
                avanzando
                  ? "gap-1 border-emerald-500/40 text-[10px] text-emerald-500"
                  : "gap-1 border-amber-500/40 text-[10px] text-amber-500"
              }
            >
              {avanzando ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {deltaAcumulado > 0 ? "+" : ""}
              {deltaAcumulado.toLocaleString("es")} vs. día previo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Sin altas hoy
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3 pt-0 sm:px-4">
        <ChartContainer config={config} className="h-[180px] w-full">
          <ComposedChart
            data={serie}
            margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradCensoRed" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-censados)"
                  stopOpacity={0.45}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-censados)"
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
              yAxisId="acum"
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => v.toLocaleString("es")}
            />
            <YAxis
              yAxisId="nuevos"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v: number) => v.toLocaleString("es")}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as
                      | PuntoSerieCensoNominal
                      | undefined;
                    return p ? `Censo al ${formatearDia(p.dia)}` : "";
                  }}
                />
              }
            />
            <Bar
              yAxisId="nuevos"
              dataKey="nuevos"
              fill="var(--color-nuevos)"
              fillOpacity={0.55}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Area
              yAxisId="acum"
              type="monotone"
              dataKey="censados"
              stroke="var(--color-censados)"
              strokeWidth={2}
              fill="url(#gradCensoRed)"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
