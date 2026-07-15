// Catálogo vivo de unidades SEBIN (tabla `unidades_sebin`) + Realtime.
// Actualiza el caché de dominio para que panel/mapa/form usen la misma fuente.

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSesion } from "./authSupabase";
import { registrarHistorial } from "./historial";
import { supabase } from "./supabaseClient";
import {
  filaAMetaUnidad,
  getCatalogoUnidadesPorCuerpo,
  getCatalogoUnidadesSebin,
  getCatalogoUnidadesSebinActivas,
  setCatalogoUnidadesSebin,
  suscribirCatalogoUnidadesSebin,
  type MetaUnidadSebin,
  type UnidadSebinFila,
} from "@/domain/unidadesSebin";

function snapshotCatalogo(): MetaUnidadSebin[] {
  return getCatalogoUnidadesSebin();
}

/** Catálogo reactivo (re-render al cargar/cambiar unidades). */
export function useCatalogoUnidadesSebin(): MetaUnidadSebin[] {
  return useSyncExternalStore(
    suscribirCatalogoUnidadesSebin,
    snapshotCatalogo,
    snapshotCatalogo,
  );
}

/** Solo unidades activas para selectores. */
export function useCatalogoUnidadesSebinActivas(): MetaUnidadSebin[] {
  const todo = useCatalogoUnidadesSebin();
  return useMemo(() => getCatalogoUnidadesSebinActivas(), [todo]);
}

/** Unidades activas filtradas por cuerpo (+ globales). */
export function useCatalogoUnidadesPorCuerpo(
  cuerpoClave: string | null | undefined,
): MetaUnidadSebin[] {
  const todo = useCatalogoUnidadesSebin();
  return useMemo(
    () => getCatalogoUnidadesPorCuerpo(cuerpoClave),
    [todo, cuerpoClave],
  );
}

async function cargarDesdeSupabase(): Promise<void> {
  const { data, error } = await supabase
    .from("unidades_sebin")
    .select(
      "clave, label, valor_db, color, cuerpo_clave, logo_url, orden, activo, updated_at, updated_by",
    )
    .order("orden", { ascending: true });
  if (error) {
    console.warn("[useUnidadesSebin] no se pudo cargar el catálogo:", error.message);
    return;
  }
  setCatalogoUnidadesSebin((data as UnidadSebinFila[] | null)?.map(filaAMetaUnidad) ?? []);
}

let bootstrapHecho = false;

/**
 * Arranca la carga + Realtime una sola vez (montar en AppShell).
 * Idempotente: varios mounts no duplican el canal.
 */
export function useBootstrapUnidadesSebin(): void {
  useEffect(() => {
    if (bootstrapHecho) return;
    bootstrapHecho = true;
    void cargarDesdeSupabase();

    const canal = supabase
      .channel("unidades_sebin_catalogo")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "unidades_sebin" },
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

export interface UnidadSebinInput {
  clave: string;
  label: string;
  valor_db: string;
  color: string;
  cuerpo_clave: string | null;
  logo_url: string | null;
  orden: number;
  activo: boolean;
}

/** CRUD para la pantalla de administración. */
export function useGestionUnidadesSebin() {
  const unidades = useCatalogoUnidadesSebin();
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

  async function guardar(input: UnidadSebinInput, esNueva: boolean): Promise<void> {
    const usuario = getSesion()?.user.username ?? "sistema";
    const valorAnterior = esNueva
      ? null
      : (unidades.find((u) => u.clave === input.clave.trim())?.valorDb ?? null);
    const fila = {
      clave: input.clave.trim(),
      label: input.label.trim(),
      valor_db: input.valor_db.trim(),
      color: input.color.trim() || "#64748b",
      cuerpo_clave:
        input.clave.trim() === "sin_asignar" ? null : input.cuerpo_clave?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      orden: input.orden,
      activo: input.activo,
      updated_at: Date.now(),
      updated_by: usuario,
    };
    if (esNueva) {
      const { error: err } = await supabase.from("unidades_sebin").insert(fila);
      if (err) throw new Error(err.message);
      registrarHistorial("crear_unidad_sebin", "unidades_sebin", fila.clave, {
        label: fila.label,
      });
    } else {
      const { error: err } = await supabase
        .from("unidades_sebin")
        .update({
          label: fila.label,
          valor_db: fila.valor_db,
          color: fila.color,
          cuerpo_clave: fila.cuerpo_clave,
          logo_url: fila.logo_url,
          orden: fila.orden,
          activo: fila.activo,
          updated_at: fila.updated_at,
          updated_by: fila.updated_by,
        })
        .eq("clave", fila.clave);
      if (err) throw new Error(err.message);
      registrarHistorial("editar_unidad_sebin", "unidades_sebin", fila.clave, {
        label: fila.label,
      });
      if (valorAnterior && valorAnterior !== fila.valor_db) {
        const { error: remapErr } = await supabase.rpc("remapear_unidad_sebin_en_centros", {
          p_valor_antiguo: valorAnterior,
          p_valor_nuevo: fila.valor_db,
        });
        if (remapErr) {
          console.warn("[useUnidadesSebin] remapear unidad:", remapErr.message);
        }
      }
    }
    await cargarDesdeSupabase();
  }

  async function eliminar(clave: string): Promise<void> {
    if (clave === "sin_asignar") {
      throw new Error("La unidad «Sin asignar» no se puede eliminar.");
    }
    const { error: err } = await supabase.from("unidades_sebin").delete().eq("clave", clave);
    if (err) throw new Error(err.message);
    registrarHistorial("eliminar_unidad_sebin", "unidades_sebin", clave);
    await cargarDesdeSupabase();
  }

  return { unidades, cargando, error, refrescar, guardar, eliminar };
}
