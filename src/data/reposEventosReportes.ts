// Repos de escritura para eventos del reporte diario (`eventos_reportes`).

import {
  normalizarParticipantesEvento,
  normalizarTipoEventoReporte,
  type EventoReporte,
} from "../domain/eventosReportes";
import { registrarHistorial } from "./historial";
import { notificarMutacionLive } from "./liveInvalidation";
import { nuevoId, usuarioActual } from "./reposSupabase";
import { supabase } from "./supabaseClient";

type EventoEditable = Pick<
  EventoReporte,
  | "id"
  | "centro_id"
  | "dia"
  | "ts"
  | "tipo"
  | "titulo"
  | "descripcion"
  | "participantes"
  | "creada_por"
>;

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guarda el conjunto de eventos de un centro/día, actualizando y retirando los eliminados. */
export async function guardarEventosReporteDia(datos: {
  centro_id: string;
  dia: string;
  eventos: EventoEditable[];
  idsExistentes?: string[];
}): Promise<void> {
  const now = Date.now();
  const idsExistentes = datos.idsExistentes ?? [];
  const eventos = datos.eventos
    .map((evento) => ({
      // La columna es uuid: si el evento traía un id local inválido (p. ej.
      // generado antes del fix de nuevoId en contextos http), se regenera.
      id: evento.id && RE_UUID.test(evento.id) ? evento.id : nuevoId(),
      centro_id: datos.centro_id,
      dia: datos.dia,
      ts: evento.ts || now,
      tipo: normalizarTipoEventoReporte(evento.tipo),
      titulo: evento.titulo.trim(),
      descripcion: evento.descripcion.trim(),
      participantes: normalizarParticipantesEvento(evento.participantes),
      creada_por: evento.creada_por || usuarioActual(),
      updated_at: now,
      updated_by: usuarioActual(),
    }))
    .filter((evento) => evento.titulo.length > 0);

  const idsDestino = new Set(eventos.map((evento) => evento.id));
  const idsEliminar = idsExistentes.filter((id) => !idsDestino.has(id));

  if (idsEliminar.length > 0) {
    const { error } = await supabase
      .from("eventos_reportes")
      .delete()
      .in("id", idsEliminar);
    if (error) {
      throw new Error(`[reposEventosReportes] delete eventos_reportes: ${error.message}`);
    }
  }

  if (eventos.length > 0) {
    const { error } = await supabase
      .from("eventos_reportes")
      .upsert(eventos, { onConflict: "id" });
    if (error) {
      throw new Error(`[reposEventosReportes] upsert eventos_reportes: ${error.message}`);
    }
  }

  registrarHistorial("reporte_eventos", "reporte", `${datos.centro_id}/${datos.dia}`, {
    centro_id: datos.centro_id,
    dia: datos.dia,
    eventos: eventos.length,
    eliminados: idsEliminar.length,
  });
  notificarMutacionLive("eventos_reportes");
}

/** Crea una novedad del reporte diario (`eventos_reportes`). */
export async function crearEventoReporte(datos: {
  centro_id: string;
  dia: string;
  tipo?: EventoReporte["tipo"];
  titulo: string;
  descripcion?: string;
  ts?: number;
  participantes?: EventoReporte["participantes"];
}): Promise<string> {
  const now = Date.now();
  const id = nuevoId();
  const fila = {
    id,
    centro_id: datos.centro_id,
    dia: datos.dia,
    ts: datos.ts ?? now,
    tipo: normalizarTipoEventoReporte(datos.tipo),
    titulo: datos.titulo.trim(),
    descripcion: (datos.descripcion ?? "").trim(),
    participantes: normalizarParticipantesEvento(datos.participantes ?? []),
    creada_por: usuarioActual(),
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (!fila.titulo) {
    throw new Error("[reposEventosReportes] crear: título obligatorio");
  }
  const { error } = await supabase.from("eventos_reportes").insert(fila);
  if (error) throw new Error(`[reposEventosReportes] insert: ${error.message}`);
  registrarHistorial("crear_evento_reporte", "evento_reporte", id, {
    centro_id: fila.centro_id,
    dia: fila.dia,
    titulo: fila.titulo,
  });
  notificarMutacionLive("eventos_reportes");
  return id;
}

/** Actualiza una novedad existente (`eventos_reportes`). */
export async function actualizarEventoReporte(
  id: string,
  cambios: Partial<
    Pick<EventoReporte, "tipo" | "titulo" | "descripcion" | "ts" | "participantes">
  >,
): Promise<void> {
  const now = Date.now();
  const fila: Record<string, unknown> = {
    updated_at: now,
    updated_by: usuarioActual(),
  };
  if (cambios.tipo !== undefined) fila.tipo = normalizarTipoEventoReporte(cambios.tipo);
  if (cambios.titulo !== undefined) fila.titulo = cambios.titulo.trim();
  if (cambios.descripcion !== undefined) fila.descripcion = cambios.descripcion.trim();
  if (cambios.ts !== undefined) fila.ts = cambios.ts;
  if (cambios.participantes !== undefined) {
    fila.participantes = normalizarParticipantesEvento(cambios.participantes);
  }
  const { error } = await supabase.from("eventos_reportes").update(fila).eq("id", id);
  if (error) throw new Error(`[reposEventosReportes] update: ${error.message}`);
  registrarHistorial("actualizar_evento_reporte", "evento_reporte", id, cambios);
  notificarMutacionLive("eventos_reportes");
}

/** Elimina una novedad del reporte diario. */
export async function eliminarEventoReporte(id: string): Promise<void> {
  const { error } = await supabase.from("eventos_reportes").delete().eq("id", id);
  if (error) throw new Error(`[reposEventosReportes] delete: ${error.message}`);
  registrarHistorial("eliminar_evento_reporte", "evento_reporte", id);
  notificarMutacionLive("eventos_reportes");
}
