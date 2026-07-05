// Hook para leer flags diarios de reparaciones (`reportes_reparaciones_dia`)
// con Realtime. Mismo patrón que `useReportesCentros`.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarReporteReparacionesDia,
  type ReporteReparacionesDia,
} from "../domain/reparaciones";

interface Opciones {
  centroId?: string;
  /** YYYY-MM-DD (día exacto) */
  dia?: string;
  /** YYYY-MM-DD (rango dia >= desde) */
  desde?: string;
}

type FilaReporte = Partial<ReporteReparacionesDia> & { centro_id: string; dia: string };

export function useReportesReparacionesDia(opts: Opciones = {}): ReporteReparacionesDia[] {
  const { centroId, dia, desde } = opts;
  const [reportes, setReportes] = useState<ReporteReparacionesDia[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useReportesReparacionesDia:${centroId ?? "all"}:${dia ?? "all"}:${desde ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("reportes_reparaciones_dia").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (dia) q = q.eq("dia", dia);
      if (desde) q = q.gte("dia", desde);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useReportesReparacionesDia] error en select:", error.message);
        return;
      }
      setReportes(((data ?? []) as FilaReporte[]).map(normalizarReporteReparacionesDia));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes_reparaciones_dia" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaReporte;
            if (centroId && cruda.centro_id !== centroId) return;
            if (dia && cruda.dia !== dia) return;
            if (desde && cruda.dia < desde) return;
            const fila = normalizarReporteReparacionesDia(cruda);
            setReportes((prev) =>
              prev.some((r) => r.centro_id === fila.centro_id && r.dia === fila.dia)
                ? prev.map((r) =>
                    r.centro_id === fila.centro_id && r.dia === fila.dia ? fila : r,
                  )
                : [...prev, fila],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as Partial<ReporteReparacionesDia>;
            setReportes((prev) =>
              prev.filter(
                (r) => !(r.centro_id === fila.centro_id && r.dia === fila.dia),
              ),
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useReportesReparacionesDia] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, dia, desde]);

  return reportes;
}
