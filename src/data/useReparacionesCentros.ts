// Hook para leer reparaciones persistentes de `reparaciones_centros` con
// Realtime. Mismo patrón que `useBeneficiosRefugiado`.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarTrabajo,
  type EstatusTrabajo,
  type TrabajoCentro,
} from "../domain/reparaciones";

/** @deprecated Usar TrabajoCentro */
export type { TrabajoCentro as Reparacion, EstatusTrabajo as EstatusReparacion };

interface Opciones {
  centroId?: string;
  estatus?: EstatusTrabajo;
  soloActivos?: boolean;
}

type FilaReparacion = Partial<TrabajoCentro> & { id: string; centro_id: string };

export function useReparacionesCentros(opts: Opciones = {}): {
  trabajos: TrabajoCentro[];
  /** Refetch silencioso; llamar tras una mutación local (crear/editar/archivar). */
  recargar: () => Promise<void>;
} {
  const { centroId, estatus, soloActivos = false } = opts;
  const [trabajos, setTrabajos] = useState<TrabajoCentro[]>([]);
  const recargarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelado = false;
    const channelName = `useReparacionesCentros:${centroId ?? "all"}:${estatus ?? "all"}:${Math.random().toString(36).slice(2)}`;

    async function cargar() {
      let q = supabase.from("reparaciones_centros").select("*");
      if (centroId) q = q.eq("centro_id", centroId);
      if (estatus) q = q.eq("estatus", estatus);
      if (soloActivos) q = q.neq("estatus", "archivado");
      const { data, error } = await q.order("creada_ts", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useReparacionesCentros] error en select:", error.message);
        return;
      }
      setTrabajos(((data ?? []) as FilaReparacion[]).map(normalizarTrabajo));
    }

    recargarRef.current = cargar;
    void cargar();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reparaciones_centros" },
        () => void cargar(),
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
  }, [centroId, estatus, soloActivos]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { trabajos, recargar };
}
