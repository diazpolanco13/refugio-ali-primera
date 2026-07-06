// Hook Realtime: alojamientos de un campamento + join client-side con
// damnificados y familias_centro.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import {
  normalizarAlojamiento,
  normalizarFamiliaCentro,
  normalizarRefugiado,
  type AlojamientoEnriquecido,
  type AlojamientoRefugiado,
  type EstadoAlojamiento,
  type FamiliaCentro,
  type Refugiado,
} from "../domain/refugiados";

interface Opciones {
  centroId: string;
  estado?: EstadoAlojamiento;
}

export function useAlojamientosCentro(opts: Opciones): {
  alojamientos: AlojamientoEnriquecido[];
  familias: FamiliaCentro[];
  cargando: boolean;
} {
  const { centroId, estado } = opts;
  const [alojamientos, setAlojamientos] = useState<AlojamientoRefugiado[]>([]);
  const [refugiados, setRefugiados] = useState<Map<string, Refugiado>>(new Map());
  const [familias, setFamilias] = useState<FamiliaCentro[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const channelName = `useAlojamientosCentro:${centroId}:${estado ?? "all"}:${Math.random().toString(36).slice(2)}`;

    async function cargarInicial() {
      setCargando(true);
      let qAloj = supabase.from("alojamientos_refugiados").select("*").eq("centro_id", centroId);
      if (estado) qAloj = qAloj.eq("estado", estado);

      const [resAloj, resFam] = await Promise.all([
        qAloj,
        supabase.from("familias_centro").select("*").eq("centro_id", centroId),
      ]);

      if (cancelado) return;

      if (resAloj.error) {
        console.warn("[useAlojamientosCentro] alojamientos:", resAloj.error.message);
        setAlojamientos([]);
      } else {
        const aloj = ((resAloj.data ?? []) as AlojamientoRefugiado[]).map(normalizarAlojamiento);
        setAlojamientos(aloj);

        const ids = [...new Set(aloj.map((a) => a.refugiado_id))];
        if (ids.length > 0) {
          const { data: refs, error: errRef } = await supabase
            .from("refugiados")
            .select("*")
            .in("id", ids);
          if (!cancelado && !errRef) {
            const map = new Map<string, Refugiado>();
            for (const r of (refs ?? []) as Refugiado[]) {
              map.set(r.id, normalizarRefugiado(r));
            }
            setRefugiados(map);
          }
        } else {
          setRefugiados(new Map());
        }
      }

      if (resFam.error) {
        console.warn("[useAlojamientosCentro] familias:", resFam.error.message);
        setFamilias([]);
      } else {
        setFamilias(((resFam.data ?? []) as FamiliaCentro[]).map(normalizarFamiliaCentro));
      }
      setCargando(false);
    }

    void cargarInicial();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alojamientos_refugiados" },
        async (payload) => {
          const cruda = (payload.new ?? payload.old) as AlojamientoRefugiado | undefined;
          if (!cruda || cruda.centro_id !== centroId) return;

          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setAlojamientos((prev) => prev.filter((a) => a.id !== old.id));
            return;
          }

          const fila = normalizarAlojamiento(payload.new as AlojamientoRefugiado);
          if (estado && fila.estado !== estado) {
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
        { event: "*", schema: "public", table: "familias_centro" },
        (payload) => {
          const cruda = (payload.new ?? payload.old) as FamiliaCentro | undefined;
          if (!cruda || cruda.centro_id !== centroId) return;
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setFamilias((prev) => prev.filter((f) => f.id !== old.id));
            return;
          }
          const fila = normalizarFamiliaCentro(payload.new as FamiliaCentro);
          setFamilias((prev) =>
            prev.some((f) => f.id === fila.id)
              ? prev.map((f) => (f.id === fila.id ? fila : f))
              : [...prev, fila],
          );
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
  }, [centroId, estado]);

  const familiasPorId = useMemo(
    () => new Map(familias.map((f) => [f.id, f])),
    [familias],
  );

  const enriquecidos = useMemo((): AlojamientoEnriquecido[] => {
    const out: AlojamientoEnriquecido[] = [];
    for (const a of alojamientos) {
      const refugiado = refugiados.get(a.refugiado_id);
      if (!refugiado) continue;
      out.push({
        ...a,
        refugiado,
        familia: a.familia_id ? (familiasPorId.get(a.familia_id) ?? null) : null,
      });
    }
    return out;
  }, [alojamientos, refugiados, familiasPorId]);

  return { alojamientos: enriquecidos, familias, cargando };
}
