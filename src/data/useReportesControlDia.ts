import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { selectPaginado } from "./selectPaginado";
import {
  normalizarReporteControlDia,
  type ReporteControlDia,
} from "../domain/controlReporte";
import { suscribirMutacionLive } from "./liveInvalidation";

interface Opciones {
  centroId?: string;
  dia?: string;
  desde?: string;
}

type Fila = Partial<ReporteControlDia> & { centro_id: string; dia: string };

function normalizarDia(dia: string | unknown): string {
  return String(dia).slice(0, 10);
}

export function useReportesControlDia(opts: Opciones = {}): ReporteControlDia[] {
  const { centroId, dia, desde } = opts;
  const [reportes, setReportes] = useState<ReporteControlDia[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      // Paginado: PostgREST corta en 1000 filas sin avisar (ver selectPaginado).
      const { data, error } = await selectPaginado(() => {
        let q = supabase.from("reportes_control_dia").select("*").order("dia").order("centro_id");
        if (centroId) q = q.eq("centro_id", centroId);
        if (dia) q = q.eq("dia", dia);
        if (desde) q = q.gte("dia", desde);
        return q;
      });
      if (cancelado) return;
      if (error) {
        console.warn("[useReportesControlDia] select:", error.message);
        return;
      }
      setReportes(
        ((data ?? []) as Fila[]).map((f) =>
          normalizarReporteControlDia({ ...f, dia: normalizarDia(f.dia) }),
        ),
      );
    }

    void cargar();
    const unsub = suscribirMutacionLive("reportes_control_dia", () => {
      void cargar();
    });

    const channelName = `useReportesControlDia:${centroId ?? "all"}:${dia ?? "all"}:${desde ?? "all"}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes_control_dia" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as Fila;
            const diaFila = normalizarDia(cruda.dia);
            if (centroId && cruda.centro_id !== centroId) return;
            if (dia && diaFila !== dia) return;
            if (desde && diaFila < desde) return;
            const fila = normalizarReporteControlDia({ ...cruda, dia: diaFila });
            setReportes((prev) =>
              prev.some((r) => r.centro_id === fila.centro_id && r.dia === fila.dia)
                ? prev.map((r) =>
                    r.centro_id === fila.centro_id && r.dia === fila.dia ? fila : r,
                  )
                : [...prev, fila],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as Partial<ReporteControlDia>;
            const diaFila = fila.dia != null ? normalizarDia(fila.dia) : null;
            setReportes((prev) =>
              prev.filter(
                (r) =>
                  !(r.centro_id === fila.centro_id && (diaFila == null || r.dia === diaFila)),
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      unsub();
      void supabase.removeChannel(channel);
    };
  }, [centroId, dia, desde]);

  return reportes;
}
