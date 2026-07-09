// Hook para leer denuncias de damnificados (`denuncias_centros`) con
// Realtime. Mismo patrón que `useReportesCentros`: select inicial + suscripción
// `postgres_changes`. La RLS decide qué ve cada rol (el supervisor solo sus
// campamentos; el operador, nada). Por defecto excluye borrados suaves.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarDenuncia,
  type Denuncia,
  type EstadoDenuncia,
} from "../domain/denuncias";

interface Opciones {
  centroId?: string;
  /** YYYY-MM-DD */
  desde?: string;
  estado?: EstadoDenuncia;
  /**
   * `activas` (default): bandejas normales.
   * `eliminadas`: papelera (solo admin vía RLS).
   * `todas`: sin filtrar deleted (admin).
   */
  alcance?: "activas" | "eliminadas" | "todas";
}

type FilaDenuncia = Partial<Denuncia> & { id: string; centro_id: string; dia: string };

function pasaFiltros(
  fila: Denuncia,
  opts: { centroId?: string; desde?: string; estado?: EstadoDenuncia; alcance: string },
): boolean {
  if (opts.alcance === "activas" && fila.deleted) return false;
  if (opts.alcance === "eliminadas" && !fila.deleted) return false;
  if (opts.centroId && fila.centro_id !== opts.centroId) return false;
  if (opts.desde && fila.dia < opts.desde) return false;
  if (opts.estado && fila.estado !== opts.estado) return false;
  return true;
}

export function useDenuncias(opts: Opciones = {}): Denuncia[] {
  const { centroId, desde, estado, alcance = "activas" } = opts;
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useDenuncias:${centroId ?? "all"}:${desde ?? "all"}:${estado ?? "all"}:${alcance}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("denuncias_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (desde) q = q.gte("dia", desde);
      if (estado) q = q.eq("estado", estado);
      if (alcance === "activas") q = q.eq("deleted", false);
      if (alcance === "eliminadas") q = q.eq("deleted", true);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useDenuncias] error en select:", error.message);
        return;
      }
      setDenuncias(((data ?? []) as FilaDenuncia[]).map(normalizarDenuncia));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "denuncias_centros" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as FilaDenuncia;
            const fila = normalizarDenuncia(cruda);
            if (!pasaFiltros(fila, { centroId, desde, estado, alcance })) {
              setDenuncias((prev) => prev.filter((d) => d.id !== fila.id));
              return;
            }
            setDenuncias((prev) =>
              prev.some((d) => d.id === fila.id)
                ? prev.map((d) => (d.id === fila.id ? fila : d))
                : [...prev, fila],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setDenuncias((prev) => prev.filter((d) => d.id !== fila.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useDenuncias] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, desde, estado, alcance]);

  return denuncias;
}
