// Repos de escritura para el reporte diario y las incidencias por centro
// (tablas `reportes_centros` e `incidencias_centros`). Separado de
// `reposSupabase.ts` para no seguir engordando ese archivo; reutiliza sus
// utilidades (`usuarioActual`, `claveDia`).
//
// Realtime (`useReportesCentros` / `useIncidencias`) refresca la UI en todos
// los dispositivos tras cada mutación; aquí no hay estado local.

import {
  contarAtenciones,
  normalizarAtencionesMedicas,
  normalizarComidas,
  type ComidasDia,
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
import { registrarHistorial } from "./historial";

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
  const detalle = normalizarAtencionesMedicas(datos.atenciones_medicas_detalle);
  const observaciones = datos.observaciones ?? "";
  const totalAtenciones = Math.max(datos.atenciones_medicas ?? 0, detalle.length);
  const saludReportada =
    datos.salud_reportada ||
    contarAtenciones(detalle, totalAtenciones) > 0 ||
    observaciones.trim() !== "";
  const eventosRevisados = datos.eventos_revisados === true;
  const comidas: ComidasDia & {
    _salud_reportada?: boolean;
    _eventos_revisados?: boolean;
  } = {
    ...normalizarComidas(datos.comidas),
    _salud_reportada: saludReportada,
    _eventos_revisados: eventosRevisados,
  };
  const fila = {
    centro_id: datos.centro_id,
    dia: datos.dia ?? claveDia(now),
    comidas,
    atenciones_medicas_detalle: detalle,
    atenciones_medicas: totalAtenciones,
    salud_reportada: saludReportada,
    eventos_revisados: eventosRevisados,
    observaciones,
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { error } = await supabase
    .from("reportes_centros")
    .upsert(fila, { onConflict: "centro_id,dia" });
  if (error) {
    // Compatibilidad temporal: algunos despliegues aún no tienen columnas nuevas;
    // los mismos flags viajan respaldados en `comidas`.
    if (
      (error.message.includes("salud_reportada") ||
        error.message.includes("eventos_revisados")) &&
      (error.message.includes("schema cache") || error.message.includes("column"))
    ) {
      const {
        salud_reportada: _saludReportada,
        eventos_revisados: _eventosRevisados,
        ...filaSinColumna
      } = fila;
      const { error: fallbackError } = await supabase
        .from("reportes_centros")
        .upsert(filaSinColumna, { onConflict: "centro_id,dia" });
      if (!fallbackError) {
        registrarHistorial("reporte_diario", "reporte", `${fila.centro_id}/${fila.dia}`, {
          centro_id: fila.centro_id,
          dia: fila.dia,
        });
        return;
      }
      throw new Error(`[reposReportes] upsert reportes_centros: ${fallbackError.message}`);
    }
    throw new Error(`[reposReportes] upsert reportes_centros: ${error.message}`);
  }
  registrarHistorial("reporte_diario", "reporte", `${fila.centro_id}/${fila.dia}`, {
    centro_id: fila.centro_id,
    dia: fila.dia,
  });
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
    // Quién la abrió: estable de por vida (updated_by se pisa en cada edición).
    // La RLS usa esta columna para que el operador solo resuelva las suyas.
    creada_por: usuarioActual(),
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
  const id = (data as { id: string }).id;
  registrarHistorial("abrir_incidencia", "incidencia", id, {
    centro_id: fila.centro_id,
    etiqueta: fila.etiqueta,
  });
  return id;
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
  if (cambios.estado === "abierta") {
    fila.resuelta_ts = null;
    fila.resuelta_por = null;
  }
  const { error } = await supabase
    .from("incidencias_centros")
    .update(fila)
    .eq("id", id);
  if (error) {
    throw new Error(`[reposReportes] update incidencias_centros: ${error.message}`);
  }
  registrarHistorial("editar_incidencia", "incidencia", id, {
    campos: Object.keys(cambios),
  });
}

/**
 * Elimina una incidencia de forma permanente. Solo admin/analista_sae (RLS).
 */
export async function eliminarIncidencia(id: string): Promise<void> {
  const { error } = await supabase.from("incidencias_centros").delete().eq("id", id);
  if (error) {
    throw new Error(`[reposReportes] delete incidencias_centros: ${error.message}`);
  }
  registrarHistorial("eliminar_incidencia", "incidencia", id);
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
  registrarHistorial("resolver_incidencia", "incidencia", id);
}
