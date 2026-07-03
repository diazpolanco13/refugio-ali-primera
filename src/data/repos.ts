import { claveDia, db, nuevoId, type OutboxItem } from "./db";
import {
  normalizarVulnerables,
  type CensoSnapshot,
  type EntregaSector,
  type Jornada,
  type JornadaComida,
  type LineaReferencia,
  type PuntoServicio,
  type RegistroLimpieza,
  type Sector,
} from "../domain/tipos";
import type { CentroTransitorio } from "../domain/centrosTransitorios";
import { getUsuario } from "./auth";
import { notificarCambioLocal } from "./sync";

function usuarioActual(): string {
  return getUsuario()?.username ?? "local";
}

/** Encola una mutación para subir al servidor y avisa al motor de sync. */
async function encolar(item: OutboxItem): Promise<void> {
  await db.outbox.put(item);
  notificarCambioLocal();
}

// ---- Sectores ----

/** ¿Cambiaron los campos de censo entre dos versiones del sector? */
function censoCambio(previo: Sector | undefined, nuevo: Sector): boolean {
  if (!previo) return true;
  if ((previo.poblacion_estimada || 0) !== (nuevo.poblacion_estimada || 0)) return true;
  if ((previo.familias || 0) !== (nuevo.familias || 0)) return true;
  if ((previo.carpas || 0) !== (nuevo.carpas || 0)) return true;
  return (
    JSON.stringify(normalizarVulnerables(previo.vulnerables)) !==
    JSON.stringify(normalizarVulnerables(nuevo.vulnerables))
  );
}

/**
 * Registra una foto del censo de un sector. Id determinista por sector+día:
 * varias ediciones el mismo día colapsan en un solo punto (la última gana),
 * dejando un dato por sector por día para el gráfico poblacional.
 */
export async function registrarCenso(sector: Sector): Promise<void> {
  const ts = sector.updated_at || Date.now();
  const id = `censo-${sector.id}-${claveDia(ts)}`;
  const snap: CensoSnapshot = {
    id,
    sector_id: sector.id,
    sector_nombre: sector.nombre ?? "",
    ts,
    poblacion: sector.poblacion_estimada || 0,
    familias: sector.familias || 0,
    carpas: sector.carpas || 0,
    vulnerables: normalizarVulnerables(sector.vulnerables),
    updated_at: ts,
    updated_by: sector.updated_by,
  };
  await db.censos.put(snap);
  await encolar({
    clave: `censos:${id}`,
    entidad: "censos",
    id,
    updated_at: ts,
    deleted: false,
    data: snap,
  });
}

export async function guardarSector(
  datos: Omit<Sector, "id" | "updated_at" | "updated_by"> & { id?: string },
): Promise<string> {
  const id = datos.id ?? nuevoId();
  const previo = await db.sectores.get(id);
  const sector: Sector = {
    ...datos,
    id,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  await db.sectores.put(sector);
  await encolar({
    clave: `sectores:${id}`,
    entidad: "sectores",
    id,
    updated_at: sector.updated_at,
    deleted: false,
    data: sector,
  });
  // Solo registra una foto del censo cuando cambian los datos poblacionales
  // (evita ruido al editar nombre, color, responsables o geometría).
  if (censoCambio(previo, sector)) {
    await registrarCenso(sector);
  }
  return id;
}

export async function eliminarSector(id: string): Promise<void> {
  const previo = await db.sectores.get(id);
  await db.sectores.delete(id);
  await encolar({
    clave: `sectores:${id}`,
    entidad: "sectores",
    id,
    updated_at: Date.now(),
    deleted: true,
    data: previo ?? { id },
  });
}

// ---- Puntos de servicio ----

export async function guardarPunto(
  datos: Omit<PuntoServicio, "id" | "updated_at" | "updated_by"> & { id?: string },
): Promise<string> {
  const id = datos.id ?? nuevoId();
  const punto: PuntoServicio = {
    ...datos,
    id,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  await db.puntos.put(punto);
  await encolar({
    clave: `puntos:${id}`,
    entidad: "puntos",
    id,
    updated_at: punto.updated_at,
    deleted: false,
    data: punto,
  });
  return id;
}

export async function eliminarPunto(id: string): Promise<void> {
  const previo = await db.puntos.get(id);
  await db.puntos.delete(id);
  await encolar({
    clave: `puntos:${id}`,
    entidad: "puntos",
    id,
    updated_at: Date.now(),
    deleted: true,
    data: previo ?? { id },
  });
}

// ---- Líneas de referencia ----

export async function guardarLinea(
  datos: Omit<LineaReferencia, "id" | "updated_at" | "updated_by"> & { id?: string },
): Promise<string> {
  const id = datos.id ?? nuevoId();
  const linea: LineaReferencia = {
    ...datos,
    id,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  await db.lineas.put(linea);
  await encolar({
    clave: `lineas:${id}`,
    entidad: "lineas",
    id,
    updated_at: linea.updated_at,
    deleted: false,
    data: linea,
  });
  return id;
}

export async function eliminarLinea(id: string): Promise<void> {
  const previo = await db.lineas.get(id);
  await db.lineas.delete(id);
  await encolar({
    clave: `lineas:${id}`,
    entidad: "lineas",
    id,
    updated_at: Date.now(),
    deleted: true,
    data: previo ?? { id },
  });
}

// ---- Distribución de comida / hidratación ----

/** Id determinista de la cabecera de una jornada (una por día+jornada). */
function claveJornada(dia: string, jornada: Jornada): string {
  return `jor-${dia}-${jornada}`;
}

/** Id determinista de la entrega de un sector (una por día+jornada+sector). */
function claveEntrega(dia: string, jornada: Jornada, sectorId: string): string {
  return `ent-${dia}-${jornada}-${sectorId}`;
}

/**
 * Registra/actualiza la cabecera logística de una jornada del día (hora de
 * llegada de la comida, raciones, proveedor). Solo se tocan los campos
 * indicados; el resto se conserva.
 */
export async function guardarJornada(
  dia: string,
  jornada: Jornada,
  datos: {
    hora_llegada?: number | null;
    raciones?: number;
    proveedor?: string;
    notas?: string;
  },
): Promise<void> {
  const id = claveJornada(dia, jornada);
  const previo = (await db.distribuciones.get(id)) as JornadaComida | undefined;
  const now = Date.now();
  const registro: JornadaComida = {
    id,
    clase: "jornada",
    dia,
    jornada,
    hora_llegada:
      datos.hora_llegada !== undefined ? datos.hora_llegada : previo?.hora_llegada ?? null,
    raciones: datos.raciones !== undefined ? datos.raciones : previo?.raciones ?? 0,
    proveedor: datos.proveedor !== undefined ? datos.proveedor : previo?.proveedor ?? "",
    notas: datos.notas !== undefined ? datos.notas : previo?.notas ?? "",
    updated_at: now,
    updated_by: usuarioActual(),
  };
  await db.distribuciones.put(registro);
  await encolar({
    clave: `distribuciones:${id}`,
    entidad: "distribuciones",
    id,
    updated_at: now,
    deleted: false,
    data: registro,
  });
}

/**
 * Marca (o desmarca) que un sector comió/recibió en una jornada. Al marcar
 * fija la hora de entrega = ahora. Conserva la observación previa.
 */
export async function marcarEntrega(
  sector: { id: string; nombre: string },
  dia: string,
  jornada: Jornada,
  entregado: boolean,
): Promise<void> {
  const id = claveEntrega(dia, jornada, sector.id);
  const previo = (await db.distribuciones.get(id)) as EntregaSector | undefined;
  const now = Date.now();
  const registro: EntregaSector = {
    id,
    clase: "entrega",
    dia,
    jornada,
    sector_id: sector.id,
    sector_nombre: sector.nombre ?? "",
    entregado,
    hora_entrega: entregado ? now : null,
    observacion: previo?.observacion ?? "",
    updated_at: now,
    updated_by: usuarioActual(),
  };
  await db.distribuciones.put(registro);
  await encolar({
    clave: `distribuciones:${id}`,
    entidad: "distribuciones",
    id,
    updated_at: now,
    deleted: false,
    data: registro,
  });
}

/** Marca todos los sectores como servidos en una jornada (admin/coordinador). */
export async function marcarTodos(
  sectores: { id: string; nombre: string }[],
  dia: string,
  jornada: Jornada,
): Promise<void> {
  for (const s of sectores) {
    await marcarEntrega(s, dia, jornada, true);
  }
}

// ---- Salubridad y aseo (bitácora de limpieza) ----

/**
 * Registra que un punto de mantenimiento (baño, ducha, basura) fue limpiado /
 * recogido. Crea una fila append-only en la bitácora `limpiezas` (quién +
 * cuándo) y además actualiza `ultimaLimpieza` del punto para mantener vivo el
 * cronómetro del mapa. Cada marca es su propia fila → varios responsables
 * marcan el mismo día sin pisarse.
 */
export async function marcarLimpieza(
  punto: PuntoServicio,
  notas: string = "",
): Promise<void> {
  const ts = Date.now();
  const dia = claveDia(ts);
  const id = `limp-${punto.id}-${ts}`;
  const registro: RegistroLimpieza = {
    id,
    punto_id: punto.id,
    punto_tipo: punto.tipo,
    punto_nombre: punto.nombre ?? "",
    ts,
    dia,
    notas,
    updated_at: ts,
    updated_by: usuarioActual(),
  };
  await db.limpiezas.put(registro);
  await encolar({
    clave: `limpiezas:${id}`,
    entidad: "limpiezas",
    id,
    updated_at: ts,
    deleted: false,
    data: registro,
  });
  // Mantener el cronómetro del punto sincronizado con la última limpieza.
  await guardarPunto({ ...punto, ultimaLimpieza: ts });
}

/**
 * Deshace la última limpieza registrada de un punto en un día (tombstone del
 * evento). Recalcula `ultimaLimpieza` del punto con el evento previo que quede.
 */
export async function deshacerUltimaLimpieza(
  punto: PuntoServicio,
  dia: string,
): Promise<void> {
  const eventos = (
    await db.limpiezas.where("punto_id").equals(punto.id).toArray()
  ).sort((a, b) => b.ts - a.ts);
  const ultimo = eventos.find((e) => e.dia === dia);
  if (!ultimo) return;
  const now = Date.now();
  await db.limpiezas.delete(ultimo.id);
  await encolar({
    clave: `limpiezas:${ultimo.id}`,
    entidad: "limpiezas",
    id: ultimo.id,
    updated_at: now,
    deleted: true,
    data: ultimo,
  });
  // La nueva "última limpieza" es el evento anterior que aún exista.
  const previo = eventos.find((e) => e.id !== ultimo.id);
  await guardarPunto({ ...punto, ultimaLimpieza: previo?.ts ?? undefined });
}

// ---- Centros Transitorios (estado, capacidad y ocupación) ----

/**
 * Guarda/actualiza el estado de un centro (capacidad, ocupación, responsables,
 * foto, estado). El `id` viene del catálogo (`centro-01`…), así que siempre es
 * un upsert last-write-wins. Encola la fila para sincronizar.
 */
export async function guardarCentro(
  datos: Omit<CentroTransitorio, "updated_at" | "updated_by">,
): Promise<string> {
  const centro: CentroTransitorio = {
    ...datos,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  await db.centros.put(centro);
  await encolar({
    clave: `centros:${centro.id}`,
    entidad: "centros",
    id: centro.id,
    updated_at: centro.updated_at as number,
    deleted: false,
    data: centro,
  });
  return centro.id;
}

// ---- Utilidades ----

export async function exportarJSON(): Promise<string> {
  const [sectores, puntos, lineas] = await Promise.all([
    db.sectores.toArray(),
    db.puntos.toArray(),
    db.lineas.toArray(),
  ]);
  return JSON.stringify({ version: 1, sectores, puntos, lineas }, null, 2);
}
