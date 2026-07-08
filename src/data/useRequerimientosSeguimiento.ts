import { useCallback, useEffect, useRef, useState } from "react";
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

export function useRequerimientosSeguimiento(opts: Opciones = {}): {
  requerimientos: RequerimientoSeguimiento[];
  /** Refetch silencioso; llamar tras una mutación local (crear/editar/archivar). */
  recargar: () => Promise<void>;
} {
  const { centroId, soloActivos = false } = opts;
  const [requerimientos, setRequerimientos] = useState<RequerimientoSeguimiento[]>([]);
  const recargarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelado = false;
    const channelName = `useRequerimientosSeguimiento:${centroId ?? "all"}:${Math.random().toString(36).slice(2)}`;

    async function cargar() {
      let q = supabase.from("requerimientos_seguimiento").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (soloActivos) q = q.neq("estatus", "archivado");
      const { data, error } = await q.order("creada_ts", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useRequerimientosSeguimiento] select:", error.message);
        return;
      }
      setRequerimientos(((data ?? []) as Fila[]).map(normalizarRequerimientoSeguimiento));
    }

    recargarRef.current = cargar;
    void cargar();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requerimientos_seguimiento" },
        () => void cargar(),
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [centroId, soloActivos]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { requerimientos, recargar };
}
