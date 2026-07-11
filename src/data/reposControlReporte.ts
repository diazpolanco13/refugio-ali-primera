import {
  normalizarReporteControlDia,
  type ReporteControlDia,
} from "../domain/controlReporte";
import { registrarHistorial } from "./historial";
import { notificarMutacionLive } from "./liveInvalidation";
import { supabase } from "./supabaseClient";
import { claveDia, usuarioActual } from "./reposSupabase";

export async function guardarReporteControlDia(
  datos: Omit<ReporteControlDia, "id" | "updated_at" | "updated_by"> & { dia?: string },
): Promise<void> {
  const now = Date.now();
  const fila = {
    centro_id: datos.centro_id,
    dia: datos.dia ?? claveDia(now),
    captahuella: datos.captahuella,
    captahuella_nota: datos.captahuella_nota ?? "",
    juez_paz: datos.juez_paz,
    juez_paz_nota: datos.juez_paz_nota ?? "",
    servicio_medico: datos.servicio_medico,
    servicio_medico_nota: datos.servicio_medico_nota ?? "",
    ambulancia: datos.ambulancia,
    ambulancia_nota: datos.ambulancia_nota ?? "",
    revisado: datos.revisado === true,
    updated_at: now,
    updated_by: usuarioActual(),
  };
  const { error } = await supabase
    .from("reportes_control_dia")
    .upsert(fila, { onConflict: "centro_id,dia" });
  if (error) {
    throw new Error(`[reposControlReporte] upsert: ${error.message}`);
  }
  registrarHistorial("reporte_control", "reporte", `${fila.centro_id}/${fila.dia}`, {
    centro_id: fila.centro_id,
    dia: fila.dia,
    revisado: fila.revisado,
  });
  notificarMutacionLive("reportes_control_dia");
}

export async function eliminarReporteControlDia(datos: {
  centro_id: string;
  dia: string;
}): Promise<void> {
  const { error } = await supabase
    .from("reportes_control_dia")
    .delete()
    .eq("centro_id", datos.centro_id)
    .eq("dia", datos.dia);
  if (error) {
    throw new Error(`[reposControlReporte] delete: ${error.message}`);
  }
  registrarHistorial("desmarcar_reporte_control", "reporte", `${datos.centro_id}/${datos.dia}`, {
    centro_id: datos.centro_id,
    dia: datos.dia,
  });
  notificarMutacionLive("reportes_control_dia");
}

export { normalizarReporteControlDia };
