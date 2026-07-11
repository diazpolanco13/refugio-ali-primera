// Hook para leer eventos del reporte diario (`eventos_reportes`) con Realtime.
// Permite consultar un centro, un día exacto o un rango `dia >= desde`.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizarEventoReporte,
  type EventoReporte,
} from "../domain/eventosReportes";
import { supabase } from "./supabaseClient";
import { suscribirMutacionLive } from "./liveInvalidation";

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

export function useEventosReportes(opts: Opciones = {}): {
  eventos: EventoReporte[];
  /** Refetch silencioso; llamar tras una mutación local (crear/editar/eliminar). */
  recargar: () => Promise<void>;
} {
  const { centroId, dia, desde } = opts;
  const [eventos, setEventos] = useState<EventoReporte[]>([]);
  const recargarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelado = false;
    const channelName = `useEventosReportes:${centroId ?? "all"}:${dia ?? "all"}:${desde ?? "all"}:${Math.random().toString(36).slice(2)}`;

    async function cargar() {
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
    }

    recargarRef.current = cargar;
    void cargar();
    const unsub = suscribirMutacionLive("eventos_reportes", () => {
      void cargar();
    });

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "eventos_reportes" },
        // Refetch completo: el payload DELETE a veces no trae `id` usable
        // (REPLICA IDENTITY) y la UI quedaba desactualizada tras eliminar.
        () => void cargar(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useEventosReportes] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      unsub();
      void supabase.removeChannel(channel);
    };
  }, [centroId, dia, desde]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { eventos, recargar };
}
