import type { Db } from "./client.ts";

// Crea las tablas si no existen (idempotente). Modelo de sincronización:
// cada entidad se guarda como blob JSON + metadatos, para no migrar el
// esquema cuando cambian los campos del cliente.
const SQL = `
CREATE TABLE IF NOT EXISTS sectores (
  id text PRIMARY KEY,
  updated_at bigint NOT NULL,
  updated_by text,
  deleted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS sectores_updated_at_idx ON sectores(updated_at);

CREATE TABLE IF NOT EXISTS puntos (
  id text PRIMARY KEY,
  updated_at bigint NOT NULL,
  updated_by text,
  deleted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS puntos_updated_at_idx ON puntos(updated_at);

CREATE TABLE IF NOT EXISTS lineas (
  id text PRIMARY KEY,
  updated_at bigint NOT NULL,
  updated_by text,
  deleted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS lineas_updated_at_idx ON lineas(updated_at);

-- Registro poblacional histórico: fotos del censo por sector (append-only).
CREATE TABLE IF NOT EXISTS censos (
  id text PRIMARY KEY,
  updated_at bigint NOT NULL,
  updated_by text,
  deleted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS censos_updated_at_idx ON censos(updated_at);

CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  nombre text,
  rol text NOT NULL DEFAULT 'campo',
  sector_asignado text,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS historial (
  id text PRIMARY KEY,
  ts bigint NOT NULL,
  usuario text,
  accion text NOT NULL,
  entidad text,
  entidad_id text,
  detalle jsonb
);
CREATE INDEX IF NOT EXISTS historial_ts_idx ON historial(ts);
`;

export async function bootstrap(db: Db): Promise<void> {
  // Ejecutar sentencia por sentencia (PGlite.query solo admite una a la vez).
  const sentencias = SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of sentencias) {
    await db.query(s);
  }
}
