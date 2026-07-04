// Hook para leer incidencias de `incidencias_centros` desde Supabase con
// Realtime. Mismo patrón que `useOcupacionesCentros`: select inicial +
// suscripción `postgres_changes`. La PK de la tabla es `id` (uuid).
//
// Filtros opcionales:
// - `centroId`: filtra por `centro_id` (incidencias de un centro).
// - `desde`: filtra `dia >= desde` (YYYY-MM-DD) para limitar el rango.
// - `estado`: filtra por estado (`abierta` / `resuelta`).

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarIncidencia,
  type EstadoIncidencia,
  type Incidencia,
} from "../domain/incidencias";

interface Opciones {
  centroId?: string;
  /** YYYY-MM-DD */
  desde?: string;
  estado?: EstadoIncidencia;
}

type FilaIncidencia = Partial<Incidencia> & {
  id: string;
  centro_id: string;
  dia: string;
};

export function useIncidencias(opts: Opciones = {}): Incidencia[] {
  const { centroId, desde, estado } = opts;
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useIncidencias:${centroId ?? "all"}:${desde ?? "all"}:${estado ?? "all"}:${Math.random().toString(36).slice(2)}`;

    // 1) Carga inicial.
    (async () => {
      let q = supabase.from("incidencias_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (desde) q = q.gte("dia", desde);
      if (estado) q = q.eq("estado", estado);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useIncidencias] error en select:", error.message);
        return;
      }
      setIncidencias(((data ?? []) as FilaIncidencia[]).map(normalizarIncidencia));
    })();

    // 2) Realtime. Nota: con filtro `estado`, un UPDATE puede sacar una fila
    // del filtro (p. ej. abierta → resuelta con estado="abierta"): en ese caso
    // se retira del estado local.
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incidencias_centros" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaIncidencia;
            if (centroId && cruda.centro_id !== centroId) return;
            if (desde && cruda.dia < desde) return;
            const fila = normalizarIncidencia(cruda);
            if (estado && fila.estado !== estado) {
              setIncidencias((prev) => prev.filter((i) => i.id !== fila.id));
              return;
            }
            setIncidencias((prev) =>
              prev.some((i) => i.id === fila.id)
                ? prev.map((i) => (i.id === fila.id ? fila : i))
                : [...prev, fila],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setIncidencias((prev) => prev.filter((i) => i.id !== fila.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useIncidencias] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, desde, estado]);

  return incidencias;
}
