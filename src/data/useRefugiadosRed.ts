// Hook Realtime: todos los alojamientos activos visibles por RLS + metadatos
// de refugiado (vista global /centros/refugiados).
//
// Carga inicial con embed PostgREST (evita `.in(id, N)` enorme que falla por
// límite de URL y dejaba la lista vacía en silencio).

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarAlojamiento,
  normalizarRefugiado,
  type AlojamientoEnriquecido,
  type AlojamientoRefugiado,
  type Refugiado,
} from "../domain/refugiados";

/** Filas por página en la carga inicial (margen de max-rows de PostgREST). */
const PAGE_ALOJA = 500;

type FilaAlojConRef = AlojamientoRefugiado & {
  refugiado: Refugiado | Refugiado[] | null;
};

function refDesdeEmbed(
  raw: Refugiado | Refugiado[] | null | undefined,
): Refugiado | null {
  if (!raw) return null;
  const fila = Array.isArray(raw) ? raw[0] : raw;
  if (!fila || typeof fila !== "object" || !("id" in fila)) return null;
  return normalizarRefugiado(fila);
}

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

    async function cargarInicial() {
      setCargando(true);
      const alojAcum: AlojamientoRefugiado[] = [];
      const refsAcum = new Map<string, Refugiado>();
      let desde = 0;

      for (;;) {
        const { data, error } = await supabase
          .from("alojamientos_refugiados")
          .select("*, refugiado:refugiados(*)")
          .eq("estado", "activo")
          .order("id", { ascending: true })
          .range(desde, desde + PAGE_ALOJA - 1);

        if (cancelado) return;
        if (error) {
          console.warn("[useRefugiadosRed] select:", error.message);
          setAlojamientos([]);
          setRefugiados(new Map());
          setCargando(false);
          return;
        }

        const filas = (data ?? []) as FilaAlojConRef[];
        for (const fila of filas) {
          alojAcum.push(normalizarAlojamiento(fila));
          const ref = refDesdeEmbed(fila.refugiado);
          if (ref) refsAcum.set(ref.id, ref);
        }

        if (filas.length < PAGE_ALOJA) break;
        desde += PAGE_ALOJA;
      }

      if (cancelado) return;
      setAlojamientos(alojAcum);
      setRefugiados(refsAcum);
      setCargando(false);
    }

    void cargarInicial();

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
          const { data: ref, error } = await supabase
            .from("refugiados")
            .select("*")
            .eq("id", fila.refugiado_id)
            .maybeSingle();
          if (error) {
            console.warn("[useRefugiadosRed] realtime ref:", error.message);
            return;
          }
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
