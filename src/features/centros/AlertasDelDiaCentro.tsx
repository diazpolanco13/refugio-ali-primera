// Tarjetas de alerta del día: reporte, incidencias y agua. Navegan a la
// pestaña correspondiente de la ficha cuando se pasa `onIrAPestana`.

import { useMemo } from "react";
import { ClipboardCheck, Droplets, Siren } from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useIncidencias } from "@/data/useIncidencias";
import { analisisCentro, COLOR_ESTADO_AGUA } from "@/domain/capacidadCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  estadoReporteDia,
  jornadasReportadas,
  META_ESTADO_REPORTE,
  reporteDelDia,
} from "@/domain/reporteDiario";
import { incidenciasAbiertas } from "@/domain/incidencias";
import { cn } from "@/lib/utils";

export type VistaFichaCentro =
  | "resumen"
  | "coordinacion"
  | "poblacion"
  | "reporte"
  | "incidencias"
  | "capacidad";

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
        alerta
          ? "border-amber-500/50"
          : "border-border",
        interactivo && "cursor-pointer hover:bg-muted/30 active:bg-muted/40",
        !interactivo && "cursor-default",
      )}
      style={
        alerta && colorAlerta
          ? { borderColor: `${colorAlerta}66` }
          : undefined
      }
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

/** Tres alertas clicables del día: reporte, incidencias y agua. */
export function AlertasDelDiaCentro({ centro, onIrAPestana }: Props) {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => {
    const [y, m, d] = hoy.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 7);
    return claveDia(dt.getTime());
  }, [hoy]);

  const reportes = useReportesCentros({ centroId: centro.id, desde });
  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });
  const incidencias = useIncidencias({ centroId: centro.id, desde });

  const reporteHoy = reporteDelDia(reportes, centro.id, hoy);
  const snapshotHoy = snapshots.find((s) => s.dia === hoy);
  const parteNumerico = Boolean(snapshotHoy);
  const estadoReporte = estadoReporteDia(reporteHoy, parteNumerico);
  const metaReporte = META_ESTADO_REPORTE[estadoReporte];
  const reporteAlerta = estadoReporte !== "completo";

  const jornadas = jornadasReportadas(reporteHoy).length;
  let detalleReporte = metaReporte.label;
  if (estadoReporte === "parcial") {
    detalleReporte = `${jornadas}/3 comidas${parteNumerico ? " · parte numérico" : ""}`;
  } else if (estadoReporte === "solo_parte") {
    detalleReporte = "Parte numérico sin comidas";
  } else if (estadoReporte === "pendiente") {
    detalleReporte = "Sin reporte hoy";
  }

  const abiertas = incidenciasAbiertas(incidencias);
  const urgentes = abiertas.filter((i) => i.etiqueta === "urgente");
  const incidenciasAlerta = urgentes.length > 0 || abiertas.length > 0;
  const detalleIncidencias =
    urgentes.length > 0
      ? `${urgentes.length} urgente${urgentes.length === 1 ? "" : "s"} abierta${urgentes.length === 1 ? "" : "s"}`
      : abiertas.length > 0
        ? `${abiertas.length} abierta${abiertas.length === 1 ? "" : "s"}`
        : "Sin incidencias abiertas";

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
        titulo="Incidencias"
        icono={<Siren className="size-4" />}
        detalle={detalleIncidencias}
        alerta={incidenciasAlerta}
        colorAlerta={urgentes.length > 0 ? "#ef4444" : "#f59e0b"}
        onClick={onIrAPestana ? () => onIrAPestana("incidencias") : undefined}
      />
      <TarjetaAlerta
        titulo="Agua"
        icono={<Droplets className="size-4" />}
        detalle={detalleAgua}
        alerta={aguaAlerta}
        colorAlerta={colorAgua}
        onClick={onIrAPestana ? () => onIrAPestana("capacidad") : undefined}
      />
    </div>
  );
}
