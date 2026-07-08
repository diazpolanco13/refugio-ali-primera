import {
  normalizarCategoriaRequerimiento,
  normalizarEstatusRequerimiento,
  normalizarRequerimientoSeguimiento,
  type CategoriaRequerimientoSeguimiento,
  type RequerimientoSeguimiento,
} from "../domain/requerimientosSeguimiento";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";
import { registrarHistorial } from "./historial";

export async function crearRequerimientoSeguimiento(datos: {
  centro_id: string;
  concepto: string;
  cantidad?: number;
  categoria?: CategoriaRequerimientoSeguimiento;
  notas?: string;
  reportado_dia?: string;
}): Promise<string> {
  const ts = Date.now();
  const fila = {
    centro_id: datos.centro_id,
    concepto: datos.concepto.trim(),
    cantidad: Math.max(0, Math.floor(datos.cantidad ?? 0)),
    categoria: normalizarCategoriaRequerimiento(datos.categoria),
    notas: (datos.notas ?? "").trim(),
    estatus: "solicitado" as const,
    reportado_dia: datos.reportado_dia ?? claveDia(ts),
    creada_ts: ts,
    updated_at: ts,
    updated_by: usuarioActual(),
  };
  const { data, error } = await supabase
    .from("requerimientos_seguimiento")
    .insert(fila)
    .select("id")
    .single();
  if (error) throw new Error(`[reposRequerimientosSeguimiento] insert: ${error.message}`);
  const id = (data as { id: string }).id;
  registrarHistorial("crear_requerimiento", "requerimiento", id, {
    centro_id: fila.centro_id,
    concepto: fila.concepto,
  });
  return id;
}

export async function actualizarRequerimientoSeguimiento(
  id: string,
  cambios: Partial<
    Pick<
      RequerimientoSeguimiento,
      "concepto" | "cantidad" | "categoria" | "notas" | "estatus"
    >
  >,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.concepto !== undefined) fila.concepto = cambios.concepto.trim();
  if (cambios.cantidad !== undefined) {
    fila.cantidad = Math.max(0, Math.floor(cambios.cantidad));
  }
  if (cambios.categoria !== undefined) {
    fila.categoria = normalizarCategoriaRequerimiento(cambios.categoria);
  }
  if (cambios.notas !== undefined) fila.notas = cambios.notas.trim();
  if (cambios.estatus !== undefined) {
    const estatus = normalizarEstatusRequerimiento(cambios.estatus);
    fila.estatus = estatus;
    fila.resuelta_ts = estatus === "entregado" || estatus === "archivado" ? now : null;
  }
  const { error } = await supabase.from("requerimientos_seguimiento").update(fila).eq("id", id);
  if (error) throw new Error(`[reposRequerimientosSeguimiento] update: ${error.message}`);
  registrarHistorial("actualizar_requerimiento", "requerimiento", id, cambios);
}

export async function archivarRequerimientoSeguimiento(id: string): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from("requerimientos_seguimiento")
    .update({
      estatus: "archivado",
      archivada_ts: now,
      resuelta_ts: now,
      updated_at: now,
      updated_by: usuarioActual(),
    })
    .eq("id", id);
  if (error) throw new Error(`[reposRequerimientosSeguimiento] archivar: ${error.message}`);
  registrarHistorial("archivar_requerimiento", "requerimiento", id);
}

export async function eliminarRequerimientoSeguimiento(id: string): Promise<void> {
  const { error } = await supabase.from("requerimientos_seguimiento").delete().eq("id", id);
  if (error) throw new Error(`[reposRequerimientosSeguimiento] delete: ${error.message}`);
  registrarHistorial("eliminar_requerimiento", "requerimiento", id);
}

export { normalizarRequerimientoSeguimiento };
