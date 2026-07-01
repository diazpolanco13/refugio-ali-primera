// Configuración por variables de entorno.
export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? "0.0.0.0",
  // Si hay DATABASE_URL usamos Postgres real; si no, PGlite local (sin instalar nada).
  databaseUrl: process.env.DATABASE_URL,
  // Carpeta de datos de PGlite (solo modo local). Vacío = en memoria.
  pgliteDir: process.env.PGLITE_DIR ?? "./.data/pglite",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-cambiar-en-produccion",
  // Contraseña del admin inicial (solo se usa al crear el primer usuario).
  adminUser: process.env.ADMIN_USER ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin1234",
  // Orígenes permitidos para CORS (coma-separados). "*" en dev.
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};

export const usandoPostgresReal = Boolean(config.databaseUrl);
