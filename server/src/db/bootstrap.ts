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

-- Registro de distribución de comida e hidratación: cabeceras de jornada y
-- entregas por sector (append/upsert, last-write-wins).
CREATE TABLE IF NOT EXISTS distribuciones (
  id text PRIMARY KEY,
  updated_at bigint NOT NULL,
  updated_by text,
  deleted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS distribuciones_updated_at_idx ON distribuciones(updated_at);

-- Bitácora de salubridad y aseo: eventos de limpieza/recolección de puntos
-- (baños, duchas, basura) con quién y cuándo (append-only, last-write-wins).
CREATE TABLE IF NOT EXISTS limpiezas (
  id text PRIMARY KEY,
  updated_at bigint NOT NULL,
  updated_by text,
  deleted boolean NOT NULL DEFAULT false,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS limpiezas_updated_at_idx ON limpiezas(updated_at);

CREATE TABLE IF NOT EXISTS usuarios (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  nombre text,
  rol text NOT NULL DEFAULT 'campo',
  sector_asignado text,
  created_at bigint NOT NULL
);

-- Campos ampliados de la ficha del usuario de gestión (migración idempotente).
-- hash_id: identificador de sistema (se usa en la marca de agua anti-foto).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS jerarquia text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cedula text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS responsabilidad text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telegram text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS brazalete text;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS hash_id text;
-- Marca de agua de seguridad (anti-foto). Activada por defecto (el admin la
-- puede desactivar por usuario).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS marca_agua boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_hash_id_idx ON usuarios(hash_id);

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
  // Quitamos primero las líneas de comentario "--" para que un ";" dentro de un
  // comentario no parta mal las sentencias.
  const sinComentarios = SQL.split("\n")
    .filter((linea) => !linea.trim().startsWith("--"))
    .join("\n");
  const sentencias = sinComentarios
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of sentencias) {
    await db.query(s);
  }
}
