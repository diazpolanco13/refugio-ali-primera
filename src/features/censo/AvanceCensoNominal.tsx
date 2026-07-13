// Bloque compartido: avance del censo nominal vs parte numérico del reporte diario.
// Usado por el censador (terreno) y por la ficha de reportes del campamento.

import { Users } from "lucide-react";
import type { ProgresoCenso } from "@/domain/refugiados";
import type { MetricasDemograficasNominal } from "@/features/censo/metricasDemograficasNominal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function BarraAvanceCenso({
  etiqueta,
  actual,
  meta,
  pct,
}: {
  etiqueta: string;
  actual: number;
  meta: number;
  pct: number;
}) {
  const faltan = Math.max(0, meta - actual);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{etiqueta}</span>
        <span className="tabular-nums text-muted-foreground">
          {actual.toLocaleString("es")} / {meta.toLocaleString("es")}
          {faltan > 0 ? (
            <span className="ml-1 text-amber-500">
              (faltan {faltan.toLocaleString("es")})
            </span>
          ) : null}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function KpiChip({
  label,
  valor,
  alerta,
  activo,
  onClick,
}: {
  label: string;
  valor: number;
  alerta?: boolean;
  activo?: boolean;
  onClick?: () => void;
}) {
  const Contenido = (
    <>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          alerta && valor > 0 && "text-amber-400",
          activo && "text-primary-foreground",
        )}
      >
        {valor.toLocaleString("es")}
      </p>
      <p
        className={cn(
          "text-[10px] leading-tight uppercase tracking-wide text-muted-foreground",
          activo && "text-primary-foreground/80",
        )}
      >
        {label}
      </p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "rounded-lg border px-2 py-2 text-center transition-colors",
          activo
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-muted/30 hover:bg-muted/60",
        )}
      >
        {Contenido}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2 py-2 text-center">
      {Contenido}
    </div>
  );
}

export type FiltroKpiDemografico =
  | "embarazadas"
  | "discapacidad"
  | "adultos_mayores"
  | "enfermedad"
  | "desaparecidos"
  | "critico"
  | "mujeres"
  | "hombres"
  | null;

interface Props {
  centroNombre: string;
  progreso: ProgresoCenso;
  /** Barra extra cuando hay registros del staging (censo anterior). */
  censoAnterior?: { verificados: number; total: number } | null;
  /** KPIs demográficos del nominal (solo reportes / panel amplio). */
  demografia?: MetricasDemograficasNominal | null;
  /** Filtro activo al pulsar un KPI (opcional). */
  filtroKpi?: FiltroKpiDemografico;
  onFiltroKpi?: (filtro: FiltroKpiDemografico) => void;
  className?: string;
}

export function AvanceCensoNominal({
  centroNombre,
  progreso,
  censoAnterior = null,
  demografia = null,
  filtroKpi = null,
  onFiltroKpi,
  className,
}: Props) {
  const tieneParte = progreso.metaRefugiados > 0 || progreso.metaFamilias > 0;
  const faltanRefugiados = Math.max(
    0,
    progreso.metaRefugiados - progreso.registradosRefugiados,
  );
  const faltanFamilias = Math.max(
    0,
    progreso.metaFamilias - progreso.registradosFamilias,
  );

  function toggleKpi(f: FiltroKpiDemografico) {
    if (!onFiltroKpi) return;
    onFiltroKpi(filtroKpi === f ? null : f);
  }

  return (
    <Card className={className ?? "shadow-lg"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Avance del censo
        </CardTitle>
        <p className="truncate text-xs text-muted-foreground">
          {centroNombre} · vs parte numérico del reporte diario
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Damnificados
            </p>
            <p className="text-xl font-semibold tabular-nums text-primary">
              {progreso.registradosRefugiados.toLocaleString("es")}
            </p>
            <p className="text-[10px] tabular-nums text-muted-foreground">
              {tieneParte
                ? `de ${progreso.metaRefugiados.toLocaleString("es")} · faltan ${faltanRefugiados.toLocaleString("es")}`
                : "sin parte"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Familias
            </p>
            <p className="text-xl font-semibold tabular-nums text-violet-400">
              {progreso.registradosFamilias.toLocaleString("es")}
            </p>
            <p className="text-[10px] tabular-nums text-muted-foreground">
              {tieneParte
                ? `de ${progreso.metaFamilias.toLocaleString("es")} · faltan ${faltanFamilias.toLocaleString("es")}`
                : "sin parte"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Parte pers.
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {tieneParte ? progreso.metaRefugiados.toLocaleString("es") : "—"}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Parte fam.
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {tieneParte ? progreso.metaFamilias.toLocaleString("es") : "—"}
            </p>
          </div>
        </div>

        {tieneParte ? (
          <>
            <BarraAvanceCenso
              etiqueta="Damnificados"
              actual={progreso.registradosRefugiados}
              meta={progreso.metaRefugiados}
              pct={progreso.pctRefugiados}
            />
            <BarraAvanceCenso
              etiqueta="Familias"
              actual={progreso.registradosFamilias}
              meta={progreso.metaFamilias}
              pct={progreso.pctFamilias}
            />
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Aún no hay parte numérico para contrastar. Se actualiza al guardar el
            reporte diario del campamento.
          </p>
        )}
        {censoAnterior && censoAnterior.total > 0 ? (
          <BarraAvanceCenso
            etiqueta="Censo anterior verificado"
            actual={censoAnterior.verificados}
            meta={censoAnterior.total}
            pct={Math.round(
              (censoAnterior.verificados / censoAnterior.total) * 100,
            )}
          />
        ) : null}

        {demografia && demografia.total > 0 ? (
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <p className="text-[11px] font-medium text-muted-foreground">
              Demografía del censo nominal
              {onFiltroKpi ? " · pulse un KPI para filtrar la tabla" : ""}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              <KpiChip
                label="Mujeres"
                valor={demografia.mujeres}
                activo={filtroKpi === "mujeres"}
                onClick={onFiltroKpi ? () => toggleKpi("mujeres") : undefined}
              />
              <KpiChip
                label="Hombres"
                valor={demografia.hombres}
                activo={filtroKpi === "hombres"}
                onClick={onFiltroKpi ? () => toggleKpi("hombres") : undefined}
              />
              <KpiChip
                label="Embarazadas"
                valor={demografia.embarazadas}
                alerta
                activo={filtroKpi === "embarazadas"}
                onClick={
                  onFiltroKpi ? () => toggleKpi("embarazadas") : undefined
                }
              />
              <KpiChip
                label="Discapacidad"
                valor={demografia.discapacidad}
                alerta
                activo={filtroKpi === "discapacidad"}
                onClick={
                  onFiltroKpi ? () => toggleKpi("discapacidad") : undefined
                }
              />
              <KpiChip
                label="Adultos 60+"
                valor={demografia.adultosMayores}
                alerta
                activo={filtroKpi === "adultos_mayores"}
                onClick={
                  onFiltroKpi ? () => toggleKpi("adultos_mayores") : undefined
                }
              />
              <KpiChip
                label="Enfermedad"
                valor={demografia.conEnfermedad}
                alerta
                activo={filtroKpi === "enfermedad"}
                onClick={
                  onFiltroKpi ? () => toggleKpi("enfermedad") : undefined
                }
              />
              <KpiChip
                label="Hogares desaparec."
                valor={demografia.hogaresConDesaparecidos}
                alerta
                activo={filtroKpi === "desaparecidos"}
                onClick={
                  onFiltroKpi ? () => toggleKpi("desaparecidos") : undefined
                }
              />
              <KpiChip
                label="Hogares críticos"
                valor={demografia.hogaresCriticos}
                alerta
                activo={filtroKpi === "critico"}
                onClick={onFiltroKpi ? () => toggleKpi("critico") : undefined}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
