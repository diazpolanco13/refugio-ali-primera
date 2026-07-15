// Catálogo vivo de cuerpos policiales (tabla `cuerpos_policiales`) + Realtime.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSesion } from "./authSupabase";
import { registrarHistorial } from "./historial";
import { supabase } from "./supabaseClient";
import {
  filaAMetaCuerpo,
  getCatalogoCuerpos,
  getCatalogoCuerposActivos,
  setCatalogoCuerpos,
  suscribirCatalogoCuerpos,
  type CuerpoPolicialFila,
  type MetaCuerpo,
} from "@/domain/cuerposPoliciales";

function snapshotCatalogo(): MetaCuerpo[] {
  return getCatalogoCuerpos();
}

/** Catálogo reactivo (re-render al cargar/cambiar cuerpos). */
export function useCatalogoCuerpos(): MetaCuerpo[] {
  return useSyncExternalStore(suscribirCatalogoCuerpos, snapshotCatalogo, snapshotCatalogo);
}

/** Solo cuerpos activos para selectores. */
export function useCatalogoCuerposActivos(): MetaCuerpo[] {
  const todo = useCatalogoCuerpos();
  return useMemo(() => getCatalogoCuerposActivos(), [todo]);
}

async function cargarDesdeSupabase(): Promise<void> {
  const { data, error } = await supabase
    .from("cuerpos_policiales")
    .select("clave, label, color, icono, logo_url, orden, activo, updated_at, updated_by")
    .order("orden", { ascending: true });
  if (error) {
    console.warn("[useCuerposPoliciales] no se pudo cargar el catálogo:", error.message);
    return;
  }
  setCatalogoCuerpos((data as CuerpoPolicialFila[] | null)?.map(filaAMetaCuerpo) ?? []);
}

let bootstrapHecho = false;

/** Arranca carga + Realtime una sola vez (montar en AppShell). */
export function useBootstrapCuerposPoliciales(): void {
  useEffect(() => {
    if (bootstrapHecho) return;
    bootstrapHecho = true;
    void cargarDesdeSupabase();

    const canal = supabase
      .channel("cuerpos_policiales_catalogo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cuerpos_policiales" },
        () => {
          void cargarDesdeSupabase();
        },
      )
      .subscribe();

    return () => {
      bootstrapHecho = false;
      void supabase.removeChannel(canal);
    };
  }, []);
}

export interface CuerpoPolicialInput {
  clave: string;
  label: string;
  color: string;
  icono: string;
  logo_url: string | null;
  orden: number;
  activo: boolean;
}

/** CRUD para la pantalla de administración. */
export function useGestionCuerposPoliciales() {
  const cuerpos = useCatalogoCuerpos();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      await cargarDesdeSupabase();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  async function guardar(input: CuerpoPolicialInput, esNueva: boolean): Promise<void> {
    const usuario = getSesion()?.user.username ?? "sistema";
    const labelAnterior = esNueva
      ? null
      : (cuerpos.find((c) => c.clave === input.clave.trim())?.label ?? null);
    const fila = {
      clave: input.clave.trim(),
      label: input.label.trim(),
      color: input.color.trim() || "#64748b",
      icono: input.icono.trim() || "🛡️",
      logo_url: input.logo_url?.trim() || null,
      orden: input.orden,
      activo: input.activo,
      updated_at: Date.now(),
      updated_by: usuario,
    };
    if (esNueva) {
      const { error: err } = await supabase.from("cuerpos_policiales").insert(fila);
      if (err) throw new Error(err.message);
      registrarHistorial("crear_cuerpo_policial", "cuerpos_policiales", fila.clave, {
        label: fila.label,
      });
    } else {
      const { error: err } = await supabase
        .from("cuerpos_policiales")
        .update({
          label: fila.label,
          color: fila.color,
          icono: fila.icono,
          logo_url: fila.logo_url,
          orden: fila.orden,
          activo: fila.activo,
          updated_at: fila.updated_at,
          updated_by: fila.updated_by,
        })
        .eq("clave", fila.clave);
      if (err) throw new Error(err.message);
      registrarHistorial("editar_cuerpo_policial", "cuerpos_policiales", fila.clave, {
        label: fila.label,
      });
      if (labelAnterior && labelAnterior !== fila.label) {
        const { error: remapErr } = await supabase.rpc("remapear_cuerpo_en_centros", {
          p_label_antiguo: labelAnterior,
          p_label_nuevo: fila.label,
        });
        if (remapErr) {
          console.warn("[useCuerposPoliciales] remapear cuerpo:", remapErr.message);
        }
      }
    }
    await cargarDesdeSupabase();
  }

  async function eliminar(clave: string): Promise<void> {
    if (clave === "sin_asignar") {
      throw new Error("El cuerpo «Sin asignar» no se puede eliminar.");
    }
    const { error: err } = await supabase.from("cuerpos_policiales").delete().eq("clave", clave);
    if (err) throw new Error(err.message);
    registrarHistorial("eliminar_cuerpo_policial", "cuerpos_policiales", clave);
    await cargarDesdeSupabase();
  }

  return { cuerpos, cargando, error, refrescar, guardar, eliminar };
}
