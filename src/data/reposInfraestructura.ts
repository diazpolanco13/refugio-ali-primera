// Repos de escritura para áreas de infraestructura (`areas_infraestructura_centros`)
// y subida de fotos al bucket Storage.

import {
  MAX_FOTOS_INICIALES,
  normalizarEstado,
  normalizarFotosIniciales,
  type EstadoInfraestructura,
  type FotoInfraestructura,
} from "../domain/infraestructura";
import { supabase } from "./supabaseClient";
import { usuarioActual } from "./reposSupabase";
import { registrarHistorial } from "./historial";
import { BUCKET_INFRAESTRUCTURA, subirFotoInfraestructura } from "./supabase";

/** Crea un área de infraestructura nueva. Devuelve el id generado. */
export async function crearArea(datos: {
  centro_id: string;
  nombre: string;
  descripcion_inicial?: string;
  fotos_iniciales?: FotoInfraestructura[];
  estado?: EstadoInfraestructura;
}): Promise<string> {
  const ts = Date.now();
  const estado = normalizarEstado(datos.estado);
  const fila = {
    centro_id: datos.centro_id,
    nombre: datos.nombre.trim(),
    descripcion_inicial: (datos.descripcion_inicial ?? "").trim(),
    fotos_iniciales: normalizarFotosIniciales(datos.fotos_iniciales),
    estado,
    creada_ts: ts,
    creada_por: usuarioActual(),
    updated_at: ts,
    updated_by: usuarioActual(),
    mejorada_ts: estado === "mejorado" ? ts : null,
  };
  const { data, error } = await supabase
    .from("areas_infraestructura_centros")
    .insert(fila)
    .select("id")
    .single();
  if (error) {
    throw new Error(`[reposInfraestructura] insert areas_infraestructura_centros: ${error.message}`);
  }
  const id = (data as { id: string }).id;
  registrarHistorial("crear_area_infraestructura", "area_infraestructura", id, {
    centro_id: fila.centro_id,
    nombre: fila.nombre,
  });
  return id;
}

/** Actualiza campos editables de un área. */
export async function actualizarArea(
  id: string,
  cambios: Partial<{
    nombre: string;
    descripcion_inicial: string;
    fotos_iniciales: FotoInfraestructura[];
    estado: EstadoInfraestructura;
  }>,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre.trim();
  if (cambios.descripcion_inicial !== undefined) {
    fila.descripcion_inicial = cambios.descripcion_inicial.trim();
  }
  if (cambios.fotos_iniciales !== undefined) {
    fila.fotos_iniciales = normalizarFotosIniciales(cambios.fotos_iniciales);
  }
  if (cambios.estado !== undefined) {
    const estado = normalizarEstado(cambios.estado);
    fila.estado = estado;
    fila.mejorada_ts = estado === "mejorado" ? now : null;
  }

  const { error } = await supabase.from("areas_infraestructura_centros").update(fila).eq("id", id);
  if (error) {
    throw new Error(`[reposInfraestructura] update areas_infraestructura_centros: ${error.message}`);
  }
  registrarHistorial("actualizar_area_infraestructura", "area_infraestructura", id, cambios);
}

/** Elimina un área (solo admin/analista_sae por RLS). */
export async function eliminarArea(id: string): Promise<void> {
  const { error } = await supabase.from("areas_infraestructura_centros").delete().eq("id", id);
  if (error) {
    throw new Error(`[reposInfraestructura] delete areas_infraestructura_centros: ${error.message}`);
  }
  registrarHistorial("eliminar_area_infraestructura", "area_infraestructura", id);
}

/** Sube una foto inicial al bucket y devuelve el objeto listo para guardar. */
export async function agregarFotoInicial(
  centroId: string,
  areaId: string,
  file: File,
  fotosActuales: FotoInfraestructura[],
): Promise<FotoInfraestructura[]> {
  if (fotosActuales.length >= MAX_FOTOS_INICIALES) {
    throw new Error(`Máximo ${MAX_FOTOS_INICIALES} fotos iniciales por área.`);
  }
  const url = await subirFotoInfraestructura(centroId, areaId, file);
  return [...fotosActuales, { url, ts: Date.now() }];
}

export { BUCKET_INFRAESTRUCTURA, MAX_FOTOS_INICIALES };
