import { db, nuevoId, type OutboxItem } from "./db";
import type { LineaReferencia, PuntoServicio, Sector } from "../domain/tipos";
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

export async function guardarSector(
  datos: Omit<Sector, "id" | "updated_at" | "updated_by"> & { id?: string },
): Promise<string> {
  const id = datos.id ?? nuevoId();
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
