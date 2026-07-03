import Dexie, { type EntityTable } from "dexie";
import {
  SECTOR_COLORES,
  VULNERABLES_VACIO,
  normalizarVulnerables,
  type CensoSnapshot,
  type LineaReferencia,
  type PuntoServicio,
  type RegistroDistribucion,
  type RegistroLimpieza,
  type Sector,
} from "../domain/tipos";
import type { CentroTransitorio } from "../domain/centrosTransitorios";
import { CENTROS_TRANSITORIOS, LEVANTAMIENTO_DEMO_CENTRO_10 } from "./centrosTransitorios";

/** Entidades sincronizables (blob JSON + metadatos, last-write-wins). */
export type Entidad =
  | "sectores"
  | "puntos"
  | "lineas"
  | "censos"
  | "distribuciones"
  | "limpiezas"
  | "centros";

/**
 * Timestamp de la siembra del catálogo estático de centros. Muy bajo a propósito:
 * garantiza que cualquier edición real (ts ≈ Date.now()) gane en last-write-wins,
 * y que los datos editados que lleguen del servidor sobrescriban la base local.
 */
const SEMILLA_CENTROS_TS = 1;

/**
 * Timestamp del levantamiento demo precargado (centro-10). Por encima de la
 * siembra de catálogo pero muy bajo vs. ediciones reales (~Date.now()).
 */
export const DEMO_CENTRO_10_TS = 2;

const ID_CENTRO_DEMO = "centro-10";

/** Mutación pendiente de subir al servidor (cola de sincronización). */
export interface OutboxItem {
  /** Clave = `${entidad}:${id}` (una entrada por entidad+id). */
  clave: string;
  entidad: Entidad;
  id: string;
  updated_at: number;
  deleted: boolean;
  data: unknown;
}

// Base de datos local (IndexedDB). Fuente inmediata para UI offline-first.
const db = new Dexie("refugio-parque-oeste") as Dexie & {
  sectores: EntityTable<Sector, "id">;
  puntos: EntityTable<PuntoServicio, "id">;
  lineas: EntityTable<LineaReferencia, "id">;
  censos: EntityTable<CensoSnapshot, "id">;
  distribuciones: EntityTable<RegistroDistribucion, "id">;
  limpiezas: EntityTable<RegistroLimpieza, "id">;
  centros: EntityTable<CentroTransitorio, "id">;
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

// v4: desglose demográfico por edad y sexo. Los totales antiguos (ninos,
// adultos_mayores, discapacidad) no tenían sexo; se ponen los nuevos campos
// en 0 (el usuario los recompleta). Se conserva `embarazadas` (mismo campo).
db.version(4)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
    outbox: "clave, entidad, updated_at",
  })
  .upgrade(async (tx) => {
    await tx
      .table("sectores")
      .toCollection()
      .modify((s: Record<string, unknown>) => {
        const v = (s.vulnerables ?? {}) as Record<string, unknown>;
        const embarazadas =
          typeof v.embarazadas === "number" ? v.embarazadas : 0;
        s.vulnerables = { ...VULNERABLES_VACIO, embarazadas };
      });
  });

// v5: líneas de referencia cartográfica (límites del parque, calles, caminerías).
db.version(5).stores({
  sectores: "id, nombre, updated_at",
  puntos: "id, tipo, estado, updated_at",
  lineas: "id, tipo, updated_at",
  outbox: "clave, entidad, updated_at",
});

// v6: conteo de carpas por sector (censo en campo: primero carpas, luego familias).
db.version(6)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
    lineas: "id, tipo, updated_at",
    outbox: "clave, entidad, updated_at",
  })
  .upgrade(async (tx) => {
    await tx.table("sectores").toCollection().modify((s: Record<string, unknown>) => {
      if (typeof s.carpas !== "number") s.carpas = 0;
    });
  });

// v7: registro poblacional histórico (snapshots del censo por sector). Al migrar,
// se crea una foto inicial por cada sector existente (id determinista por
// sector+día para que todos los dispositivos converjan sin duplicar) y se encola
// para sincronizar con el servidor.
db.version(7)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
    lineas: "id, tipo, updated_at",
    censos: "id, sector_id, ts, updated_at",
    outbox: "clave, entidad, updated_at",
  })
  .upgrade(async (tx) => {
    const sectores = await tx.table("sectores").toArray();
    for (const s of sectores as Sector[]) {
      const ts = s.updated_at || Date.now();
      const id = `censo-init-${s.id}-${claveDia(ts)}`;
      const snap: CensoSnapshot = {
        id,
        sector_id: s.id,
        sector_nombre: s.nombre ?? "",
        ts,
        poblacion: s.poblacion_estimada || 0,
        familias: s.familias || 0,
        carpas: s.carpas || 0,
        vulnerables: normalizarVulnerables(s.vulnerables),
        updated_at: ts,
        updated_by: s.updated_by ?? "local",
      };
      await tx.table("censos").put(snap);
      await tx.table("outbox").put({
        clave: `censos:${id}`,
        entidad: "censos",
        id,
        updated_at: ts,
        deleted: false,
        data: snap,
      });
    }
  });

// v8: registro de distribución de comida e hidratación (jornadas + entregas por
// sector). Nueva entidad sincronizable, sin migración de datos previos.
db.version(8).stores({
  sectores: "id, nombre, updated_at",
  puntos: "id, tipo, estado, updated_at",
  lineas: "id, tipo, updated_at",
  censos: "id, sector_id, ts, updated_at",
  distribuciones: "id, clase, dia, jornada, sector_id, updated_at",
  outbox: "clave, entidad, updated_at",
});

// v9: bitácora de salubridad y aseo (limpiezas de baños/duchas/basura, quién y
// cuándo). Nueva entidad sincronizable, sin migración de datos previos.
db.version(9).stores({
  sectores: "id, nombre, updated_at",
  puntos: "id, tipo, estado, updated_at",
  lineas: "id, tipo, updated_at",
  censos: "id, sector_id, ts, updated_at",
  distribuciones: "id, clase, dia, jornada, sector_id, updated_at",
  limpiezas: "id, punto_id, dia, ts, updated_at",
  outbox: "clave, entidad, updated_at",
});

// v10: red de Centros Transitorios (estado, capacidad y ocupación). Nueva
// entidad sincronizable. Al migrar se siembra el catálogo estático de los 50
// centros (id determinista → todos los dispositivos convergen sin duplicar) con
// un `updated_at` muy bajo para que cualquier edición real gane. No se encola:
// el catálogo base viene en el bundle; solo las ediciones se sincronizan.
db.version(10)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
    lineas: "id, tipo, updated_at",
    censos: "id, sector_id, ts, updated_at",
    distribuciones: "id, clase, dia, jornada, sector_id, updated_at",
    limpiezas: "id, punto_id, dia, ts, updated_at",
    centros: "id, nro, cuerpo, grupo, updated_at",
    outbox: "clave, entidad, updated_at",
  })
  .upgrade(async (tx) => {
    for (const c of CENTROS_TRANSITORIOS) {
      const existente = await tx.table("centros").get(c.id);
      if (existente) continue;
      await tx.table("centros").put({
        ...c,
        updated_at: SEMILLA_CENTROS_TS,
        updated_by: "catalogo",
      });
    }
  });

// v11: precarga el reporte demo de UEN Mariano Picón Salas (centro-10) si el
// registro local sigue sin ediciones de campo (updated_at ≤ demo).
db.version(11)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
    lineas: "id, tipo, updated_at",
    censos: "id, sector_id, ts, updated_at",
    distribuciones: "id, clase, dia, jornada, sector_id, updated_at",
    limpiezas: "id, punto_id, dia, ts, updated_at",
    centros: "id, nro, cuerpo, grupo, updated_at",
    outbox: "clave, entidad, updated_at",
  })
  .upgrade(async (tx) => {
    const catalogo = CENTROS_TRANSITORIOS.find((c) => c.id === ID_CENTRO_DEMO);
    if (!catalogo) return;

    const existente = await tx.table("centros").get(ID_CENTRO_DEMO);
    const demo = {
      ...catalogo,
      ...LEVANTAMIENTO_DEMO_CENTRO_10,
      updated_at: DEMO_CENTRO_10_TS,
      updated_by: "demo",
    };

    if (!existente) {
      await tx.table("centros").put(demo);
      return;
    }

    const ts = typeof existente.updated_at === "number" ? existente.updated_at : SEMILLA_CENTROS_TS;
    if (ts <= DEMO_CENTRO_10_TS) {
      await tx.table("centros").put({ ...existente, ...demo });
    }
  });

// v12: actualiza el demo del centro-10 con requerimientos (y campos nuevos del
// levantamiento) si el registro local sigue sin ediciones de campo.
db.version(12)
  .stores({
    sectores: "id, nombre, updated_at",
    puntos: "id, tipo, estado, updated_at",
    lineas: "id, tipo, updated_at",
    censos: "id, sector_id, ts, updated_at",
    distribuciones: "id, clase, dia, jornada, sector_id, updated_at",
    limpiezas: "id, punto_id, dia, ts, updated_at",
    centros: "id, nro, cuerpo, grupo, updated_at",
    outbox: "clave, entidad, updated_at",
  })
  .upgrade(async (tx) => {
    const catalogo = CENTROS_TRANSITORIOS.find((c) => c.id === ID_CENTRO_DEMO);
    if (!catalogo) return;

    const existente = await tx.table("centros").get(ID_CENTRO_DEMO);
    if (!existente) return;

    const ts = typeof existente.updated_at === "number" ? existente.updated_at : SEMILLA_CENTROS_TS;
    if (ts <= DEMO_CENTRO_10_TS) {
      await tx.table("centros").put({
        ...existente,
        ...catalogo,
        ...LEVANTAMIENTO_DEMO_CENTRO_10,
        updated_at: DEMO_CENTRO_10_TS,
        updated_by: "demo",
      });
    }
  });

export { db };

/**
 * Siembra el catálogo estático de centros si la tabla está vacía. La migración
 * v10 lo hace al pasar de una versión previa; esto cubre instalaciones nuevas
 * (que arrancan directo en v10 sin ejecutar el `upgrade`).
 */
export async function sembrarCentrosSiVacio(): Promise<void> {
  const total = await db.centros.count();
  if (total > 0) return;
  await db.centros.bulkPut(
    CENTROS_TRANSITORIOS.map((c) => ({
      ...c,
      updated_at: c.id === ID_CENTRO_DEMO ? DEMO_CENTRO_10_TS : SEMILLA_CENTROS_TS,
      updated_by: c.id === ID_CENTRO_DEMO ? "demo" : "catalogo",
    })),
  );
}

/** Clave de día (YYYY-MM-DD, hora local) a partir de un timestamp en ms. */
export function claveDia(ts: number): string {
  const d = new Date(ts);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
