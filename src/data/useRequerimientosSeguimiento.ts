import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarRequerimientoSeguimiento,
  type RequerimientoSeguimiento,
} from "../domain/requerimientosSeguimiento";

interface Opciones {
  centroId?: string;
  soloActivos?: boolean;
}

type Fila = Partial<RequerimientoSeguimiento> & { id: string; centro_id: string };

export function useRequerimientosSeguimiento(opts: Opciones = {}): RequerimientoSeguimiento[] {
  const { centroId, soloActivos = false } = opts;
  const [items, setItems] = useState<RequerimientoSeguimiento[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useRequerimientosSeguimiento:${centroId ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("requerimientos_seguimiento").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (soloActivos) q = q.neq("estatus", "archivado");
      const { data, error } = await q.order("creada_ts", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useRequerimientosSeguimiento] select:", error.message);
        return;
      }
      setItems(((data ?? []) as Fila[]).map(normalizarRequerimientoSeguimiento));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requerimientos_seguimiento" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as Fila;
            if (centroId && cruda.centro_id !== centroId) return;
            const fila = normalizarRequerimientoSeguimiento(cruda);
            if (soloActivos && fila.estatus === "archivado") {
              setItems((prev) => prev.filter((r) => r.id !== fila.id));
              return;
            }
            setItems((prev) =>
              prev.some((r) => r.id === fila.id)
                ? prev.map((r) => (r.id === fila.id ? fila : r))
                : [fila, ...prev],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setItems((prev) => prev.filter((r) => r.id !== fila.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, soloActivos]);

  return items;
}
