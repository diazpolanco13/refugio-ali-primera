import {
  normalizarCasoSalud,
  normalizarEstatusCasoSalud,
  type CasoSaludCentro,
  type EstatusCasoSalud,
} from "../domain/casosSalud";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";
import { registrarHistorial } from "./historial";

export async function crearCasoSalud(datos: {
  centro_id: string;
  titulo: string;
  descripcion?: string;
  estatus?: EstatusCasoSalud;
  reportado_dia?: string;
}): Promise<string> {
  const ts = Date.now();
  const dia = datos.reportado_dia ?? claveDia(ts);
  const estatus = normalizarEstatusCasoSalud(datos.estatus);
  const fila = {
    centro_id: datos.centro_id,
    titulo: datos.titulo.trim(),
    descripcion: (datos.descripcion ?? "").trim(),
    estatus,
    reportado_dia: dia,
    resuelta_ts: estatus === "resuelto" ? ts : null,
    creada_ts: ts,
    updated_at: ts,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("casos_salud_centros")
    .insert(fila)
    .select("id")
    .single();
  if (error) throw new Error(`[reposCasosSalud] insert: ${error.message}`);
  const id = (data as { id: string }).id;
  registrarHistorial("crear_caso_salud", "caso_salud", id, {
    centro_id: fila.centro_id,
    titulo: fila.titulo,
  });
  return id;
}

export async function actualizarCasoSalud(
  id: string,
  cambios: Partial<Pick<CasoSaludCentro, "titulo" | "descripcion" | "estatus">>,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.titulo !== undefined) fila.titulo = cambios.titulo.trim();
  if (cambios.descripcion !== undefined) fila.descripcion = cambios.descripcion.trim();
  if (cambios.estatus !== undefined) {
    const estatus = normalizarEstatusCasoSalud(cambios.estatus);
    fila.estatus = estatus;
    fila.resuelta_ts = estatus === "resuelto" || estatus === "archivado" ? now : null;
  }
  const { error } = await supabase.from("casos_salud_centros").update(fila).eq("id", id);
  if (error) throw new Error(`[reposCasosSalud] update: ${error.message}`);
  registrarHistorial("actualizar_caso_salud", "caso_salud", id, cambios);
}

export async function archivarCasoSalud(id: string): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("casos_salud_centros")
    .update({
      estatus: "archivado",
      archivada_ts: now,
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposCasosSalud] archivar: ${error.message}`);
  registrarHistorial("archivar_caso_salud", "caso_salud", id);
}

export { normalizarCasoSalud };
