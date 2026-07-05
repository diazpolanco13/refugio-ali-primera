// Hook para leer áreas de infraestructura de `areas_infraestructura_centros` con
// Realtime. Mismo patrón que `useReparacionesCentros`.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarAreaInfraestructura,
  type AreaInfraestructura,
  type EstadoInfraestructura,
} from "../domain/infraestructura";

interface Opciones {
  centroId?: string;
  estado?: EstadoInfraestructura;
}

type FilaArea = Partial<AreaInfraestructura> & { id: string; centro_id: string };

export function useAreasInfraestructura(opts: Opciones = {}): AreaInfraestructura[] {
  const { centroId, estado } = opts;
  const [areas, setAreas] = useState<AreaInfraestructura[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useAreasInfraestructura:${centroId ?? "all"}:${estado ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("areas_infraestructura_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (estado) q = q.eq("estado", estado);
      const { data, error } = await q.order("creada_ts", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useAreasInfraestructura] error en select:", error.message);
        return;
      }
      setAreas(((data ?? []) as FilaArea[]).map(normalizarAreaInfraestructura));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "areas_infraestructura_centros" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaArea;
            if (centroId && cruda.centro_id !== centroId) return;
            const fila = normalizarAreaInfraestructura(cruda);
            if (estado && fila.estado !== estado) {
              setAreas((prev) => prev.filter((a) => a.id !== fila.id));
              return;
            }
            setAreas((prev) =>
              prev.some((a) => a.id === fila.id)
                ? prev.map((a) => (a.id === fila.id ? fila : a))
                : [fila, ...prev],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setAreas((prev) => prev.filter((a) => a.id !== fila.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useAreasInfraestructura] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, estado]);

  return areas;
}
