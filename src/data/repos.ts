import { db, nuevoId } from "./db";
import type { PuntoServicio, Sector } from "../domain/tipos";

// Usuario local por defecto (Fase 1 sin auth). En Fase 2 vendrá de Supabase Auth.
const USUARIO_LOCAL = "local";

// ---- Sectores ----

export async function guardarSector(
  datos: Omit<Sector, "id" | "updated_at" | "updated_by"> & { id?: string },
): Promise<string> {
  const id = datos.id ?? nuevoId();
  const sector: Sector = {
    ...datos,
    id,
    updated_at: Date.now(),
    updated_by: USUARIO_LOCAL,
  };
  await db.sectores.put(sector);
  return id;
}

export async function eliminarSector(id: string): Promise<void> {
  await db.sectores.delete(id);
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
    updated_by: USUARIO_LOCAL,
  };
  await db.puntos.put(punto);
  return id;
}

export async function eliminarPunto(id: string): Promise<void> {
  await db.puntos.delete(id);
}

// ---- Utilidades ----

export async function exportarJSON(): Promise<string> {
  const [sectores, puntos] = await Promise.all([
    db.sectores.toArray(),
    db.puntos.toArray(),
  ]);
  return JSON.stringify({ version: 1, sectores, puntos }, null, 2);
}
