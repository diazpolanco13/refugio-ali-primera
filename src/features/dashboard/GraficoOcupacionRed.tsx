// Gráfico de ocupación AGREGADA de la red de Centros Transitorios
// (AreaChart de recharts vía shadcn). Se muestra en `DashboardView` como
// "Histórico de ocupación de la red". Eje X = fecha (DD-MM), eje Y = total
// agregado de damnificados. Área con gradiente y tooltip con `ChartTooltip`.
//
// Incluye un toggle para alternar entre:
//  - Vista total de la red (un área).
//  - Vista por grupo (Área Metropolitana vs Gran Caracas, dos líneas).

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import {
  serieDiariaOcupacionRed,
  serieDiariaPorGrupo,
  variacionUltimoDia,
  type CentroParaAgregado,
  type PuntoSerie,
  type PuntoSeriePorGrupo,
} from "@/domain/serieOcupacionCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  ChartContainer,
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

const configGrupo: ChartConfig = {
  areaMetropolitana: {
    label: "Área Metropolitana",
    color: "var(--chart-2)",
  },
  granCaracas: {
    label: "Gran Caracas",
    color: "var(--chart-3)",
  },
};

function formatearDia(dia: string): string {
  // dia = YYYY-MM-DD → DD-MM
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}

type Vista = "red" | "grupos";

export function GraficoOcupacionRed() {
  const snapshots = useOcupacionesCentros();
  const filasCentros = useSupabaseQuery<FilaCentroBlob>("centros");
  const centros = useMemo(() => desenredarCentros(filasCentros), [filasCentros]);
  const centrosParaAgregado = useMemo<CentroParaAgregado[]>(
    () => centros.map((c) => ({ id: c.id, grupo: c.grupo })),
    [centros],
  );

  const [vista, setVista] = useState<Vista>("red");

  const serieRed = useMemo(
    () => serieDiariaOcupacionRed(snapshots, centrosParaAgregado),
    [snapshots, centrosParaAgregado],
  );
  const serieGrupos = useMemo(
    () => serieDiariaPorGrupo(snapshots, centrosParaAgregado),
    [snapshots, centrosParaAgregado],
  );
  const variacion = useMemo(() => variacionUltimoDia(serieRed), [serieRed]);

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            Último:{" "}
            <span className="font-semibold text-foreground">
              {ultimo.total.toLocaleString("es")}
            </span>{" "}
            damnificados · {formatearDia(ultimo.dia)}
          </span>
          {variacion && variacion.total !== 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                variacion.total > 0
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-red-500/40 text-red-400",
              )}
            >
              {variacion.total > 0 ? "+" : ""}
              {variacion.total.toLocaleString("es")} vs. día previo
            </Badge>
          )}
        </div>
        <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
          <Button
            type="button"
            variant={vista === "red" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setVista("red")}
          >
            Red
          </Button>
          <Button
            type="button"
            variant={vista === "grupos" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setVista("grupos")}
          >
            Por grupo
          </Button>
        </div>
      </div>

      {vista === "red" ? (
        <ChartContainer config={configRed} className="h-[220px] w-full">
          <AreaChart data={serieRed} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradOcupRed" x1="0" y1="0" x2="0" y2="1">
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
      ) : (
        <ChartContainer config={configGrupo} className="h-[220px] w-full">
          <LineChart data={serieGrupos} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
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
                    const p = payload?.[0]?.payload as PuntoSeriePorGrupo | undefined;
                    return p ? `Por grupo al ${formatearDia(p.dia)}` : "";
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="areaMetropolitana"
              stroke="var(--color-areaMetropolitana)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="granCaracas"
              stroke="var(--color-granCaracas)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}
