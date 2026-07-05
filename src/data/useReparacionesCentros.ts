// Hook para leer reparaciones persistentes de `reparaciones_centros` con
// Realtime. Mismo patrón que `useIncidencias`.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarReparacion,
  type EstatusReparacion,
  type Reparacion,
} from "../domain/reparaciones";

interface Opciones {
  centroId?: string;
  estatus?: EstatusReparacion;
}

type FilaReparacion = Partial<Reparacion> & { id: string; centro_id: string };

export function useReparacionesCentros(opts: Opciones = {}): Reparacion[] {
  const { centroId, estatus } = opts;
  const [reparaciones, setReparaciones] = useState<Reparacion[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useReparacionesCentros:${centroId ?? "all"}:${estatus ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("reparaciones_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (estatus) q = q.eq("estatus", estatus);
      const { data, error } = await q.order("creada_ts", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useReparacionesCentros] error en select:", error.message);
        return;
      }
      setReparaciones(((data ?? []) as FilaReparacion[]).map(normalizarReparacion));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reparaciones_centros" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaReparacion;
            if (centroId && cruda.centro_id !== centroId) return;
            const fila = normalizarReparacion(cruda);
            if (estatus && fila.estatus !== estatus) {
              setReparaciones((prev) => prev.filter((r) => r.id !== fila.id));
              return;
            }
            setReparaciones((prev) =>
              prev.some((r) => r.id === fila.id)
                ? prev.map((r) => (r.id === fila.id ? fila : r))
                : [fila, ...prev],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setReparaciones((prev) => prev.filter((r) => r.id !== fila.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useReparacionesCentros] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, estatus]);

  return reparaciones;
}
