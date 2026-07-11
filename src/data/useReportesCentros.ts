// Hook para leer reportes diarios de `reportes_centros` desde Supabase con
// Realtime. Mismo patrón que `useOcupacionesCentros`: select inicial +
// suscripción `postgres_changes`. La clave lógica de la tabla es
// `(centro_id, dia)` (una fila por centro por día).
//
// Filtros opcionales:
// - `centroId`: filtra por `centro_id` (reportes de un centro).
// - `dia`: filtra un día exacto (YYYY-MM-DD), p. ej. el reporte de hoy.
// - `desde`: filtra `dia >= desde` (YYYY-MM-DD) para limitar el rango.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { normalizarReporte, type ReporteDiario } from "../domain/reporteDiario";
import { suscribirMutacionLive } from "./liveInvalidation";

interface Opciones {
  centroId?: string;
  /** YYYY-MM-DD (día exacto) */
  dia?: string;
  /** YYYY-MM-DD (rango dia >= desde) */
  desde?: string;
}

type FilaReporte = Partial<ReporteDiario> & { centro_id: string; dia: string };

function normalizarDiaFila(dia: string | unknown): string {
  return String(dia).slice(0, 10);
}

export function useReportesCentros(opts: Opciones = {}): ReporteDiario[] {
  const { centroId, dia, desde } = opts;
  const [reportes, setReportes] = useState<ReporteDiario[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      let q = supabase.from("reportes_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (dia) q = q.eq("dia", dia);
      if (desde) q = q.gte("dia", desde);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useReportesCentros] error en select:", error.message);
        return;
      }
      setReportes(
        ((data ?? []) as FilaReporte[]).map((f) =>
          normalizarReporte({ ...f, dia: normalizarDiaFila(f.dia) }),
        ),
      );
    }

    void cargar();
    const unsub = suscribirMutacionLive("reportes_centros", () => {
      void cargar();
    });

    const channelName = `useReportesCentros:${centroId ?? "all"}:${dia ?? "all"}:${desde ?? "all"}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes_centros" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaReporte;
            const diaFila = normalizarDiaFila(cruda.dia);
            if (centroId && cruda.centro_id !== centroId) return;
            if (dia && diaFila !== dia) return;
            if (desde && diaFila < desde) return;
            const fila = normalizarReporte({ ...cruda, dia: diaFila });
            setReportes((prev) =>
              prev.some((r) => r.centro_id === fila.centro_id && r.dia === fila.dia)
                ? prev.map((r) =>
                    r.centro_id === fila.centro_id && r.dia === fila.dia ? fila : r,
                  )
                : [...prev, fila],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string } & Partial<ReporteDiario>;
            const diaFila = fila.dia != null ? normalizarDiaFila(fila.dia) : null;
            setReportes((prev) =>
              prev.filter(
                (r) =>
                  !(r.centro_id === fila.centro_id && (diaFila == null || r.dia === diaFila)),
              ),
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useReportesCentros] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      unsub();
      void supabase.removeChannel(channel);
    };
  }, [centroId, dia, desde]);

  return reportes;
}
