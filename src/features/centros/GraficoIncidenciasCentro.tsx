// Gráfico temporal de incidencias de UN campamento: conteo diario por severidad.
// Ventana 7 / 15 / 30 días; línea vertical en el día seleccionado del calendario.

import { useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  META_ETIQUETA,
  serieIncidenciasCentroVentana,
  ultimosDiasIncidencias,
  type Incidencia,
  type VentanaSerieIncidencias,
} from "@/domain/incidencias";
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

const COLORES = {
  urgentes: META_ETIQUETA.urgente.color,
  importantes: META_ETIQUETA.importante.color,
  cotidianas: META_ETIQUETA.cotidiana.color,
} as const;

const config: ChartConfig = {
  urgentes: { label: "Urgentes", color: COLORES.urgentes },
  importantes: { label: "Importantes", color: COLORES.importantes },
  cotidianas: { label: "Cotidianas", color: COLORES.cotidianas },
};

const VENTANAS: VentanaSerieIncidencias[] = [7, 15, 30];

const SERIES = [
  { key: "urgentes" as const },
  { key: "importantes" as const },
  { key: "cotidianas" as const },
];

interface Props {
  incidencias: Incidencia[];
  diaMarcado?: string | null;
  accionCalendario?: ReactNode;
  abiertas?: number;
}

export function GraficoIncidenciasCentro({
  incidencias,
  diaMarcado,
  accionCalendario,
  abiertas = 0,
}: Props) {
  const [ventana, setVentana] = useState<VentanaSerieIncidencias>(7);
  const hoyClave = useMemo(() => claveDia(Date.now()), []);

  const ventanaSerie = useMemo((): VentanaSerieIncidencias => {
    if (!diaMarcado) return ventana;
    if (ultimosDiasIncidencias(ventana, hoyClave).includes(diaMarcado)) return ventana;
    if (ultimosDiasIncidencias(15, hoyClave).includes(diaMarcado)) return 15;
    return 30;
  }, [ventana, diaMarcado, hoyClave]);

  const serie = useMemo(
    () => serieIncidenciasCentroVentana(incidencias, ventanaSerie, hoyClave),
    [incidencias, ventanaSerie, hoyClave],
  );

  const diaEnSerie = diaMarcado != null && serie.some((p) => p.dia === diaMarcado);

  const tieneDatos = useMemo(() => serie.some((p) => p.total > 0), [serie]);

  const totalVentana = useMemo(
    () => serie.reduce((acc, p) => acc + p.total, 0),
    [serie],
  );

  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2">
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold">Evolución de incidencias</CardTitle>
          <p className="text-[10px] text-muted-foreground">
            {tieneDatos
              ? `${totalVentana} en ${ventanaSerie}d`
              : "Sin registros en el periodo"}
            {abiertas > 0 && (
              <>
                {" "}
                ·{" "}
                <span className={abiertas > 0 ? "text-amber-500" : undefined}>
                  {abiertas} abierta{abiertas === 1 ? "" : "s"}
                </span>
              </>
            )}
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
            Sin incidencias en los últimos {ventanaSerie} días.
          </p>
        ) : (
          <>
            <ChartContainer
              config={config}
              className="aspect-auto min-h-[220px] w-full flex-1"
              initialDimension={{ width: 320, height: 220 }}
            >
              <BarChart data={serie} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
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
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={24}
                  tick={{ fontSize: 10 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const p = payload?.[0]?.payload as { dia?: string; total?: number } | undefined;
                        return p?.dia
                          ? `Día ${formatearDiaCalendario(p.dia)} · ${p.total ?? 0} total`
                          : "";
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
                {SERIES.map(({ key }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={config[key]?.label as string}
                    stackId="incidencias"
                    fill={COLORES[key]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
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
