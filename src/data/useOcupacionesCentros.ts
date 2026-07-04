// Hook para leer snapshots de `ocupaciones_centros` desde Supabase con
// Realtime. Reemplaza al `useLiveQuery` de Dexie para esta tabla tipada (no
// blob): la fila tal cual llega de Postgres es ya el `SnapshotOcupacion`.
//
// Filtros opcionales:
// - `centroId`: filtra por `centro_id` (serie de un centro).
// - `desde`: filtra `dia >= desde` (YYYY-MM-DD) para limitar el rango.
//
// Realtime: suscripción `postgres_changes` a `ocupaciones_centros`. En
// insert/update refresca el snapshot afectado en el estado; en delete lo
// retira. La PK de la tabla es `id` (uuid).

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { SnapshotOcupacion } from "../domain/serieOcupacionCentros";

interface Opciones {
  centroId?: string;
  /** YYYY-MM-DD */
  desde?: string;
}

export function useOcupacionesCentros(opts: Opciones = {}): SnapshotOcupacion[] {
  const { centroId, desde } = opts;
  const [snapshots, setSnapshots] = useState<SnapshotOcupacion[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useOcupacionesCentros:${centroId ?? "all"}:${desde ?? "all"}:${Math.random().toString(36).slice(2)}`;

    // 1) Carga inicial.
    (async () => {
      let q = supabase.from("ocupaciones_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (desde) q = q.gte("dia", desde);
      const { data, error } = await q;
      if (cancelado) return;
      if (error) {
        console.warn("[useOcupacionesCentros] error en select:", error.message);
        return;
      }
      setSnapshots((data ?? []) as SnapshotOcupacion[]);
    })();

    // 2) Realtime.
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ocupaciones_centros" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const fila = payload.new as unknown as SnapshotOcupacion & { id: string };
            if (centroId && fila.centro_id !== centroId) return;
            if (desde && fila.dia < desde) return;
            setSnapshots((prev) =>
              prev.some((r) => r.centro_id === fila.centro_id && r.dia === fila.dia)
                ? prev.map((r) => (r.centro_id === fila.centro_id && r.dia === fila.dia ? fila : r))
                : [...prev, fila],
            );
          } else if (payload.eventType === "UPDATE") {
            const fila = payload.new as unknown as SnapshotOcupacion & { id: string };
            setSnapshots((prev) =>
              prev.map((r) =>
                r.centro_id === fila.centro_id && r.dia === fila.dia ? fila : r,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string } & Partial<SnapshotOcupacion>;
            setSnapshots((prev) =>
              prev.filter(
                (r) =>
                  !(r.centro_id === fila.centro_id && r.dia === fila.dia),
              ),
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[useOcupacionesCentros] error de suscripción Realtime");
        }
      });

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, desde]);

  return snapshots;
}
