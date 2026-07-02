import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, requireAuth, requireRol, verifyPassword } from "../auth.ts";
import { ROLES, type Rol, type TokenPayload, type Usuario } from "../types.ts";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const crearUsuarioSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  nombre: z.string().optional(),
  rol: z.enum(ROLES as [Rol, ...Rol[]]).default("campo"),
  sector_asignado: z.string().optional(),
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().nullable().optional(),
  rol: z.enum(ROLES as [Rol, ...Rol[]]).optional(),
  password: z.string().min(6).optional(),
  sector_asignado: z.string().nullable().optional(),
});

async function contarAdmins(app: FastifyInstance): Promise<number> {
  const rows = await app.db.query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM usuarios WHERE rol = 'admin'",
  );
  return Number(rows[0]?.n ?? 0);
}

interface UsuarioRow extends Usuario {
  password_hash: string;
}

export async function rutasAuth(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const { username, password } = parsed.data;

    const rows = await app.db.query<UsuarioRow>(
      "SELECT * FROM usuarios WHERE username = $1",
      [username],
    );
    const u = rows[0];
    if (!u || !(await verifyPassword(u.password_hash, password))) {
      return reply.code(401).send({ error: "Usuario o contraseña incorrectos" });
    }
    const payload: TokenPayload = {
      sub: u.id,
      username: u.username,
      nombre: u.nombre,
      rol: u.rol,
      sector_asignado: u.sector_asignado ?? null,
    };
    const token = app.jwt.sign(payload, { expiresIn: "30d" });
    return { token, user: payload };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => {
    return req.user as TokenPayload;
  });

  // --- Gestión de usuarios (solo admin) ---
  app.get("/api/usuarios", { preHandler: requireRol("admin") }, async () => {
    return app.db.query<Usuario>(
      "SELECT id, username, nombre, rol, sector_asignado, created_at FROM usuarios ORDER BY created_at",
    );
  });

  app.post("/api/usuarios", { preHandler: requireRol("admin") }, async (req, reply) => {
    const parsed = crearUsuarioSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const { username, password, nombre, rol, sector_asignado } = parsed.data;

    const existe = await app.db.query(
      "SELECT id FROM usuarios WHERE username = $1",
      [username],
    );
    if (existe.length) return reply.code(409).send({ error: "El usuario ya existe" });

    const id = crypto.randomUUID();
    await app.db.query(
      `INSERT INTO usuarios (id, username, password_hash, nombre, rol, sector_asignado, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        username,
        await hashPassword(password),
        nombre ?? null,
        rol,
        sector_asignado ?? null,
        Date.now(),
      ],
    );
    return reply.code(201).send({ id, username, nombre: nombre ?? null, rol, sector_asignado: sector_asignado ?? null });
  });

  app.patch("/api/usuarios/:id", { preHandler: requireRol("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = actualizarUsuarioSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });

    const rows = await app.db.query<UsuarioRow>("SELECT * FROM usuarios WHERE id = $1", [id]);
    const actual = rows[0];
    if (!actual) return reply.code(404).send({ error: "Usuario no encontrado" });

    const { nombre, rol, password, sector_asignado } = parsed.data;
    const nuevoRol = rol ?? actual.rol;

    // No quitar el rol admin al último administrador del sistema.
    if (actual.rol === "admin" && nuevoRol !== "admin") {
      const admins = await contarAdmins(app);
      if (admins <= 1) {
        return reply.code(400).send({ error: "Debe haber al menos un administrador" });
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (nombre !== undefined) {
      sets.push(`nombre = $${i++}`);
      vals.push(nombre);
    }
    if (rol !== undefined) {
      sets.push(`rol = $${i++}`);
      vals.push(rol);
    }
    if (sector_asignado !== undefined) {
      sets.push(`sector_asignado = $${i++}`);
      vals.push(sector_asignado);
    }
    if (password) {
      sets.push(`password_hash = $${i++}`);
      vals.push(await hashPassword(password));
    }

    if (!sets.length) return reply.code(400).send({ error: "Nada que actualizar" });

    vals.push(id);
    await app.db.query(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = $${i}`, vals);

    const actualizados = await app.db.query<Usuario>(
      "SELECT id, username, nombre, rol, sector_asignado, created_at FROM usuarios WHERE id = $1",
      [id],
    );
    return actualizados[0];
  });
}
