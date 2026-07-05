// Hook Realtime: todos los alojamientos activos visibles por RLS + metadatos
// de refugiado (vista global /centros/refugiados).

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarAlojamiento,
  normalizarRefugiado,
  type AlojamientoEnriquecido,
  type AlojamientoRefugiado,
  type Refugiado,
} from "../domain/refugiados";

export function useRefugiadosRed(): {
  alojamientos: AlojamientoEnriquecido[];
  cargando: boolean;
} {
  const [alojamientos, setAlojamientos] = useState<AlojamientoRefugiado[]>([]);
  const [refugiados, setRefugiados] = useState<Map<string, Refugiado>>(new Map());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useRefugiadosRed:${Math.random().toString(36).slice(2)}`;

    async function cargarRefs(ids: string[]) {
      if (ids.length === 0) {
        setRefugiados(new Map());
        return;
      }
      const { data, error } = await supabase.from("refugiados").select("*").in("id", ids);
      if (cancelado || error) return;
      const map = new Map<string, Refugiado>();
      for (const r of (data ?? []) as Refugiado[]) {
        map.set(r.id, normalizarRefugiado(r));
      }
      setRefugiados(map);
    }

    (async () => {
      setCargando(true);
      const { data, error } = await supabase
        .from("alojamientos_refugiados")
        .select("*")
        .eq("estado", "activo");
      if (cancelado) return;
      if (error) {
        console.warn("[useRefugiadosRed] select:", error.message);
        setAlojamientos([]);
        setCargando(false);
        return;
      }
      const aloj = ((data ?? []) as AlojamientoRefugiado[]).map(normalizarAlojamiento);
      setAlojamientos(aloj);
      await cargarRefs([...new Set(aloj.map((a) => a.refugiado_id))]);
      setCargando(false);
    })();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alojamientos_refugiados" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setAlojamientos((prev) => prev.filter((a) => a.id !== old.id));
            return;
          }
          const fila = normalizarAlojamiento(payload.new as AlojamientoRefugiado);
          if (fila.estado !== "activo") {
            setAlojamientos((prev) => prev.filter((a) => a.id !== fila.id));
            return;
          }
          setAlojamientos((prev) =>
            prev.some((a) => a.id === fila.id)
              ? prev.map((a) => (a.id === fila.id ? fila : a))
              : [...prev, fila],
          );
          const { data: ref } = await supabase
            .from("refugiados")
            .select("*")
            .eq("id", fila.refugiado_id)
            .maybeSingle();
          if (ref) {
            setRefugiados((prev) => {
              const next = new Map(prev);
              next.set(fila.refugiado_id, normalizarRefugiado(ref as Refugiado));
              return next;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refugiados" },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const fila = normalizarRefugiado(payload.new as Refugiado);
            setRefugiados((prev) => {
              if (!prev.has(fila.id)) return prev;
              const next = new Map(prev);
              next.set(fila.id, fila);
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  const enriquecidos = useMemo((): AlojamientoEnriquecido[] => {
    const out: AlojamientoEnriquecido[] = [];
    for (const a of alojamientos) {
      const refugiado = refugiados.get(a.refugiado_id);
      if (!refugiado) continue;
      out.push({ ...a, refugiado, familia: null });
    }
    return out;
  }, [alojamientos, refugiados]);

  return { alojamientos: enriquecidos, cargando };
}
