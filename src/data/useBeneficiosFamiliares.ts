// Hook Realtime: apoyos entregados a un hogar (`beneficios_familiares`).

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizarBeneficioFamiliar, type BeneficioFamiliar } from "../domain/beneficios";
import { supabase } from "./supabaseClient";

export function useBeneficiosFamiliares(familiaId: string | undefined): {
  beneficios: BeneficioFamiliar[];
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const [beneficios, setBeneficios] = useState<BeneficioFamiliar[]>([]);
  const [cargando, setCargando] = useState(Boolean(familiaId));
  const [error, setError] = useState<string | null>(null);
  const recargarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!familiaId) {
      setBeneficios([]);
      setCargando(false);
      setError(null);
      recargarRef.current = async () => {};
      return;
    }

    let cancelado = false;
    const channelName = `useBeneficiosFamiliares:${familiaId}:${Math.random().toString(36).slice(2)}`;

    async function cargar(silencioso = false) {
      if (!silencioso) setCargando(true);
      const { data, error: err } = await supabase
        .from("beneficios_familiares")
        .select("*")
        .eq("familia_id", familiaId)
        .order("fecha", { ascending: false });
      if (cancelado) return;
      if (err) {
        setBeneficios([]);
        setError(err.message);
      } else {
        setBeneficios(((data ?? []) as BeneficioFamiliar[]).map(normalizarBeneficioFamiliar));
        setError(null);
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
          table: "beneficios_familiares",
          filter: `familia_id=eq.${familiaId}`,
        },
        () => void cargar(true),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "beneficios_familiares" },
        () => void cargar(true),
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [familiaId]);

  const recargar = useCallback(() => recargarRef.current(), []);

  return { beneficios, cargando, error, recargar };
}
