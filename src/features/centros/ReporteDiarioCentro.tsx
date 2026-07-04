// Sección "Reporte del día" de la ficha del centro: muestra el estado del
// reporte de HOY (qué jornadas de comida ya se reportaron, raciones totales,
// atenciones médicas y si el parte numérico se actualizó hoy) con un
// indicador de pendiente. Se consume igual que las demás `Seccion*Centro` de
// `DetalleCentro.tsx`, tanto en el panel lateral como en `FichaCentroView`.
// Incluye el botón que abre `ReporteDiarioForm` (solo roles que editan).

import { useMemo, useState } from "react";
import { CircleCheck, CircleDashed, ClipboardCheck, Stethoscope, UtensilsCrossed } from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  CATALOGO_JORNADAS_REPORTE,
  jornadasReportadas,
  racionesDelDia,
  reporteCompleto,
  reporteDelDia,
} from "@/domain/reporteDiario";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReporteDiarioForm } from "./ReporteDiarioForm";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
}

/** Chip de estado de un ítem del reporte (jornada o parte numérico). */
function ChipReporte({ etiqueta, listo }: { etiqueta: string; listo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        listo
          ? "border-emerald-500/40 text-emerald-400"
          : "border-border text-muted-foreground",
      )}
    >
      {listo ? <CircleCheck className="size-3" /> : <CircleDashed className="size-3" />}
      {etiqueta}
    </span>
  );
}

/** Estado del reporte diario de HOY del centro, con acceso al formulario. */
export function SeccionReporteDiarioCentro({ centro, puedeEditar }: Props) {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const [reportando, setReportando] = useState(false);

  // Comidas + atención médica de hoy (tabla `reportes_centros`).
  const reportes = useReportesCentros({ centroId: centro.id, dia: hoy });
  const reporte = reporteDelDia(reportes, centro.id, hoy);
  const jornadas = jornadasReportadas(reporte);
  const raciones = racionesDelDia(reporte);
  const atenciones = reporte?.atenciones_medicas ?? 0;

  // ¿El parte numérico (población) se actualizó hoy? Lo dice el snapshot
  // diario de `ocupaciones_centros`, que escribe `guardarCentro()`.
  const snapshotsHoy = useOcupacionesCentros({ centroId: centro.id, desde: hoy });
  const parteHoy = snapshotsHoy.some((s) => s.dia === hoy);

  const completo = reporteCompleto(reporte) && parteHoy;
  const nadaReportado = !parteHoy && jornadas.length === 0 && !reporte;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ClipboardCheck className="size-3.5" />
          Reporte del día
        </p>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            completo
              ? "border-emerald-500/40 text-emerald-400"
              : "border-amber-500/40 text-amber-500",
          )}
        >
          {completo ? "Completo" : "Pendiente"}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ChipReporte etiqueta="Parte numérico" listo={parteHoy} />
        {CATALOGO_JORNADAS_REPORTE.map((j) => (
          <ChipReporte
            key={j.valor}
            etiqueta={j.label}
            listo={jornadas.includes(j.valor)}
          />
        ))}
      </div>

      {nadaReportado ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Este centro aún no reporta nada hoy.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 bg-muted/15 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <UtensilsCrossed className="size-3.5 text-teal-400" />
              {raciones.toLocaleString("es")}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Raciones del día
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/15 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-lg font-bold tabular-nums leading-none text-foreground">
              <Stethoscope className="size-3.5 text-rose-400" />
              {atenciones.toLocaleString("es")}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
              Atenciones médicas
            </div>
          </div>
        </div>
      )}

      {reporte?.observaciones && (
        <p className="mt-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
          {reporte.observaciones}
        </p>
      )}

      {puedeEditar && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => setReportando(true)}
        >
          <ClipboardCheck className="size-4" />
          {reporte || parteHoy ? "Editar reporte del día" : "Reporte del día"}
        </Button>
      )}

      {reportando && (
        <ReporteDiarioForm centro={centro} onCerrar={() => setReportando(false)} />
      )}
    </div>
  );
}
