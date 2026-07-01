import { hashPassword } from "./auth.ts";
import { config } from "./config.ts";
import type { Db } from "./db/client.ts";

// Crea el usuario admin inicial si aún no existe ningún usuario.
export async function seedAdmin(db: Db): Promise<void> {
  const existentes = await db.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM usuarios");
  if ((existentes[0]?.n ?? 0) > 0) return;

  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO usuarios (id, username, password_hash, nombre, rol, sector_asignado, created_at)
     VALUES ($1,$2,$3,$4,'admin',NULL,$5)`,
    [id, config.adminUser, await hashPassword(config.adminPassword), "Administrador", Date.now()],
  );
  console.log(
    `[seed] Usuario admin creado: "${config.adminUser}". ` +
      (config.adminPassword === "admin1234"
        ? "⚠️  Contraseña por defecto: admin1234 — cámbiala con ADMIN_PASSWORD."
        : ""),
  );
}
