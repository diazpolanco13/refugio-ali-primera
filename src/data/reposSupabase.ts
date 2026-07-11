// Nueva capa de repos basada en supabase-js (Fase 3 de la migración).
// Reemplaza a `src/data/repos.ts` (legacy) conservando las MISMAS firmas
// públicas para no romper a los consumidores durante la Fase 4.
//
// Modelo de fila (idéntico al del backend Fastify): cada entidad se guarda
// como **blob JSON + metadatos** en su tabla (`id, updated_at, updated_by,
// deleted, data`). El `data` lleva el objeto completo; los metadatos mandan
// sobre el blob para garantizar id/updated_at consistentes. Upsert
// last-write-wins. El borrado es **suave** (`deleted: true`), no se borra la
// fila (para que el histórico sea reconstruible y RLS funcione).
//
// Realtime + `useSupabaseQuery` se encargan de refrescar la UI tras cada
// mutación; `notificarCambioLocal()` queda como no-op por compatibilidad.

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
import {
  normalizarCentro,
  normalizarPersonal,
  totalPersonalOperativo,
  type CentroTransitorio,
} from "../domain/centrosTransitorios";
import { supabase } from "./supabaseClient";
import { getUsuario } from "./authSupabase";
import { registrarHistorial } from "./historial";
import { notificarMutacionLive } from "./liveInvalidation";
import { desenvolver, type FilaSync } from "./desenvolver";

// ---- Utilidades ----

/** Devuelve el username del usuario logueado (o "local" si no hay sesión). */
export function usuarioActual(): string {
  return getUsuario()?.username ?? "local";
}

/** Marca de tiempo de la última limpieza registrada (reexport de dominio). */
export function claveDia(ts: number): string {
  const d = new Date(ts);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function nuevoId(): string {
  const cryptoApi = typeof crypto !== "undefined" ? (crypto as Partial<Crypto>) : undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  // `crypto.randomUUID` solo existe en contextos seguros (https/localhost).
  // En despliegues http (p. ej. el dev server accedido por IP) generamos un
  // UUID v4 con getRandomValues: varias tablas (eventos_reportes, etc.)
  // tienen columna `id uuid` y rechazan cualquier otro formato.
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * No-op: con Supabase Realtime no hay cola ni motor de sync. Se conserva por
 * compatibilidad con consumidores legacy que la invoquen.
 */
export function notificarCambioLocal(): void {
  /* no-op */
}

/** Estructura de fila que guardan las tablas blob (sectores, puntos, etc.). */
interface FilaBlob {
  id: string;
  updated_at: number;
  updated_by: string;
  deleted: boolean;
  data: unknown;
}

/** Upsert de una fila blob en su tabla. */
async function upsertFila(tabla: string, fila: FilaBlob): Promise<void> {
  const { error } = await supabase.from(tabla).upsert(fila);
  if (error) throw new Error(`[reposSupabase] upsert ${tabla}: ${error.message}`);
}

/** Marca una fila como borrada (borrado suave). */
async function borrarSuave(tabla: string, id: string, dataFallback: unknown): Promise<void> {
  const now = Date.now();
  const { error } = await supabase
    .from(tabla)
    .update({ deleted: true, updated_at: now, data: dataFallback })
    .eq("id", id);
  if (error) throw new Error(`[reposSupabase] delete ${tabla}: ${error.message}`);
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

/** Lee un sector por id desde Supabase (devuelve undefined si no existe). */
async function leerSector(id: string): Promise<Sector | undefined> {
  const { data, error } = await supabase
    .from("sectores")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[reposSupabase] leerSector:", error.message);
    return undefined;
  }
  return (data?.data as Sector | undefined) ?? undefined;
}

/**
 * Registra una foto del censo de un sector. Id determinista por sector+día:
 * varias ediciones el mismo día colapsan en un solo punto (la última gana).
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
  await upsertFila("censos", {
    id,
    updated_at: ts,
    updated_by: sector.updated_by ?? usuarioActual(),
    deleted: false,
    data: snap,
  });
}

export async function guardarSector(
  datos: Omit<Sector, "id" | "updated_at" | "updated_by"> & { id?: string },
): Promise<string> {
  const id = datos.id ?? nuevoId();
  const previo = await leerSector(id);
  const sector: Sector = {
    ...datos,
    id,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  await upsertFila("sectores", {
    id,
    updated_at: sector.updated_at,
    updated_by: sector.updated_by,
    deleted: false,
    data: sector,
  });
  if (censoCambio(previo, sector)) {
    await registrarCenso(sector);
  }
  return id;
}

export async function eliminarSector(id: string): Promise<void> {
  const previo = await leerSector(id);
  await borrarSuave("sectores", id, previo ?? { id });
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
  await upsertFila("puntos", {
    id,
    updated_at: punto.updated_at,
    updated_by: punto.updated_by,
    deleted: false,
    data: punto,
  });
  return id;
}

export async function eliminarPunto(id: string): Promise<void> {
  const { data } = await supabase
    .from("puntos")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  await borrarSuave("puntos", id, (data?.data as PuntoServicio | undefined) ?? { id });
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
  await upsertFila("lineas", {
    id,
    updated_at: linea.updated_at,
    updated_by: linea.updated_by,
    deleted: false,
    data: linea,
  });
  return id;
}

export async function eliminarLinea(id: string): Promise<void> {
  const { data } = await supabase
    .from("lineas")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  await borrarSuave("lineas", id, (data?.data as LineaReferencia | undefined) ?? { id });
}

// ---- Distribución de comida / hidratación ----

function claveJornada(dia: string, jornada: Jornada): string {
  return `jor-${dia}-${jornada}`;
}

function claveEntrega(dia: string, jornada: Jornada, sectorId: string): string {
  return `ent-${dia}-${jornada}-${sectorId}`;
}

/** Lee una fila de `distribuciones` por id (cabecera o entrega). */
async function leerDistribucion<T extends { id: string }>(id: string): Promise<T | undefined> {
  const { data, error } = await supabase
    .from("distribuciones")
    .select("data")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[reposSupabase] leerDistribucion:", error.message);
    return undefined;
  }
  return (data?.data as T | undefined) ?? undefined;
}

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
  const previo = await leerDistribucion<JornadaComida>(id);
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
  await upsertFila("distribuciones", {
    id,
    updated_at: now,
    updated_by: registro.updated_by,
    deleted: false,
    data: registro,
  });
}

export async function marcarEntrega(
  sector: { id: string; nombre: string },
  dia: string,
  jornada: Jornada,
  entregado: boolean,
): Promise<void> {
  const id = claveEntrega(dia, jornada, sector.id);
  const previo = await leerDistribucion<EntregaSector>(id);
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
  await upsertFila("distribuciones", {
    id,
    updated_at: now,
    updated_by: registro.updated_by,
    deleted: false,
    data: registro,
  });
}

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
 * Registra que un punto de mantenimiento fue limpiado/recogido. Crea la fila
 * append-only en `limpiezas` (quién+cuándo) y actualiza `ultimaLimpieza` del
 * punto para mantener vivo el cronómetro del mapa.
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
  await upsertFila("limpiezas", {
    id,
    updated_at: ts,
    updated_by: registro.updated_by,
    deleted: false,
    data: registro,
  });
  // Mantener el cronómetro del punto sincronizado con la última limpieza.
  await guardarPunto({ ...punto, ultimaLimpieza: ts });
}

/**
 * Deshace la última limpieza registrada de un punto en un día (borrado suave).
 * Recalcula `ultimaLimpieza` del punto con el evento previo que quede.
 */
export async function deshacerUltimaLimpieza(
  punto: PuntoServicio,
  dia: string,
): Promise<void> {
  // Trae los eventos del punto ordenados por ts desc. `punto_id` vive dentro
  // del blob `data` (tabla blob+jsonb), así que filtramos por JSON path.
  const { data, error } = await supabase
    .from("limpiezas")
    .select("data")
    .filter("data->>punto_id", "eq", punto.id);
  if (error) {
    console.warn("[reposSupabase] deshacerUltimaLimpieza:", error.message);
    return;
  }
  const eventos = ((data ?? []) as { data: RegistroLimpieza }[])
    .map((r) => r.data)
    .filter((r): r is RegistroLimpieza => Boolean(r))
    .sort((a, b) => b.ts - a.ts);
  const ultimo = eventos.find((e) => e.dia === dia);
  if (!ultimo) return;
  await borrarSuave("limpiezas", ultimo.id, ultimo);
  // La nueva "última limpieza" es el evento anterior que aún exista.
  const previo = eventos.find((e) => e.id !== ultimo.id);
  await guardarPunto({ ...punto, ultimaLimpieza: previo?.ts ?? undefined });
}

// ---- Centros Transitorios ----

/** ¿Cambió el parte numérico (población + personal) respecto a la versión previa? */
function parteNumericoCambio(
  previo: CentroTransitorio | undefined,
  nuevo: CentroTransitorio,
): boolean {
  if (!previo) return true;
  if ((previo.familias_ocupadas ?? 0) !== (nuevo.familias_ocupadas ?? 0)) return true;
  if ((previo.total_afectados ?? 0) !== (nuevo.total_afectados ?? 0)) return true;
  if (
    JSON.stringify(normalizarPersonal(previo.personal)) !==
    JSON.stringify(normalizarPersonal(nuevo.personal))
  ) {
    return true;
  }
  return (
    JSON.stringify(normalizarVulnerables(previo.ocupacion)) !==
    JSON.stringify(normalizarVulnerables(nuevo.ocupacion))
  );
}

function filaSnapshotOcupacion(
  centro: CentroTransitorio,
  dia: string,
  ts: number,
  opts: { omitirPersonal?: boolean; incidenciasSalud?: number } = {},
) {
  const norm = normalizarCentro(centro);
  return {
    centro_id: centro.id,
    dia,
    ts,
    total_afectados: norm.total_afectados,
    familias: norm.familias_ocupadas,
    personal_total: opts.omitirPersonal
      ? 0
      : totalPersonalOperativo(normalizarPersonal(norm.personal)),
    incidencias_salud: opts.incidenciasSalud ?? 0,
    ocupacion: normalizarVulnerables(norm.ocupacion),
    updated_at: ts,
    updated_by: usuarioActual(),
  };
}

async function upsertSnapshotOcupacion(
  centro: CentroTransitorio,
  dia: string,
  ts: number,
  opts: { omitirPersonal?: boolean; incidenciasSalud?: number } = {},
): Promise<void> {
  let incidencias = opts.incidenciasSalud;
  if (incidencias == null) {
    const { data } = await supabase
      .from("ocupaciones_centros")
      .select("incidencias_salud")
      .eq("centro_id", centro.id)
      .eq("dia", dia)
      .maybeSingle();
    incidencias = data?.incidencias_salud ?? 0;
  }
  const { error } = await supabase
    .from("ocupaciones_centros")
    .upsert(filaSnapshotOcupacion(centro, dia, ts, {
      omitirPersonal: opts.omitirPersonal,
      incidenciasSalud: incidencias,
    }), { onConflict: "centro_id,dia" });
  if (error) {
    throw new Error(`[reposSupabase] upsert ocupaciones_centros: ${error.message}`);
  }
  notificarMutacionLive("ocupaciones_centros");
}

/** Lee un centro por id desde Supabase (incluye `geom` normalizado). */
async function leerCentro(id: string): Promise<CentroTransitorio | undefined> {
  const { data, error } = await supabase
    .from("centros")
    .select("id, updated_at, updated_by, deleted, data, geom")
    .eq("id", id)
    .eq("deleted", false)
    .maybeSingle();
  if (error) {
    console.warn("[reposSupabase] leerCentro:", error.message);
    return undefined;
  }
  if (!data) return undefined;
  const { deleted: _borrado, ...centro } = desenvolver(data as FilaSync<CentroTransitorio>);
  return centro as CentroTransitorio;
}

/** Lectura pública de un centro (p. ej. geolocalización en terreno tras login). */
export async function obtenerCentroPorId(
  id: string,
): Promise<CentroTransitorio | undefined> {
  return leerCentro(id);
}

async function upsertCentroVivo(centro: CentroTransitorio): Promise<void> {
  const [lng, lat] = centro.geom?.coordinates ?? [null, null];
  const { error } = await supabase.rpc("upsert_centro", {
    p_id: centro.id,
    p_data: centro,
    p_lng: lng,
    p_lat: lat,
  });
  if (error) throw new Error(`[reposSupabase] upsert_centro: ${error.message}`);
}

/**
 * Guarda/actualiza el estado de un centro (crea la fila si no existe: sirve
 * tanto para editar como para registrar centros nuevos). Usa el RPC
 * `upsert_centro` (SECURITY INVOKER, ver `supabase/functions.sql`) para que en
 * la misma llamada se actualice el blob `data` y la columna PostGIS `geom` con
 * las coordenadas del centro — algo que supabase-js no puede hacer con un
 * upsert normal. Las políticas RLS de `centros` siguen aplicando.
 */
export async function guardarCentro(
  datos: Omit<CentroTransitorio, "updated_at" | "updated_by">,
): Promise<string> {
  const previo = await leerCentro(datos.id);
  const centro: CentroTransitorio = {
    ...datos,
    updated_at: Date.now(),
    updated_by: usuarioActual(),
  };
  await upsertCentroVivo(centro);

  registrarHistorial(previo ? "editar_centro" : "crear_centro", "centro", centro.id, {
    nombre: centro.nombre,
    nro: centro.nro ?? null,
  });

  // Snapshot diario de ocupación (histórico) si el parte numérico cambió.
  if (parteNumericoCambio(previo, centro)) {
    const ts = centro.updated_at as number;
    await upsertSnapshotOcupacion(centro, claveDia(ts), ts);
  }
  return centro.id;
}

/**
 * Confirma el parte numérico del día sin modificar el centro: crea/actualiza
 * el snapshot en `ocupaciones_centros` aunque las cifras sean iguales al último
 * registro. Uso típico: «sin cambios respecto a ayer» en el reporte del día.
 */
export async function confirmarParteNumericoDia(
  datos: Omit<CentroTransitorio, "updated_at" | "updated_by">,
  dia?: string,
  opts: { incidenciasSalud?: number; omitirPersonal?: boolean; soloSnapshot?: boolean } = {},
): Promise<void> {
  const ts = Date.now();
  const diaSnap = dia ?? claveDia(ts);
  const centro = normalizarCentro({ ...datos, updated_at: ts, updated_by: usuarioActual() });
  if (!opts.soloSnapshot) {
    await upsertCentroVivo(centro);
  }
  await upsertSnapshotOcupacion(centro, diaSnap, ts, {
    omitirPersonal: opts.omitirPersonal,
    incidenciasSalud: opts.incidenciasSalud,
  });
}

/**
 * Guarda el conteo de incidencias de salud del día en `ocupaciones_centros`.
 * Si ya hay snapshot, solo actualiza `incidencias_salud`; si no, crea uno con
 * la demografía vigente del centro (sin tocar el blob del centro).
 */
export async function guardarIncidenciasSaludDia(
  centro: Omit<CentroTransitorio, "updated_at" | "updated_by">,
  dia: string,
  incidenciasSalud: number,
): Promise<void> {
  const ts = Date.now();
  const { data: existente, error: errLectura } = await supabase
    .from("ocupaciones_centros")
    .select("id")
    .eq("centro_id", centro.id)
    .eq("dia", dia)
    .maybeSingle();
  if (errLectura) {
    throw new Error(`[reposSupabase] leer ocupaciones_centros: ${errLectura.message}`);
  }

  if (existente?.id) {
    const { error } = await supabase
      .from("ocupaciones_centros")
      .update({
        incidencias_salud: Math.max(0, incidenciasSalud),
        updated_at: ts,
        updated_by: usuarioActual(),
      })
      .eq("id", existente.id);
    if (error) {
      throw new Error(`[reposSupabase] update incidencias_salud: ${error.message}`);
    }
  } else {
    const norm = normalizarCentro({
      ...centro,
      updated_at: ts,
      updated_by: usuarioActual(),
    });
    await upsertSnapshotOcupacion(norm, dia, ts, {
      omitirPersonal: true,
      incidenciasSalud: Math.max(0, incidenciasSalud),
    });
  }

  registrarHistorial("guardar_incidencias_salud", "reporte", `${centro.id}/${dia}`, {
    centro_id: centro.id,
    dia,
    incidencias_salud: Math.max(0, incidenciasSalud),
  });
  notificarMutacionLive("ocupaciones_centros");
}

/** Quita solo el snapshot del parte numérico de un día; no modifica el centro. */
export async function eliminarParteNumericoDia(centroId: string, dia: string): Promise<void> {
  const { error } = await supabase
    .from("ocupaciones_centros")
    .delete()
    .eq("centro_id", centroId)
    .eq("dia", dia);
  if (error) {
    throw new Error(`[reposSupabase] delete ocupaciones_centros: ${error.message}`);
  }
  registrarHistorial("desmarcar_parte_numerico", "reporte", `${centroId}/${dia}`, {
    centro_id: centroId,
    dia,
  });
  notificarMutacionLive("ocupaciones_centros");
}

/**
 * Elimina un centro (borrado suave, igual que el resto de entidades). La fila
 * queda con `deleted: true`, así que desaparece de la UI pero el histórico de
 * `ocupaciones_centros` sigue reconstruible. Nota: como el centro deja de
 * estar en el catálogo activo, sus snapshots dejan de aportar a las series
 * agregadas de la red (que iteran sobre los centros no borrados).
 */
export async function eliminarCentro(id: string): Promise<void> {
  const previo = await leerCentro(id);
  await borrarSuave("centros", id, previo ?? { id });
  registrarHistorial("eliminar_centro", "centro", id, {
    nombre: previo?.nombre ?? null,
    nro: previo?.nro ?? null,
  });
}

// ---- Utilidades de exportación (compatibilidad con legacy) ----

/**
 * Exporta sectores, puntos y lineas a JSON. Útil para backups manuales.
 * Lee desde Supabase (no desde Dexie como la versión legacy).
 */
export async function exportarJSON(): Promise<string> {
  const [sectRes, puntRes, linRes] = await Promise.all([
    supabase.from("sectores").select("data").eq("deleted", false),
    supabase.from("puntos").select("data").eq("deleted", false),
    supabase.from("lineas").select("data").eq("deleted", false),
  ]);
  const sectores = (sectRes.data ?? []).map((r) => r.data);
  const puntos = (puntRes.data ?? []).map((r) => r.data);
  const lineas = (linRes.data ?? []).map((r) => r.data);
  return JSON.stringify({ version: 2, sectores, puntos, lineas }, null, 2);
}
