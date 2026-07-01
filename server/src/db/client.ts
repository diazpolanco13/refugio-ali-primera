import { config, usandoPostgresReal } from "../config.ts";

// Adaptador mínimo: expone query(text, params) → filas. Funciona tanto con
// PostgreSQL real (postgres.js) como con PGlite (Postgres en proceso, WASM).
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

async function crearPostgres(): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(config.databaseUrl!, { max: 10 });
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as never[])) as unknown as T[];
    },
    async close() {
      await sql.end();
    },
  };
}

async function crearPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = config.pgliteDir?.trim();
  if (dir) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
  }
  const pg = new PGlite(dir || undefined);
  await pg.waitReady;
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const res = await pg.query<T>(text, params);
      return res.rows;
    },
    async close() {
      await pg.close();
    },
  };
}

export async function crearDb(): Promise<Db> {
  return usandoPostgresReal ? crearPostgres() : crearPglite();
}
