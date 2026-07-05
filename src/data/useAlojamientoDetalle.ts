// Carga un alojamiento por id con refugiado, familia, miembros y residencia (vista de ficha).

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { normalizarGeom } from "./normalizarGeom";
import {
  normalizarAlojamiento,
  normalizarFamiliaCentro,
  normalizarRefugiado,
  normalizarResidenciaAfectada,
  type AlojamientoEnriquecido,
  type AlojamientoRefugiado,
  type FamiliaCentro,
  type Refugiado,
  type ResidenciaAfectada,
} from "../domain/refugiados";

import type { BeneficioOtorgado } from "../domain/beneficios";

export interface DetalleAlojamiento extends AlojamientoEnriquecido {
  miembrosFamilia: AlojamientoEnriquecido[];
  residencia: ResidenciaAfectada | null;
  beneficios: BeneficioOtorgado[];
}

export function useAlojamientoDetalle(alojamientoId: string | undefined): {
  alojamiento: DetalleAlojamiento | null;
  cargando: boolean;
} {
  const [alojamiento, setAlojamiento] = useState<DetalleAlojamiento | null>(null);
  const [cargando, setCargando] = useState(Boolean(alojamientoId));

  useEffect(() => {
    if (!alojamientoId) {
      setAlojamiento(null);
      setCargando(false);
      return;
    }

    let cancelado = false;
    const channelName = `useAlojamientoDetalle:${alojamientoId}:${Math.random().toString(36).slice(2)}`;

    async function cargarRefugiados(ids: string[]): Promise<Map<string, Refugiado>> {
      if (ids.length === 0) return new Map();
      const { data } = await supabase.from("refugiados").select("*").in("id", ids);
      const map = new Map<string, Refugiado>();
      for (const r of (data ?? []) as Refugiado[]) {
        map.set(r.id, normalizarRefugiado(r));
      }
      return map;
    }

    async function cargar(silencioso = false) {
      if (!silencioso) setCargando(true);
      try {
        const { data: alojRaw, error } = await supabase
          .from("alojamientos_refugiados")
          .select("*")
          .eq("id", alojamientoId)
          .maybeSingle();

        if (cancelado) return;
        if (error || !alojRaw) {
          if (!silencioso) setAlojamiento(null);
          return;
        }

        const aloj = normalizarAlojamiento(alojRaw as AlojamientoRefugiado);

        const [refRes, famRes, resRes] = await Promise.all([
          supabase.from("refugiados").select("*").eq("id", aloj.refugiado_id).maybeSingle(),
          aloj.familia_id
            ? supabase.from("familias_centro").select("*").eq("id", aloj.familia_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          aloj.familia_id
            ? supabase.from("residencias_afectadas").select("*").eq("familia_id", aloj.familia_id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (cancelado) return;

        const refugiado = refRes.data
          ? normalizarRefugiado(refRes.data as Refugiado)
          : null;
        if (!refugiado) {
          if (!silencioso) setAlojamiento(null);
          return;
        }

        const familia = famRes.data
          ? normalizarFamiliaCentro(famRes.data as FamiliaCentro)
          : null;

        let residencia: ResidenciaAfectada | null = null;
        if (resRes.data) {
          const raw = resRes.data as ResidenciaAfectada & { geom?: unknown };
          residencia = normalizarResidenciaAfectada(raw, normalizarGeom(raw.geom));
        }

        let miembrosFamilia: AlojamientoEnriquecido[] = [];
        if (aloj.familia_id) {
          const { data: miembrosRaw } = await supabase
            .from("alojamientos_refugiados")
            .select("*")
            .eq("familia_id", aloj.familia_id)
            .eq("centro_id", aloj.centro_id)
            .order("fecha_ingreso");
          if (cancelado) return;
          const miembros = ((miembrosRaw ?? []) as AlojamientoRefugiado[]).map(normalizarAlojamiento);
          const refIds = [...new Set(miembros.map((m) => m.refugiado_id))];
          const refsMap = await cargarRefugiados(refIds);
          const enriquecidos: AlojamientoEnriquecido[] = [];
          for (const m of miembros) {
            const ref = refsMap.get(m.refugiado_id);
            if (!ref) continue;
            enriquecidos.push({ ...m, refugiado: ref, familia: familia ?? null });
          }
          miembrosFamilia = enriquecidos;
        }

        setAlojamiento((prev) => ({
          ...aloj,
          refugiado,
          familia,
          miembrosFamilia,
          residencia,
          beneficios: prev?.beneficios ?? [],
        }));
      } catch (err) {
        console.warn("[useAlojamientoDetalle] carga:", err);
        if (!cancelado && !silencioso) setAlojamiento(null);
      } finally {
        if (!cancelado && !silencioso) setCargando(false);
      }
    }

    void cargar(false);

    const recargar = () => void cargar(true);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alojamientos_refugiados", filter: `id=eq.${alojamientoId}` },
        recargar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "refugiados" },
        recargar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "residencias_afectadas" },
        recargar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "familias_centro" },
        recargar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beneficios_otorgados" },
        recargar,
      )
      .subscribe();

    return () => {
      cancelado = true;
      void supabase.removeChannel(channel);
    };
  }, [alojamientoId]);

  return { alojamiento, cargando };
}
