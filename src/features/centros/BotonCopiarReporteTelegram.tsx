// Botón para compartir el parte diario en Telegram (share + copia de respaldo).
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
import { abrirTelegramCompartir } from "@/lib/contacto";
import { copiarTexto } from "@/lib/portapapeles";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  dia: string;
  className?: string;
}

/** Copia el reporte y abre la app Telegram en el selector de chat. */
export function BotonCopiarReporteTelegram({ centro, dia, className }: Props) {
  const [estado, setEstado] = useState<"idle" | "ok" | "copiado" | "error">("idle");

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

  async function compartir() {
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

    // Siempre en portapapeles (si el deep link trunca, pegar en el chat).
    const copiado = await copiarTexto(texto);
    const resultado = await abrirTelegramCompartir(texto);

    if (resultado === "app" || resultado === "web") {
      setEstado("ok");
    } else if (copiado) {
      setEstado("copiado");
    } else {
      setEstado("error");
    }
    window.setTimeout(() => setEstado("idle"), 2500);
  }

  return (
    <Button
      type="button"
      size="sm"
      className={cn(
        "h-8 shrink-0 gap-1.5 bg-teal-600 text-xs text-white shadow-sm hover:bg-teal-500",
        className,
      )}
      onClick={() => void compartir()}
    >
      {estado === "ok" ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          Abierto en Telegram
        </>
      ) : estado === "copiado" ? (
        <>
          <Check className="size-3.5 text-emerald-400" />
          Copiado — pega en Telegram
        </>
      ) : estado === "error" ? (
        "No se pudo compartir"
      ) : (
        <>
          <IconoTelegram className="size-3.5" />
          Compartir en Telegram
        </>
      )}
    </Button>
  );
}
