import Dexie, { type EntityTable } from "dexie";
import { SECTOR_COLORES, type PuntoServicio, type Sector } from "../domain/tipos";

// Base de datos local (IndexedDB). Fuente inmediata para UI offline-first.
// En Fase 2 se añade una cola de sincronización hacia Supabase.
const db = new Dexie("refugio-parque-oeste") as Dexie & {
  sectores: EntityTable<Sector, "id">;
  puntos: EntityTable<PuntoServicio, "id">;
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

export { db };

export function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
