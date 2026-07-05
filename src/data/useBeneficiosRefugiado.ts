// Hook Realtime: beneficios/dotaciones de una persona.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { normalizarBeneficio, type BeneficioOtorgado } from "../domain/beneficios";

export function useBeneficiosRefugiado(refugiadoId: string | undefined): {
  beneficios: BeneficioOtorgado[];
  cargando: boolean;
  /** Refetch silencioso; llamar tras una mutación local (entregar/anular). */
  recargar: () => Promise<void>;
} {
  const [beneficios, setBeneficios] = useState<BeneficioOtorgado[]>([]);
  const [cargando, setCargando] = useState(Boolean(refugiadoId));
  const recargarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!refugiadoId) {
      setBeneficios([]);
      setCargando(false);
      recargarRef.current = async () => {};
      return;
    }

    let cancelado = false;
    const channelName = `useBeneficiosRefugiado:${refugiadoId}:${Math.random().toString(36).slice(2)}`;

    async function cargar(silencioso = false) {
      if (!silencioso) setCargando(true);
      const { data, error } = await supabase
        .from("beneficios_otorgados")
        .select("*")
        .eq("refugiado_id", refugiadoId)
        .order("fecha", { ascending: false });
      if (cancelado) return;
      if (error) {
        console.warn("[useBeneficiosRefugiado]", error.message);
        setBeneficios([]);
      } else {
        setBeneficios(((data ?? []) as BeneficioOtorgado[]).map(normalizarBeneficio));
      }
      if (!silencioso) setCargando(false);
    }

    recargarRef.current = () => cargar(true);
    void cargar(false);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "beneficios_otorgados",
          filter: `refugiado_id=eq.${refugiadoId}`,
        },
        () => void cargar(true),
      )
      // Los DELETE no atraviesan filtros por columna (el registro borrado solo
      // viaja con su PK), así que se escuchan sin filtro y se refetchea.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "beneficios_otorgados" },
        () => void cargar(true),
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [refugiadoId]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { beneficios, cargando, recargar };
}
