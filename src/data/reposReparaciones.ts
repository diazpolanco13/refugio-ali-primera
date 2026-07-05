// Repos de escritura para reparaciones por centro (`reparaciones_centros`,
// `reportes_reparaciones_dia`) y subida de fotos al bucket Storage.

import {
  normalizarEstatus,
  normalizarFotos,
  type EstatusReparacion,
  type FotoReparacion,
  type ReporteReparacionesDia,
} from "../domain/reparaciones";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";
import { registrarHistorial } from "./historial";
import { BUCKET_REPARACIONES, subirFotoReparacion } from "./supabase";

// ---- Reporte diario de reparaciones (flags) ----

/** Guarda/actualiza los flags diarios de reparaciones (upsert centro_id,dia). */
export async function guardarReporteReparacionesDia(
  datos: Omit<ReporteReparacionesDia, "id" | "updated_at" | "updated_by"> & {
    dia?: string;
  },
): Promise<void> {
  const now = Date.now();
  const fila = {
    centro_id: datos.centro_id,
    dia: datos.dia ?? claveDia(now),
    requiere_trabajos: Boolean(datos.requiere_trabajos),
    se_trabajo_hoy: Boolean(datos.se_trabajo_hoy),
    observaciones: datos.observaciones ?? "",
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { error } = await supabase
    .from("reportes_reparaciones_dia")
    .upsert(fila, { onConflict: "centro_id,dia" });
  if (error) {
    throw new Error(`[reposReparaciones] upsert reportes_reparaciones_dia: ${error.message}`);
  }
  registrarHistorial("reporte_reparaciones", "reporte", `${fila.centro_id}/${fila.dia}`, {
    centro_id: fila.centro_id,
    dia: fila.dia,
  });
}

// ---- Ítems de reparación persistentes ----

/** Crea un ítem de reparación nuevo. Devuelve el id generado. */
export async function crearReparacion(datos: {
  centro_id: string;
  titulo: string;
  descripcion?: string;
  estatus?: EstatusReparacion;
  fotos?: FotoReparacion[];
}): Promise<string> {
  const ts = Date.now();
  const fila = {
    centro_id: datos.centro_id,
    titulo: datos.titulo.trim(),
    descripcion: (datos.descripcion ?? "").trim(),
    estatus: normalizarEstatus(datos.estatus),
    fotos: normalizarFotos(datos.fotos),
    creada_ts: ts,
    creada_por: usuarioActual(),
    updated_at: ts,
    updated_by: usuarioActual(),
    resuelta_ts: datos.estatus === "reparado" ? ts : null,
  };
  const { data, error } = await supabase
    .from("reparaciones_centros")
    .insert(fila)
    .select("id")
    .single();
  if (error) {
    throw new Error(`[reposReparaciones] insert reparaciones_centros: ${error.message}`);
  }
  const id = (data as { id: string }).id;
  registrarHistorial("crear_reparacion", "reparacion", id, {
    centro_id: fila.centro_id,
    titulo: fila.titulo,
  });
  return id;
}

/** Actualiza campos editables de una reparación. */
export async function actualizarReparacion(
  id: string,
  cambios: Partial<{
    titulo: string;
    descripcion: string;
    estatus: EstatusReparacion;
    fotos: FotoReparacion[];
  }>,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.titulo !== undefined) fila.titulo = cambios.titulo.trim();
  if (cambios.descripcion !== undefined) fila.descripcion = cambios.descripcion.trim();
  if (cambios.estatus !== undefined) {
    fila.estatus = normalizarEstatus(cambios.estatus);
    fila.resuelta_ts = cambios.estatus === "reparado" ? now : null;
  }
  if (cambios.fotos !== undefined) fila.fotos = normalizarFotos(cambios.fotos);

  const { error } = await supabase.from("reparaciones_centros").update(fila).eq("id", id);
  if (error) {
    throw new Error(`[reposReparaciones] update reparaciones_centros: ${error.message}`);
  }
  registrarHistorial("actualizar_reparacion", "reparacion", id, cambios);
}

/** Sube una foto al bucket y devuelve el objeto FotoReparacion listo para guardar. */
export async function agregarFotoReparacion(
  centroId: string,
  reparacionId: string,
  file: File,
  tipo: FotoReparacion["tipo"],
): Promise<FotoReparacion> {
  const url = await subirFotoReparacion(centroId, reparacionId, file);
  return { url, tipo, ts: Date.now() };
}

/** Elimina una reparación (solo admin/analista_sae por RLS). */
export async function eliminarReparacion(id: string): Promise<void> {
  const { error } = await supabase.from("reparaciones_centros").delete().eq("id", id);
  if (error) {
    throw new Error(`[reposReparaciones] delete reparaciones_centros: ${error.message}`);
  }
  registrarHistorial("eliminar_reparacion", "reparacion", id);
}

export { BUCKET_REPARACIONES };
