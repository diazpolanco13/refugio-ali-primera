import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarReporteControlDia,
  type ReporteControlDia,
} from "../domain/controlReporte";

interface Opciones {
  centroId?: string;
  dia?: string;
  desde?: string;
}

type Fila = Partial<ReporteControlDia> & { centro_id: string; dia: string };

export function useReportesControlDia(opts: Opciones = {}): ReporteControlDia[] {
  const { centroId, dia, desde } = opts;
  const [reportes, setReportes] = useState<ReporteControlDia[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useReportesControlDia:${centroId ?? "all"}:${dia ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("reportes_control_dia").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (dia) q = q.eq("dia", dia);
      if (desde) q = q.gte("dia", desde);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useReportesControlDia] select:", error.message);
        return;
      }
      setReportes(((data ?? []) as Fila[]).map(normalizarReporteControlDia));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reportes_control_dia" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as Fila;
            if (centroId && cruda.centro_id !== centroId) return;
            if (dia && cruda.dia !== dia) return;
            if (desde && cruda.dia < desde) return;
            const fila = normalizarReporteControlDia(cruda);
            setReportes((prev) =>
              prev.some((r) => r.centro_id === fila.centro_id && r.dia === fila.dia)
                ? prev.map((r) =>
                    r.centro_id === fila.centro_id && r.dia === fila.dia ? fila : r,
                  )
                : [...prev, fila],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as Partial<ReporteControlDia>;
            setReportes((prev) =>
              prev.filter(
                (r) => !(r.centro_id === fila.centro_id && r.dia === fila.dia),
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, dia, desde]);

  return reportes;
}
