// Estado de reportes diarios de los centros visibles en la sala.
// Misma lógica de 6 bloques que ReportesDiariosRedView / estadoReporteDia.
// Lista partida: Incompleto / Completo, con resumen tipo censo.

import { Link } from "react-router-dom";
import {
  META_ESTADO_REPORTE,
  estadoReporteDia,
  eventosRevisados,
  type EstadoReporteDia,
  type ReporteDiario,
} from "@/domain/reporteDiario";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import type { ReporteControlDia } from "@/domain/controlReporte";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FilaReporteSala {
  centro: CentroTransitorio;
  estado: EstadoReporteDia;
  /** Timestamp de última actualización del reporte; 0 si no hay fila. */
  horaTs: number;
}

export function calcularFilasReportesSala(
  centros: CentroTransitorio[],
  reportesHoy: ReporteDiario[],
  diasConParteHoy: Set<string>,
  controlesHoy: ReporteControlDia[],
  snapshotsHoy: SnapshotOcupacion[],
  eventosPorCentro: Map<string, number>,
): FilaReporteSala[] {
  const reportePorCentro = new Map(reportesHoy.map((r) => [r.centro_id, r]));
  const controlRevisado = new Set(
    controlesHoy.filter((c) => c.revisado).map((c) => c.centro_id),
  );
  const snapPorCentro = new Map(snapshotsHoy.map((s) => [s.centro_id, s]));

  return [...centros]
    .map((centro) => {
      const reporte = reportePorCentro.get(centro.id);
      const tieneParte = diasConParteHoy.has(centro.id);
      const snap = snapPorCentro.get(centro.id);
      const estado = estadoReporteDia(reporte, tieneParte, {
        saludReportada:
          reporte?.salud_reportada === true || (snap?.incidencias_salud ?? 0) > 0,
        controlRevisado: controlRevisado.has(centro.id),
        trabajosRevisados: reporte?.trabajos_revisados === true,
        requerimientosRevisados: reporte?.requerimientos_revisados === true,
        eventosRevisados: eventosRevisados(
          reporte,
          eventosPorCentro.get(centro.id) ?? 0,
        ),
      });
      return {
        centro,
        estado,
        horaTs: reporte?.updated_at ?? 0,
      };
    })
    .sort(
      (a, b) =>
        b.horaTs - a.horaTs ||
        (a.centro.nro ?? 0) - (b.centro.nro ?? 0) ||
        a.centro.nombre.localeCompare(b.centro.nombre, "es"),
    );
}

function esCompleto(estado: EstadoReporteDia): boolean {
  return estado === "completo";
}

function etiquetaHora(estado: EstadoReporteDia, horaTs: number): string {
  if (estado === "pendiente" && horaTs <= 0) return "Sin iniciar";
  if (horaTs <= 0) return "En curso";
  return new Date(horaTs).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelEstado(estado: EstadoReporteDia, horaTs: number): string {
  if (estado === "pendiente" && horaTs <= 0) return "Sin iniciar";
  return META_ESTADO_REPORTE[estado].label;
}

function FilaCentro({
  fila,
  hoy,
}: {
  fila: FilaReporteSala;
  hoy: string;
}) {
  const { centro, estado, horaTs } = fila;
  const meta = META_ESTADO_REPORTE[estado];
  return (
    <Link
      to={`/centros/reportes/${centro.id}?vista=reporte&dia=${hoy}`}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-2.5 py-2",
        "transition-colors hover:bg-muted/50",
      )}
      style={{ borderLeft: `3px solid ${meta.color}` }}
    >
      <span className="min-w-0 truncate text-xs font-medium text-foreground">
        N.° {centro.nro ?? "?"} · {centro.nombre}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Badge
          variant="outline"
          className="px-1.5 py-0 text-[10px]"
          style={{ borderColor: `${meta.color}66`, color: meta.color }}
        >
          {labelEstado(estado, horaTs)}
        </Badge>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {etiquetaHora(estado, horaTs)}
        </span>
      </span>
    </Link>
  );
}

interface Props {
  filas: FilaReporteSala[];
  hoy: string;
}

export function PanelReportesSala({ filas, hoy }: Props) {
  if (filas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin centros asignados.</p>
    );
  }

  const incompletos = filas.filter((f) => !esCompleto(f.estado));
  const completos = filas.filter((f) => esCompleto(f.estado));
  const total = filas.length;
  const pct =
    total > 0 ? Math.round((completos.length / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Resumen red: acento esmeralda (completo) / ámbar si faltan */}
      <div
        className={cn(
          "rounded-lg border-l-4 px-2.5 py-2.5",
          incompletos.length > 0
            ? "border border-amber-500/40 border-l-amber-400 bg-amber-500/10"
            : "border border-emerald-500/40 border-l-emerald-400 bg-emerald-500/10",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                incompletos.length > 0 ? "text-amber-300" : "text-emerald-300",
              )}
            >
              Red · reportes del día
            </p>
            <p
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                incompletos.length > 0 ? "text-amber-50" : "text-emerald-50",
              )}
            >
              {completos.length.toLocaleString("es")}
              <span
                className={cn(
                  "text-sm font-normal",
                  incompletos.length > 0
                    ? "text-amber-200/70"
                    : "text-emerald-200/70",
                )}
              >
                {" "}
                / {total.toLocaleString("es")}
              </span>
              <span
                className={cn(
                  "ml-2 text-xs font-semibold",
                  incompletos.length > 0 ? "text-amber-300" : "text-emerald-300",
                )}
              >
                {pct}%
              </span>
            </p>
          </div>
          {incompletos.length > 0 ? (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-400/60 bg-amber-500/20 text-amber-200"
            >
              Incompletos · {incompletos.length}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
            >
              Todos completos
            </Badge>
          )}
        </div>
        <div
          className={cn(
            "mt-2 h-1.5 overflow-hidden rounded-full",
            incompletos.length > 0 ? "bg-amber-950/50" : "bg-emerald-950/50",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full",
              incompletos.length > 0 ? "bg-amber-400" : "bg-emerald-400",
            )}
            style={{ width: `${Math.max(pct, completos.length > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>

      {incompletos.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-300">
            Incompleto
            <Badge
              variant="outline"
              className="border-amber-500/50 px-1.5 py-0 text-[10px] text-amber-200"
            >
              {incompletos.length}
            </Badge>
          </p>
          <div className="space-y-1.5">
            {incompletos.map((fila) => (
              <FilaCentro key={fila.centro.id} fila={fila} hoy={hoy} />
            ))}
          </div>
        </div>
      )}

      {completos.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
            Completo
            <Badge
              variant="outline"
              className="border-emerald-500/50 px-1.5 py-0 text-[10px] text-emerald-200"
            >
              {completos.length}
            </Badge>
          </p>
          <div className="space-y-1.5">
            {completos.map((fila) => (
              <FilaCentro key={fila.centro.id} fila={fila} hoy={hoy} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Conteos para la cinta de alertas y franja plegada. */
export function conteoReportesPendientes(filas: FilaReporteSala[]): {
  sinIniciar: number;
  parciales: number;
  incompletos: number;
  completos: number;
} {
  let sinIniciar = 0;
  let parciales = 0;
  let completos = 0;
  for (const f of filas) {
    if (f.estado === "completo") completos += 1;
    else if (f.estado === "pendiente") sinIniciar += 1;
    else if (f.estado === "parcial" || f.estado === "solo_parte") parciales += 1;
  }
  return {
    sinIniciar,
    parciales,
    incompletos: sinIniciar + parciales,
    completos,
  };
}
