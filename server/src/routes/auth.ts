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
}
