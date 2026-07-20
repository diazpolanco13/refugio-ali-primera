// Repos de escritura para trabajos por centro (`reparaciones_centros`) y
// subida de fotos al bucket Storage.

import {
  debeAutoArchivarTrabajo,
  normalizarEstatus,
  normalizarFotos,
  normalizarTrabajo,
  type EstatusTrabajo,
  type FotoReparacion,
  type TrabajoCentro,
} from "../domain/reparaciones";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";
import { registrarHistorial } from "./historial";
import { BUCKET_REPARACIONES, subirFotoReparacion } from "./supabase";

/** @deprecated Legacy flags diarios */
export async function guardarReporteReparacionesDia(
  datos: {
    centro_id: string;
    dia?: string;
    requiere_trabajos: boolean;
    se_trabajo_hoy: boolean;
    observaciones: string;
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

export async function eliminarReporteReparacionesDia(datos: {
  centro_id: string;
  dia: string;
}): Promise<void> {
  const { error } = await supabase
    .from("reportes_reparaciones_dia")
    .delete()
    .eq("centro_id", datos.centro_id)
    .eq("dia", datos.dia);
  if (error) {
    throw new Error(`[reposReparaciones] delete reportes_reparaciones_dia: ${error.message}`);
  }
}

export async function crearTrabajo(datos: {
  centro_id: string;
  titulo: string;
  finalidad?: string;
  descripcion?: string;
  estatus?: EstatusTrabajo;
  fotos?: FotoReparacion[];
  area_infraestructura_id?: string | null;
  reportada_dia?: string;
}): Promise<string> {
  const ts = Date.now();
  const estatus = normalizarEstatus(datos.estatus);
  const fila = {
    centro_id: datos.centro_id,
    titulo: datos.titulo.trim(),
    finalidad: (datos.finalidad ?? "").trim(),
    descripcion: (datos.descripcion ?? "").trim(),
    estatus,
    fotos: normalizarFotos(datos.fotos),
    reportada_dia: datos.reportada_dia ?? claveDia(ts),
    creada_ts: ts,
    creada_por: usuarioActual(),
    updated_at: ts,
    updated_by: usuarioActual(),
    resuelta_ts: estatus === "completado" ? ts : null,
    area_infraestructura_id: datos.area_infraestructura_id ?? null,
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
  registrarHistorial("crear_trabajo", "trabajo", id, {
    centro_id: fila.centro_id,
    titulo: fila.titulo,
  });
  return id;
}

/** @deprecated Usar crearTrabajo */
export const crearReparacion = crearTrabajo;

export async function actualizarTrabajo(
  id: string,
  cambios: Partial<{
    titulo: string;
    finalidad: string;
    descripcion: string;
    estatus: EstatusTrabajo;
    fotos: FotoReparacion[];
    area_infraestructura_id: string | null;
  }>,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.titulo !== undefined) fila.titulo = cambios.titulo.trim();
  if (cambios.finalidad !== undefined) fila.finalidad = cambios.finalidad.trim();
  if (cambios.descripcion !== undefined) fila.descripcion = cambios.descripcion.trim();
  if (cambios.estatus !== undefined) {
    const estatus = normalizarEstatus(cambios.estatus);
    fila.estatus = estatus;
    if (estatus === "completado") {
      fila.resuelta_ts = now;
      fila.archivada_ts = null;
    } else if (estatus === "archivado") {
      fila.archivada_ts = now;
    } else {
      fila.resuelta_ts = null;
      fila.archivada_ts = null;
    }
  }
  if (cambios.fotos !== undefined) fila.fotos = normalizarFotos(cambios.fotos);
  if (cambios.area_infraestructura_id !== undefined) {
    fila.area_infraestructura_id = cambios.area_infraestructura_id;
  }

  const { error } = await supabase.from("reparaciones_centros").update(fila).eq("id", id);
  if (error) {
    throw new Error(`[reposReparaciones] update reparaciones_centros: ${error.message}`);
  }
  registrarHistorial("actualizar_trabajo", "trabajo", id, cambios);
}

/** @deprecated Usar actualizarTrabajo */
export const actualizarReparacion = actualizarTrabajo;

export async function archivarTrabajo(id: string): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("reparaciones_centros")
    .update({
      estatus: "archivado",
      archivada_ts: now,
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`[reposReparaciones] archivar: ${error.message}`);
  }
  registrarHistorial("archivar_trabajo", "trabajo", id);
}

/**
 * Pasa a archivado los completados de días anteriores a `hoyClave`.
 * Idempotente; pensado para correr al abrir el reporte / pestaña Trabajos.
 */
export async function archivarTrabajosCompletadosVencidos(
  trabajos: TrabajoCentro[],
  hoyClave: string = claveDia(Date.now()),
): Promise<number> {
  const vencidos = trabajos.filter((t) => debeAutoArchivarTrabajo(t, hoyClave));
  for (const t of vencidos) {
    await archivarTrabajo(t.id);
  }
  return vencidos.length;
}

export async function agregarFotoReparacion(
  centroId: string,
  reparacionId: string,
  file: File,
  tipo: FotoReparacion["tipo"],
): Promise<FotoReparacion> {
  const url = await subirFotoReparacion(centroId, reparacionId, file);
  return { url, tipo, ts: Date.now() };
}

export async function eliminarTrabajo(id: string): Promise<void> {
  const { error } = await supabase.from("reparaciones_centros").delete().eq("id", id);
  if (error) {
    throw new Error(`[reposReparaciones] delete reparaciones_centros: ${error.message}`);
  }
  registrarHistorial("eliminar_trabajo", "trabajo", id);
}

/** @deprecated Usar eliminarTrabajo */
export const eliminarReparacion = eliminarTrabajo;

export { BUCKET_REPARACIONES, normalizarTrabajo };
export type { TrabajoCentro };
