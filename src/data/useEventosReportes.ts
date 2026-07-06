// Hook para leer eventos del reporte diario (`eventos_reportes`) con Realtime.
// Permite consultar un centro, un día exacto o un rango `dia >= desde`.

import { useEffect, useState } from "react";
import {
  normalizarEventoReporte,
  type EventoReporte,
} from "../domain/eventosReportes";
import { supabase } from "./supabaseClient";

interface Opciones {
  centroId?: string;
  /** YYYY-MM-DD (día exacto) */
  dia?: string;
  /** YYYY-MM-DD (rango dia >= desde) */
  desde?: string;
}

type FilaEvento = Partial<EventoReporte> & { id: string; centro_id: string; dia: string };

function ordenarEventos(eventos: EventoReporte[]): EventoReporte[] {
  return [...eventos].sort(
    (a, b) =>
      a.dia.localeCompare(b.dia) ||
      a.ts - b.ts ||
      a.titulo.localeCompare(b.titulo, "es"),
  );
}

export function useEventosReportes(opts: Opciones = {}): EventoReporte[] {
  const { centroId, dia, desde } = opts;
  const [eventos, setEventos] = useState<EventoReporte[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useEventosReportes:${centroId ?? "all"}:${dia ?? "all"}:${desde ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("eventos_reportes").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (dia) q = q.eq("dia", dia);
      if (desde) q = q.gte("dia", desde);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useEventosReportes] error en select:", error.message);
        return;
      }
      setEventos(ordenarEventos(((data ?? []) as FilaEvento[]).map(normalizarEventoReporte)));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "eventos_reportes" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaEvento;
            if (centroId && cruda.centro_id !== centroId) return;
            if (dia && cruda.dia !== dia) return;
            if (desde && cruda.dia < desde) return;
            const fila = normalizarEventoReporte(cruda);
            setEventos((prev) =>
              ordenarEventos(
                prev.some((e) => e.id === fila.id)
                  ? prev.map((e) => (e.id === fila.id ? fila : e))
                  : [...prev, fila],
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as Partial<EventoReporte>;
            setEventos((prev) => prev.filter((e) => e.id !== fila.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useEventosReportes] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, dia, desde]);

  return eventos;
}
