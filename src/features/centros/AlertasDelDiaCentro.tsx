// Tarjetas de alerta del día: reporte, incidencias del reporte y agua.

import { useMemo } from "react";
import { ClipboardCheck, Droplets, Stethoscope } from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesControlDia } from "@/data/useReportesControlDia";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { analisisCentro, COLOR_ESTADO_AGUA } from "@/domain/capacidadCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { controlReportado, reporteControlDelDia } from "@/domain/controlReporte";
import {
  estadoReporteDia,
  eventosRevisados,
  META_ESTADO_REPORTE,
  reporteDelDia,
} from "@/domain/reporteDiario";
import { casosSaludPendientes } from "@/domain/seguimientoReportes";
import { cn } from "@/lib/utils";

export type VistaFichaCentro =
  | "resumen"
  | "coordinacion"
  | "poblacion"
  | "reporte"
  | "incidencias"
  | "infraestructura";

interface Props {
  centro: CentroTransitorio;
  onIrAPestana?: (vista: VistaFichaCentro) => void;
}

function TarjetaAlerta({
  titulo,
  icono,
  detalle,
  alerta,
  colorAlerta,
  onClick,
}: {
  titulo: string;
  icono: React.ReactNode;
  detalle: string;
  alerta: boolean;
  colorAlerta?: string;
  onClick?: () => void;
}) {
  const interactivo = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!interactivo}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card px-3 py-2.5 text-left transition-colors",
        alerta ? "border-amber-500/50" : "border-border",
        interactivo && "cursor-pointer hover:bg-muted/30 active:bg-muted/40",
        !interactivo && "cursor-default",
      )}
      style={alerta && colorAlerta ? { borderColor: `${colorAlerta}66` } : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-muted-foreground">{icono}</span>
        <span className="text-xs font-semibold text-foreground">{titulo}</span>
      </div>
      <p
        className={cn(
          "mt-1 truncate text-[11px]",
          alerta ? "text-foreground" : "text-muted-foreground",
        )}
        style={alerta && colorAlerta ? { color: colorAlerta } : undefined}
      >
        {detalle}
      </p>
    </button>
  );
}

/** Tres alertas clicables del día: reporte, incidencias del reporte y agua. */
export function AlertasDelDiaCentro({ centro, onIrAPestana }: Props) {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => {
    const [y, m, d] = hoy.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 7);
    return claveDia(dt.getTime());
  }, [hoy]);

  const reportes = useReportesCentros({ centroId: centro.id, desde });
  const controles = useReportesControlDia({ centroId: centro.id, desde });
  const eventos = useEventosReportes({ centroId: centro.id, desde });
  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });
  const casos = useCasosSaludCentros({ centroId: centro.id, soloActivos: true });

  const reporteHoy = reporteDelDia(reportes, centro.id, hoy);
  const snapshotHoy = snapshots.find((s) => s.dia === hoy);
  const parteNumerico = Boolean(snapshotHoy);
  const controlHoy = reporteControlDelDia(controles, centro.id, hoy);
  const eventosHoy = eventos.filter((e) => e.dia === hoy);
  const negativasHoy = eventosHoy.filter((e) => e.tipo === "negativo").length;
  const estadoReporte = estadoReporteDia(reporteHoy, parteNumerico, {
    controlRevisado: controlReportado(controlHoy),
    trabajosRevisados: reporteHoy?.trabajos_revisados ?? false,
    requerimientosRevisados: reporteHoy?.requerimientos_revisados ?? false,
    eventosRevisados: eventosRevisados(reporteHoy, eventosHoy.length),
  });
  const metaReporte = META_ESTADO_REPORTE[estadoReporte];
  const reporteAlerta = estadoReporte !== "completo";

  let detalleReporte = metaReporte.label;
  if (estadoReporte === "parcial") {
    detalleReporte = [
      parteNumerico ? "parte" : null,
      controlReportado(controlHoy) ? "control" : null,
      reporteHoy?.trabajos_revisados ? "trabajos" : null,
      reporteHoy?.requerimientos_revisados ? "req." : null,
      eventosRevisados(reporteHoy, eventosHoy.length) ? "novedades" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (estadoReporte === "solo_parte") {
    detalleReporte = "Solo parte numérico";
  } else if (estadoReporte === "pendiente") {
    detalleReporte = "Sin reporte hoy";
  }

  const casosActivos = casosSaludPendientes(casos);
  const incidenciasAlerta = casosActivos.length > 0 || negativasHoy > 0;
  const detalleIncidencias =
    casosActivos.length > 0
      ? `${casosActivos.length} caso${casosActivos.length === 1 ? "" : "s"} de salud activo${casosActivos.length === 1 ? "" : "s"}`
      : negativasHoy > 0
        ? `${negativasHoy} novedad${negativasHoy === 1 ? "" : "es"} negativa${negativasHoy === 1 ? "" : "s"} hoy`
        : eventosHoy.length > 0
          ? `${eventosHoy.length} novedad${eventosHoy.length === 1 ? "" : "es"} hoy`
          : "Sin incidencias activas";

  const analisis = analisisCentro(centro);
  const agua = analisis.agua;
  const aguaAlerta =
    !agua.medido || agua.estado === "critico" || agua.estado === "atencion";
  const colorAgua = COLOR_ESTADO_AGUA[agua.estado];
  let detalleAgua = agua.recomendacion;
  if (agua.medido && agua.autonomiaDias != null) {
    const dias =
      agua.autonomiaDias < 1
        ? "< 1 día"
        : `~${Math.floor(agua.autonomiaDias)} día${Math.floor(agua.autonomiaDias) === 1 ? "" : "s"}`;
    detalleAgua = `Autonomía ${dias} · ${agua.recomendacion}`;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <TarjetaAlerta
        titulo="Reporte hoy"
        icono={<ClipboardCheck className="size-4" />}
        detalle={detalleReporte}
        alerta={reporteAlerta}
        colorAlerta={metaReporte.color}
        onClick={onIrAPestana ? () => onIrAPestana("reporte") : undefined}
      />
      <TarjetaAlerta
        titulo="Seguimiento"
        icono={<Stethoscope className="size-4" />}
        detalle={detalleIncidencias}
        alerta={incidenciasAlerta}
        colorAlerta={casosActivos.length > 0 ? "#ef4444" : "#f59e0b"}
        onClick={onIrAPestana ? () => onIrAPestana("incidencias") : undefined}
      />
      <TarjetaAlerta
        titulo="Agua"
        icono={<Droplets className="size-4" />}
        detalle={detalleAgua}
        alerta={aguaAlerta}
        colorAlerta={colorAgua}
        onClick={onIrAPestana ? () => onIrAPestana("infraestructura") : undefined}
      />
    </div>
  );
}
