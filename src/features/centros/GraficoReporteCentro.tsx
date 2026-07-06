// Gráfico temporal del reporte diario de UN campamento: población
// (refugiados, funcionarios, mascotas) + operativo (atenciones y comidas
// por jornada). Ventana configurable: 7, 15 o 30 días.

import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import {
  serieReporteCentro,
  ultimosDiasReporte,
  type ReporteDiario,
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

/** Colores vivos y distinguibles sobre fondo oscuro. */
const COLORES = {
  refugiados: "#38bdf8",
  funcionarios: "#a78bfa",
  mascotas: "#fbbf24",
  atenciones: "#fb7185",
  desayuno: "#fb923c",
  almuerzo: "#2dd4bf",
  cena: "#818cf8",
  comidasTotal: "#4ade80",
} as const;

const config: ChartConfig = {
  refugiados: { label: "Damnificados", color: COLORES.refugiados },
  funcionarios: { label: "Funcionarios", color: COLORES.funcionarios },
  mascotas: { label: "Mascotas", color: COLORES.mascotas },
  atenciones: { label: "Atenciones", color: COLORES.atenciones },
  desayuno: { label: "Desayuno", color: COLORES.desayuno },
  almuerzo: { label: "Almuerzo", color: COLORES.almuerzo },
  cena: { label: "Cena", color: COLORES.cena },
  comidasTotal: { label: "Total comidas", color: COLORES.comidasTotal },
};

const VENTANAS: VentanaReporte[] = [7, 15, 30];

const SERIES = [
  { key: "refugiados" as const, yAxis: "pob" as const, ancho: 2, dash: undefined },
  { key: "funcionarios" as const, yAxis: "pob" as const, ancho: 2, dash: undefined },
  { key: "mascotas" as const, yAxis: "pob" as const, ancho: 1.5, dash: "4 3" },
  { key: "atenciones" as const, yAxis: "op" as const, ancho: 2, dash: undefined },
  { key: "desayuno" as const, yAxis: "op" as const, ancho: 1.5, dash: undefined },
  { key: "almuerzo" as const, yAxis: "op" as const, ancho: 1.5, dash: undefined },
  { key: "cena" as const, yAxis: "op" as const, ancho: 1.5, dash: undefined },
  { key: "comidasTotal" as const, yAxis: "op" as const, ancho: 2, dash: "5 3" },
];

function formatearDia(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}

interface Props {
  centroId: string;
  snapshots: SnapshotOcupacion[];
  reportes: ReporteDiario[];
  /** Día seleccionado en el calendario (YYYY-MM-DD) → línea vertical en el gráfico. */
  diaMarcado?: string | null;
  /** Botón u control extra en la cabecera (p. ej. pliegue del calendario). */
  accionCalendario?: ReactNode;
}

export function GraficoReporteCentro({
  centroId,
  snapshots,
  reportes,
  diaMarcado,
  accionCalendario,
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
    () => serieReporteCentro(centroId, snapshots, reportes, ventanaSerie, hoyClave),
    [centroId, snapshots, reportes, ventanaSerie, hoyClave],
  );

  const diaEnSerie = diaMarcado != null && serie.some((p) => p.dia === diaMarcado);

  const tieneDatos = useMemo(
    () =>
      serie.some(
        (p) =>
          p.refugiados > 0 ||
          p.funcionarios > 0 ||
          p.mascotas > 0 ||
          p.atenciones > 0 ||
          p.comidasTotal > 0,
      ),
    [serie],
  );

  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2">
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold">Evolución diaria</CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Población (izq.) · Comidas y atenciones (der.)
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {accionCalendario}
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
              className="aspect-auto min-h-[220px] w-full flex-1"
              initialDimension={{ width: 320, height: 220 }}
            >
              <LineChart data={serie} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="dia"
                  tickFormatter={formatearDia}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  minTickGap={ventanaSerie <= 7 ? 6 : 16}
                />
                <YAxis
                  yAxisId="pob"
                  orientation="left"
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => v.toLocaleString("es")}
                />
                <YAxis
                  yAxisId="op"
                  orientation="right"
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
                        return p?.dia ? `Día ${formatearDia(p.dia)}` : "";
                      }}
                    />
                  }
                />
                {diaEnSerie && (
                  <ReferenceLine
                    x={diaMarcado!}
                    yAxisId="pob"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    label={{
                      value: formatearDia(diaMarcado!),
                      position: "top",
                      fill: "#38bdf8",
                      fontSize: 10,
                    }}
                  />
                )}
                {SERIES.map(({ key, yAxis, ancho, dash }) => (
                  <Line
                    key={key}
                    yAxisId={yAxis}
                    type="monotone"
                    dataKey={key}
                    name={config[key]?.label as string}
                    stroke={COLORES[key]}
                    strokeWidth={ancho}
                    strokeDasharray={dash}
                    dot={false}
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
