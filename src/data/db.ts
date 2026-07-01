import Dexie, { type EntityTable } from "dexie";
import { SECTOR_COLORES, type PuntoServicio, type Sector } from "../domain/tipos";

/** Mutación pendiente de subir al servidor (cola de sincronización). */
export interface OutboxItem {
  /** Clave = `${entidad}:${id}` (una entrada por entidad+id). */
  clave: string;
  entidad: "sectores" | "puntos";
  id: string;
  updated_at: number;
  deleted: boolean;
  data: unknown;
}

// Base de datos local (IndexedDB). Fuente inmediata para UI offline-first.
const db = new Dexie("refugio-parque-oeste") as Dexie & {
  sectores: EntityTable<Sector, "id">;
  puntos: EntityTable<PuntoServicio, "id">;
  outbox: EntityTable<OutboxItem, "clave">;
};

db.version(1).stores({
  sectores: "id, nombre, updated_at",
  puntos: "id, tipo, estado, updated_at",
});

// v2: sectores con múltiples responsables y color personalizable.
// Migra el antiguo campo `coordinador` a un responsable y asigna un color.
db.version(2)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
  })
  .upgrade(async (tx) => {
    let i = 0;
    await tx
      .table("sectores")
      .toCollection()
      .modify((s: Record<string, unknown>) => {
        if (!Array.isArray(s.responsables)) {
          const coord = typeof s.coordinador === "string" ? s.coordinador.trim() : "";
          s.responsables = coord
            ? [
                {
                  id: nuevoId(),
                  nombre: coord,
                  telefono: "",
                  categoria: "funcionario",
                  funcion: "Coordinación general",
                },
              ]
            : [];
        }
        delete s.coordinador;
        if (typeof s.color !== "string") {
          s.color = SECTOR_COLORES[i % SECTOR_COLORES.length];
        }
        i++;
      });
  });

// v3: cola de sincronización (Fase 2b).
db.version(3).stores({
  sectores: "id, nombre, updated_at",
  puntos: "id, tipo, estado, updated_at",
  outbox: "clave, entidad, updated_at",
});

export { db };

export function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
