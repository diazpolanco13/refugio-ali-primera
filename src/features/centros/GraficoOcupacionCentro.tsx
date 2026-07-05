// Gráfico de ocupación de UN centro (AreaChart de recharts vía shadcn).
// Se muestra dentro de `DetalleCentro` en una sección desplegable
// "Histórico de ocupación". Eje X = fecha (DD-MM), eje Y = total de
// refugiados. Área con gradiente y tooltip con `ChartTooltip`.

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  serieDiariaOcupacionCentro,
  variacionUltimoDia,
  type PuntoSerie,
} from "@/domain/serieOcupacionCentros";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";

const config: ChartConfig = {
  total: {
    label: "Refugiados",
    color: "var(--chart-1)",
  },
};

function formatearDia(dia: string): string {
  // dia = YYYY-MM-DD → DD-MM
  const [y, m, d] = dia.split("-");
  void y;
  return `${d}-${m}`;
}

interface Props {
  centroId: string;
}

export function GraficoOcupacionCentro({ centroId }: Props) {
  const snapshots = useOcupacionesCentros({ centroId });
  const serie = useMemo(
    () => serieDiariaOcupacionCentro(centroId, snapshots),
    [centroId, snapshots],
  );
  const variacion = useMemo(() => variacionUltimoDia(serie), [serie]);

  if (serie.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Aún no hay histórico de ocupación para este campamento. Se irá construyendo
        a medida que se registren cambios en el levantamiento (pestaña V ·
        Población).
      </p>
    );
  }

  const ultimo = serie[serie.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>
          Último registro: <span className="font-semibold text-foreground">{ultimo.total.toLocaleString("es")}</span> refugiados ·{" "}
          {formatearDia(ultimo.dia)}
        </span>
        {variacion && variacion.total !== 0 && (
          <Badge
            variant="outline"
            className={
              variacion.total > 0
                ? "border-emerald-500/40 text-[10px] text-emerald-400"
                : "border-red-500/40 text-[10px] text-red-400"
            }
          >
            {variacion.total > 0 ? "+" : ""}
            {variacion.total.toLocaleString("es")} vs. día previo
          </Badge>
        )}
      </div>

      <ChartContainer config={config} className="h-[180px] w-full">
        <AreaChart data={serie} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="gradOcupCentro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.02} />
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
            width={36}
            tickFormatter={(v: number) => v.toLocaleString("es")}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const p = (payload?.[0]?.payload as PuntoSerie | undefined);
                  return p ? `Ocupación al ${formatearDia(p.dia)}` : "";
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--color-total)"
            strokeWidth={2}
            fill="url(#gradOcupCentro)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
