import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { normalizarCasoSalud, type CasoSaludCentro } from "../domain/casosSalud";

interface Opciones {
  centroId?: string;
  soloActivos?: boolean;
}

type Fila = Partial<CasoSaludCentro> & { id: string; centro_id: string };

export function useCasosSaludCentros(opts: Opciones = {}): {
  casos: CasoSaludCentro[];
  /** Refetch silencioso; llamar tras una mutación local (crear/editar/archivar). */
  recargar: () => Promise<void>;
} {
  const { centroId, soloActivos = false } = opts;
  const [casos, setCasos] = useState<CasoSaludCentro[]>([]);
  const recargarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelado = false;
    const channelName = `useCasosSaludCentros:${centroId ?? "all"}:${Math.random().toString(36).slice(2)}`;

    async function cargar() {
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
    }

    recargarRef.current = cargar;
    void cargar();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "casos_salud_centros" },
        () => void cargar(),
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, soloActivos]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { casos, recargar };
}
