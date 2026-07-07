import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { normalizarCasoSalud, type CasoSaludCentro } from "../domain/casosSalud";

interface Opciones {
  centroId?: string;
  soloActivos?: boolean;
}

type Fila = Partial<CasoSaludCentro> & { id: string; centro_id: string };

export function useCasosSaludCentros(opts: Opciones = {}): CasoSaludCentro[] {
  const { centroId, soloActivos = false } = opts;
  const [casos, setCasos] = useState<CasoSaludCentro[]>([]);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useCasosSaludCentros:${centroId ?? "all"}:${Math.random().toString(36).slice(2)}`;

    (async () => {
      let q = supabase.from("casos_salud_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (soloActivos) q = q.neq("estatus", "archivado");
      const { data, error } = await q.order("creada_ts", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useCasosSaludCentros] select:", error.message);
        return;
      }
      setCasos(((data ?? []) as Fila[]).map(normalizarCasoSalud));
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "casos_salud_centros" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const cruda = payload.new as unknown as Fila;
            if (centroId && cruda.centro_id !== centroId) return;
            const fila = normalizarCasoSalud(cruda);
            if (soloActivos && fila.estatus === "archivado") {
              setCasos((prev) => prev.filter((c) => c.id !== fila.id));
              return;
            }
            setCasos((prev) =>
              prev.some((c) => c.id === fila.id)
                ? prev.map((c) => (c.id === fila.id ? fila : c))
                : [fila, ...prev],
            );
          } else if (payload.eventType === "DELETE") {
            const fila = payload.old as unknown as { id: string };
            setCasos((prev) => prev.filter((c) => c.id !== fila.id));
          }
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, soloActivos]);

  return casos;
}
