// Franja pública de incidente Nexus abierto, para /terreno y /censo (rutas
// sin login). Su misión es cortar el bombardeo de quejas en origen: deja
// claro que la falla es del sistema institucional, que ya está registrada
// (desde cuándo y cuánto lleva) y que no hace falta reportarla.
// No renderiza nada cuando no hay incidente abierto.

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { incidentesAbiertosPublico } from "@/data/reposEstadoServicios";
import {
  formatoDuracion,
  formatoHora,
  type IncidenteAbiertoPublico,
} from "@/domain/estadoServicios";
import { cn } from "@/lib/utils";

export function AvisoIncidenteNexus({ className }: { className?: string }) {
  const [incidente, setIncidente] = useState<IncidenteAbiertoPublico | null>(
    null,
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    void incidentesAbiertosPublico().then((lista) => {
      if (cancel) return;
      setIncidente(lista.find((i) => i.servicio === "nexus") ?? null);
    });
    return () => {
      cancel = true;
    };
  }, []);

  // Refresca la duración mostrada cada minuto mientras el incidente siga abierto.
  useEffect(() => {
    if (!incidente) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [incidente]);

  if (!incidente) return null;

  const duracion = formatoDuracion(Date.now() - incidente.inicio_ts);

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border border-amber-600/40 bg-amber-500/10 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <div className="min-w-0 text-left">
          <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
            Falla del sistema institucional NEXUS/SAIME desde las{" "}
            {formatoHora(incidente.inicio_ts)} ({duracion})
          </p>
          <p className="mt-0.5 text-xs leading-snug text-amber-900/80 dark:text-amber-100/80">
            No es una falla de esta plataforma. La caída ya está registrada y
            los analistas fueron notificados: no es necesario reportarla.
            Mientras tanto puede usar cédulas ya consultadas o la planilla
            manual.
          </p>
        </div>
      </div>
    </div>
  );
}
