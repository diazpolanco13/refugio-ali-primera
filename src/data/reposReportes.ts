// Repos de escritura para el reporte diario y las incidencias por centro
// (tablas `reportes_centros` e `incidencias_centros`). Separado de
// `reposSupabase.ts` para no seguir engordando ese archivo; reutiliza sus
// utilidades (`usuarioActual`, `claveDia`).
//
// Realtime (`useReportesCentros` / `useIncidencias`) refresca la UI en todos
// los dispositivos tras cada mutación; aquí no hay estado local.

import {
  normalizarComidas,
  type ReporteDiario,
} from "../domain/reporteDiario";
import {
  normalizarCategorias,
  normalizarEtiqueta,
  type CategoriaIncidencia,
  type EtiquetaIncidencia,
  type Incidencia,
} from "../domain/incidencias";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";

// ---- Reporte diario ----

/**
 * Guarda/actualiza el reporte diario de un centro (comidas por jornada,
 * atenciones médicas, observaciones). Upsert con clave lógica
 * `(centro_id, dia)`: la última edición del día gana, igual que el snapshot
 * de `ocupaciones_centros`. Si no se pasa `dia`, se usa el día de hoy.
 */
export async function guardarReporteDiario(
  datos: Omit<ReporteDiario, "id" | "dia" | "updated_at" | "updated_by"> & {
    dia?: string;
  },
): Promise<void> {
  const now = Date.now();
  const fila = {
    centro_id: datos.centro_id,
    dia: datos.dia ?? claveDia(now),
    comidas: normalizarComidas(datos.comidas),
    atenciones_medicas: datos.atenciones_medicas ?? 0,
    observaciones: datos.observaciones ?? "",
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { error } = await supabase
    .from("reportes_centros")
    .upsert(fila, { onConflict: "centro_id,dia" });
  if (error) {
    throw new Error(`[reposReportes] upsert reportes_centros: ${error.message}`);
  }
}

// ---- Incidencias ----

/**
 * Registra una incidencia nueva (estado `abierta`). El `id` (uuid) lo genera
 * Postgres; se devuelve para poder enlazarla desde la UI. Si no se pasa
 * `dia`/`ts`, se usa el momento actual.
 */
export async function crearIncidencia(datos: {
  centro_id: string;
  descripcion: string;
  etiqueta: EtiquetaIncidencia;
  categorias?: CategoriaIncidencia[];
  /** YYYY-MM-DD (default: hoy) */
  dia?: string;
  /** Timestamp ms (default: ahora) */
  ts?: number;
}): Promise<string> {
  const ts = datos.ts ?? Date.now();
  const fila = {
    centro_id: datos.centro_id,
    dia: datos.dia ?? claveDia(ts),
    ts,
    descripcion: datos.descripcion,
    etiqueta: normalizarEtiqueta(datos.etiqueta),
    categorias: normalizarCategorias(datos.categorias),
    estado: "abierta" as const,
    updated_at: ts,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("incidencias_centros")
    .insert(fila)
    .select("id")
    .single();
  if (error) {
    throw new Error(`[reposReportes] insert incidencias_centros: ${error.message}`);
  }
  return (data as { id: string }).id;
}

/**
 * Actualiza campos editables de una incidencia (descripción, etiqueta,
 * categorías, estado o día). Los campos no incluidos en `cambios` se dejan
 * como están.
 */
export async function actualizarIncidencia(
  id: string,
  cambios: Partial<
    Pick<Incidencia, "descripcion" | "etiqueta" | "categorias" | "estado" | "dia">
  >,
): Promise<void> {
  const fila: Record<string, unknown> = {
    ...cambios,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  if (cambios.etiqueta !== undefined) fila.etiqueta = normalizarEtiqueta(cambios.etiqueta);
  if (cambios.categorias !== undefined) {
    fila.categorias = normalizarCategorias(cambios.categorias);
  }
  const { error } = await supabase
    .from("incidencias_centros")
    .update(fila)
    .eq("id", id);
  if (error) {
    throw new Error(`[reposReportes] update incidencias_centros: ${error.message}`);
  }
}

/**
 * Marca una incidencia como resuelta (estado `resuelta` + quién y cuándo la
 * resolvió).
 */
export async function resolverIncidencia(id: string): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("incidencias_centros")
    .update({
      estado: "resuelta",
      resuelta_ts: now,
      resuelta_por: usuarioActual(),
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`[reposReportes] resolver incidencias_centros: ${error.message}`);
  }
}
