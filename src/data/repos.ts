import { claveDia, db, nuevoId, type OutboxItem } from "./db";
import {
  normalizarVulnerables,
  type CensoSnapshot,
  type LineaReferencia,
  type PuntoServicio,
  type Sector,
} from "../domain/tipos";
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

// ---- Utilidades ----

export async function exportarJSON(): Promise<string> {
  const [sectores, puntos, lineas] = await Promise.all([
    db.sectores.toArray(),
    db.puntos.toArray(),
    db.lineas.toArray(),
  ]);
  return JSON.stringify({ version: 1, sectores, puntos, lineas }, null, 2);
}
