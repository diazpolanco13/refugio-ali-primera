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
import { notificarMutacionLive } from "./liveInvalidation";

/** Bloques del reporte cuya auditoría (quién/cuándo) se actualiza en este guardado. */
export type ToqueBloqueReporte = "salud" | "trabajos" | "requerimientos" | "eventos";

type FilaAuditoriaBloques = {
  salud_updated_at: number | null;
  salud_updated_by: string | null;
  trabajos_updated_at: number | null;
  trabajos_updated_by: string | null;
  requerimientos_updated_at: number | null;
  requerimientos_updated_by: string | null;
  eventos_updated_at: number | null;
  eventos_updated_by: string | null;
};

async function leerAuditoriaBloques(
  centroId: string,
  dia: string,
): Promise<FilaAuditoriaBloques | null> {
  const { data, error } = await supabase
    .from("reportes_centros")
    .select(
      "salud_updated_at, salud_updated_by, trabajos_updated_at, trabajos_updated_by, requerimientos_updated_at, requerimientos_updated_by, eventos_updated_at, eventos_updated_by",
    )
    .eq("centro_id", centroId)
    .eq("dia", dia)
    .maybeSingle();
  if (error || !data) return null;
  return data as FilaAuditoriaBloques;
}

function aplicarToquesAuditoria(
  prev: FilaAuditoriaBloques | null,
  toques: ToqueBloqueReporte[] | undefined,
  now: number,
  by: string,
): FilaAuditoriaBloques {
  const base: FilaAuditoriaBloques = {
    salud_updated_at: prev?.salud_updated_at ?? null,
    salud_updated_by: prev?.salud_updated_by ?? null,
    trabajos_updated_at: prev?.trabajos_updated_at ?? null,
    trabajos_updated_by: prev?.trabajos_updated_by ?? null,
    requerimientos_updated_at: prev?.requerimientos_updated_at ?? null,
    requerimientos_updated_by: prev?.requerimientos_updated_by ?? null,
    eventos_updated_at: prev?.eventos_updated_at ?? null,
    eventos_updated_by: prev?.eventos_updated_by ?? null,
  };
  if (!toques?.length) return base;
  for (const t of toques) {
    if (t === "salud") {
      base.salud_updated_at = now;
      base.salud_updated_by = by;
    } else if (t === "trabajos") {
      base.trabajos_updated_at = now;
      base.trabajos_updated_by = by;
    } else if (t === "requerimientos") {
      base.requerimientos_updated_at = now;
      base.requerimientos_updated_by = by;
    } else if (t === "eventos") {
      base.eventos_updated_at = now;
      base.eventos_updated_by = by;
    }
  }
  return base;
}

// ---- Reporte diario ----

/**
 * Guarda/actualiza el reporte diario de un centro (comidas por jornada,
 * atenciones médicas, observaciones). Upsert con clave lógica
 * `(centro_id, dia)`: la última edición del día gana, igual que el snapshot
 * de `ocupaciones_centros`. Si no se pasa `dia`, se usa el día de hoy.
 *
 * `toques` marca qué bloques se están confirmando/editando para actualizar
 * su auditoría propia (quién/cuándo) sin pisar la de los demás.
 */
export async function guardarReporteDiario(
  datos: Omit<
    ReporteDiario,
    | "id"
    | "dia"
    | "updated_at"
    | "updated_by"
    | "salud_updated_at"
    | "salud_updated_by"
    | "trabajos_updated_at"
    | "trabajos_updated_by"
    | "requerimientos_updated_at"
    | "requerimientos_updated_by"
    | "eventos_updated_at"
    | "eventos_updated_by"
  > & {
    dia?: string;
    toques?: ToqueBloqueReporte[];
  },
): Promise<void> {
  const now = Date.now();
  const by = usuarioActual();
  const dia = datos.dia ?? claveDia(now);
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

  const prevAuditoria = await leerAuditoriaBloques(datos.centro_id, dia);
  const auditoria = aplicarToquesAuditoria(prevAuditoria, datos.toques, now, by);

  const fila = {
    centro_id: datos.centro_id,
    dia,
    comidas,
    atenciones_medicas_detalle: detalle,
    atenciones_medicas: totalAtenciones,
    salud_reportada: saludReportada,
    eventos_revisados: eventosRevisados,
    trabajos_revisados: trabajosRevisados,
    requerimientos_revisados: requerimientosRevisados,
    observaciones,
    updated_at: now,
    updated_by: by,
    ...auditoria,
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
        error.message.includes("requerimientos_revisados") ||
        error.message.includes("salud_updated_at") ||
        error.message.includes("trabajos_updated_at") ||
        error.message.includes("requerimientos_updated_at") ||
        error.message.includes("eventos_updated_at")) &&
      (error.message.includes("schema cache") || error.message.includes("column"))
    ) {
      const {
        salud_reportada: _saludReportada,
        eventos_revisados: _eventosRevisados,
        trabajos_revisados: _trabajosRevisados,
        requerimientos_revisados: _requerimientosRevisados,
        salud_updated_at: _sua,
        salud_updated_by: _sub,
        trabajos_updated_at: _tua,
        trabajos_updated_by: _tub,
        requerimientos_updated_at: _rua,
        requerimientos_updated_by: _rub,
        eventos_updated_at: _eua,
        eventos_updated_by: _eub,
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
        notificarMutacionLive("reportes_centros");
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
  notificarMutacionLive("reportes_centros");
}
