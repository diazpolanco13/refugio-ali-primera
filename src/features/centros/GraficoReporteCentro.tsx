// Gráfico temporal del reporte diario de UN campamento: parte numérico
// Telegram (damnificados, familias, mascotas e incidencias de salud).
// Ventana configurable: 7, 15 o 30 días.

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import {
  serieReporteCentro,
  ultimosDiasReporte,
  type VentanaReporte,
} from "@/domain/reporteDiario";
import { claveDia } from "@/data/reposSupabase";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatearDiaCalendario } from "./CalendarioSelectorDia";

/** Colores vivos y distinguibles sobre fondo oscuro. */
const COLORES = {
  refugiados: "#38bdf8",
  familias: "#fb923c",
  mascotas: "#fbbf24",
  incidenciasSalud: "#fb7185",
} as const;

const config: ChartConfig = {
  refugiados: { label: "Damnificados", color: COLORES.refugiados },
  familias: { label: "Familias", color: COLORES.familias },
  mascotas: { label: "Mascotas", color: COLORES.mascotas },
  incidenciasSalud: { label: "Incidencias salud", color: COLORES.incidenciasSalud },
};

const VENTANAS: VentanaReporte[] = [7, 15, 30];

const SERIES = [
  { key: "refugiados" as const, yAxis: undefined, ancho: 2, dash: undefined },
  { key: "familias" as const, yAxis: undefined, ancho: 2, dash: undefined },
  { key: "mascotas" as const, yAxis: undefined, ancho: 1.5, dash: "4 3" },
  { key: "incidenciasSalud" as const, yAxis: "right" as const, ancho: 2, dash: undefined },
];

interface Props {
  centroId: string;
  snapshots: SnapshotOcupacion[];
  /** Día seleccionado (YYYY-MM-DD) → línea vertical en el gráfico. */
  diaMarcado?: string | null;
}

export function GraficoReporteCentro({
  centroId,
  snapshots,
  diaMarcado,
}: Props) {
  const [ventana, setVentana] = useState<VentanaReporte>(7);
  const hoyClave = useMemo(() => claveDia(Date.now()), []);

  /** Amplía la ventana si el día marcado queda fuera del rango visible. */
  const ventanaSerie = useMemo((): VentanaReporte => {
    if (!diaMarcado) return ventana;
    if (ultimosDiasReporte(ventana, hoyClave).includes(diaMarcado)) return ventana;
    if (ultimosDiasReporte(15, hoyClave).includes(diaMarcado)) return 15;
    return 30;
  }, [ventana, diaMarcado, hoyClave]);

  const serie = useMemo(
    () => serieReporteCentro(centroId, snapshots, ventanaSerie, hoyClave),
    [centroId, snapshots, ventanaSerie, hoyClave],
  );

  const diaEnSerie = diaMarcado != null && serie.some((p) => p.dia === diaMarcado);

  const tieneDatos = useMemo(
    () =>
      serie.some(
        (p) =>
          p.refugiados > 0 ||
          p.familias > 0 ||
          p.mascotas > 0 ||
          p.incidenciasSalud > 0,
      ),
    [serie],
  );

  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2">
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold">Evolución diaria</CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Población (izq.) · Incidencias salud (der.)
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="rounded-md border border-border p-0.5">
            {VENTANAS.map((v) => (
              <Button
                key={v}
                type="button"
                size="xs"
                variant={ventana === v ? "secondary" : "ghost"}
                className={cn("h-6 px-2 text-[10px]", ventana === v && "shadow-sm")}
                onClick={() => setVentana(v)}
              >
                {v}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col space-y-1.5 px-3 pb-2 pt-0">
        {!tieneDatos ? (
          <p className="flex flex-1 items-center justify-center py-6 text-center text-[11px] text-muted-foreground">
            Sin datos en los últimos {ventanaSerie} días.
          </p>
        ) : (
          <>
            <ChartContainer
              config={config}
              className="aspect-auto h-[240px] w-full shrink-0"
              initialDimension={{ width: 320, height: 240 }}
            >
              <LineChart data={serie} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="dia"
                  tickFormatter={formatearDiaCalendario}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  minTickGap={ventanaSerie <= 7 ? 6 : 16}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={36}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => v.toLocaleString("es")}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  allowDecimals={false}
                  domain={[0, (max: number) => Math.max(max, 1)]}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => v.toLocaleString("es")}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const p = payload?.[0]?.payload as { dia?: string } | undefined;
                        return p?.dia ? `Día ${formatearDiaCalendario(p.dia)}` : "";
                      }}
                    />
                  }
                />
                {diaEnSerie && (
                  <ReferenceLine
                    x={diaMarcado!}
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    label={{
                      value: formatearDiaCalendario(diaMarcado!),
                      position: "top",
                      fill: "#38bdf8",
                      fontSize: 10,
                    }}
                  />
                )}
                {SERIES.map(({ key, yAxis, ancho, dash }) => (
                  <Line
                    key={key}
                    {...(yAxis ? { yAxisId: yAxis } : {})}
                    type="monotone"
                    dataKey={key}
                    name={config[key]?.label as string}
                    stroke={COLORES[key]}
                    strokeWidth={ancho}
                    strokeDasharray={dash}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>

            <div className="flex flex-wrap gap-x-2.5 gap-y-1">
              {SERIES.map(({ key }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 text-[9px] text-muted-foreground"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: COLORES[key] }}
                  />
                  {config[key]?.label}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
