// Repos de escritura para el reporte diario por centro (tabla
// `reportes_centros`). Separado de `reposSupabase.ts` para no seguir
// engordando ese archivo; reutiliza sus utilidades (`usuarioActual`,
// `claveDia`).
//
// Realtime (`useReportesCentros`) refresca la UI en todos los dispositivos
// tras cada mutación; aquí no hay estado local.

import {
  contarAtenciones,
  normalizarAtencionesMedicas,
  normalizarComidas,
  type ComidasDia,
  type ReporteDiario,
} from "../domain/reporteDiario";
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
  const trabajosRevisados = datos.trabajos_revisados === true;
  const requerimientosRevisados = datos.requerimientos_revisados === true;
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
    trabajos_revisados: trabajosRevisados,
    requerimientos_revisados: requerimientosRevisados,
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
        error.message.includes("eventos_revisados") ||
        error.message.includes("trabajos_revisados") ||
        error.message.includes("requerimientos_revisados")) &&
      (error.message.includes("schema cache") || error.message.includes("column"))
    ) {
      const {
        salud_reportada: _saludReportada,
        eventos_revisados: _eventosRevisados,
        trabajos_revisados: _trabajosRevisados,
        requerimientos_revisados: _requerimientosRevisados,
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
