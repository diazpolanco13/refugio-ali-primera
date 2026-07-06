// Gráfico de población del campamento: damnificados, funcionarios y mascotas.
// Ventana 7 / 15 / 30 días; línea vertical en el día seleccionado del calendario.

import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  seriePoblacionCentroVentana,
  ultimosDiasSerie,
  type VentanaSeriePoblacion,
} from "@/domain/serieOcupacionCentros";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
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
  refugiados: "#38bdf8",
  funcionarios: "#a78bfa",
  mascotas: "#fbbf24",
} as const;

const config: ChartConfig = {
  refugiados: { label: "Damnificados", color: COLORES.refugiados },
  funcionarios: { label: "Funcionarios", color: COLORES.funcionarios },
  mascotas: { label: "Mascotas", color: COLORES.mascotas },
};

const VENTANAS: VentanaSeriePoblacion[] = [7, 15, 30];

const SERIES = [
  { key: "refugiados" as const, ancho: 2, dash: undefined },
  { key: "funcionarios" as const, ancho: 2, dash: undefined },
  { key: "mascotas" as const, ancho: 1.5, dash: "4 3" },
];

interface Props {
  centroId: string;
  snapshots: SnapshotOcupacion[];
  diaMarcado?: string | null;
  accionCalendario?: ReactNode;
}

export function GraficoPoblacionCentro({
  centroId,
  snapshots,
  diaMarcado,
  accionCalendario,
}: Props) {
  const [ventana, setVentana] = useState<VentanaSeriePoblacion>(7);
  const hoyClave = useMemo(() => claveDia(Date.now()), []);

  const ventanaSerie = useMemo((): VentanaSeriePoblacion => {
    if (!diaMarcado) return ventana;
    if (ultimosDiasSerie(ventana, hoyClave).includes(diaMarcado)) return ventana;
    if (ultimosDiasSerie(15, hoyClave).includes(diaMarcado)) return 15;
    return 30;
  }, [ventana, diaMarcado, hoyClave]);

  const serie = useMemo(
    () => seriePoblacionCentroVentana(centroId, snapshots, ventanaSerie, hoyClave),
    [centroId, snapshots, ventanaSerie, hoyClave],
  );

  const diaEnSerie = diaMarcado != null && serie.some((p) => p.dia === diaMarcado);

  const tieneDatos = useMemo(
    () => serie.some((p) => p.refugiados > 0 || p.funcionarios > 0 || p.mascotas > 0),
    [serie],
  );

  const ultimo = serie.length > 0 ? serie[serie.length - 1] : null;

  return (
    <Card className="flex h-full flex-col gap-0 py-0">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2">
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold">Evolución de población</CardTitle>
          {ultimo && (
            <p className="text-[10px] text-muted-foreground">
              Hoy: {ultimo.refugiados.toLocaleString("es")} damnif. ·{" "}
              {ultimo.funcionarios.toLocaleString("es")} func. ·{" "}
              {ultimo.mascotas.toLocaleString("es")} masc.
            </p>
          )}
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
            Sin histórico en los últimos {ventanaSerie} días. Se construye al registrar el
            parte numérico.
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
                  tickFormatter={formatearDiaCalendario}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  minTickGap={ventanaSerie <= 7 ? 6 : 16}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={32}
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
                {SERIES.map(({ key, ancho, dash }) => (
                  <Line
                    key={key}
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
