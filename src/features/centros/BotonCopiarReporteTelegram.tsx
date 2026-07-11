// Botón para copiar el parte diario en formato Telegram (portapapeles).
// Visible en la ficha (permisos globales y sesión de terreno / operador).

import { useState } from "react";
import { Check } from "lucide-react";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useEventosReportes } from "@/data/useEventosReportes";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import { useReportesCentros } from "@/data/useReportesCentros";
import { useReportesControlDia } from "@/data/useReportesControlDia";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import { casosAbiertosSeguimiento } from "@/domain/casosSalud";
import { reporteControlDelDia } from "@/domain/controlReporte";
import { eventosDelDia } from "@/domain/eventosReportes";
import { textoReporteTelegramCentro } from "@/domain/reporteTelegramCentro";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { IconoTelegram } from "@/components/IconoTelegram";
import { Button } from "@/components/ui/button";
import { copiarTexto } from "@/lib/portapapeles";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  dia: string;
  className?: string;
}

/** Copia el reporte del día al portapapeles (formato del grupo Telegram). */
export function BotonCopiarReporteTelegram({ centro, dia, className }: Props) {
  const [estadoCopia, setEstadoCopia] = useState<"idle" | "ok" | "error">("idle");

  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde: dia });
  const reportes = useReportesCentros({ centroId: centro.id, dia });
  const controles = useReportesControlDia({ centroId: centro.id, dia });
  const { eventos } = useEventosReportes({ centroId: centro.id, dia });
  const { trabajos } = useReparacionesCentros({ centroId: centro.id, soloActivos: true });
  const { requerimientos: requerimientosActivos } = useRequerimientosSeguimiento({
    centroId: centro.id,
    soloActivos: true,
  });
  const { casos: casosSalud } = useCasosSaludCentros({ centroId: centro.id, soloActivos: true });
  const casosSaludAbiertos = casosAbiertosSeguimiento(casosSalud);

  async function copiar() {
    const texto = textoReporteTelegramCentro({
      centro,
      dia,
      snapshot: snapshots.find((s) => s.dia === dia),
      reporte: reportes.find((r) => r.dia === dia),
      controlDia: reporteControlDelDia(controles, centro.id, dia),
      eventosDia: eventosDelDia(eventos, centro.id, dia),
      trabajosActivos: trabajos,
      requerimientosActivos,
      casosSaludAbiertos,
    });
    const ok = await copiarTexto(texto);
    setEstadoCopia(ok ? "ok" : "error");
    window.setTimeout(() => setEstadoCopia("idle"), 2500);
  }

  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        "h-8 shrink-0 gap-1.5 bg-teal-600 text-xs text-white shadow-sm hover:bg-teal-500",
        className,
      )}
      onClick={() => void copiar()}
    >
      {estadoCopia === "ok" ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          Copiado
        </>
      ) : estadoCopia === "error" ? (
        "No se pudo copiar"
      ) : (
        <>
          <IconoTelegram className="size-3.5" />
          COPIAR REPORTE
        </>
      )}
    </Button>
  );
}
