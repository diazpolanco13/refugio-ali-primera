import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generarHashId, hashPassword, requireAuth, requireRol, verifyPassword } from "../auth.ts";
import { ROLES, type Rol, type TokenPayload, type Usuario } from "../types.ts";

// Columnas públicas de la ficha (sin password_hash). Reutilizado en los SELECT.
const COLS_USUARIO =
  "id, username, nombre, rol, sector_asignado, created_at, jerarquia, cedula, responsabilidad, whatsapp, telegram, brazalete, hash_id, marca_agua";

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
  jerarquia: z.string().optional(),
  cedula: z.string().optional(),
  responsabilidad: z.string().optional(),
  whatsapp: z.string().optional(),
  telegram: z.string().optional(),
  brazalete: z.string().optional(),
  marca_agua: z.boolean().optional(),
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().nullable().optional(),
  rol: z.enum(ROLES as [Rol, ...Rol[]]).optional(),
  password: z.string().min(6).optional(),
  sector_asignado: z.string().nullable().optional(),
  jerarquia: z.string().nullable().optional(),
  cedula: z.string().nullable().optional(),
  responsabilidad: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  brazalete: z.string().nullable().optional(),
  marca_agua: z.boolean().optional(),
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

    // Backfill: usuarios creados antes de existir el hash de sistema.
    let hashId = u.hash_id;
    if (!hashId) {
      hashId = generarHashId(u.id);
      await app.db.query("UPDATE usuarios SET hash_id = $1 WHERE id = $2", [hashId, u.id]);
    }

    const payload: TokenPayload = {
      sub: u.id,
      username: u.username,
      nombre: u.nombre,
      rol: u.rol,
      sector_asignado: u.sector_asignado ?? null,
      hash_id: hashId,
      marca_agua: u.marca_agua ?? true,
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
      `SELECT ${COLS_USUARIO} FROM usuarios ORDER BY created_at`,
    );
  });

  app.post("/api/usuarios", { preHandler: requireRol("admin") }, async (req, reply) => {
    const parsed = crearUsuarioSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const {
      username,
      password,
      nombre,
      rol,
      sector_asignado,
      jerarquia,
      cedula,
      responsabilidad,
      whatsapp,
      telegram,
      brazalete,
      marca_agua,
    } = parsed.data;

    const existe = await app.db.query(
      "SELECT id FROM usuarios WHERE username = $1",
      [username],
    );
    if (existe.length) return reply.code(409).send({ error: "El usuario ya existe" });

    const id = crypto.randomUUID();
    const hash_id = generarHashId(id);
    await app.db.query(
      `INSERT INTO usuarios
         (id, username, password_hash, nombre, rol, sector_asignado, created_at,
          jerarquia, cedula, responsabilidad, whatsapp, telegram, brazalete, hash_id, marca_agua)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        username,
        await hashPassword(password),
        nombre ?? null,
        rol,
        sector_asignado ?? null,
        Date.now(),
        jerarquia ?? null,
        cedula ?? null,
        responsabilidad ?? null,
        whatsapp ?? null,
        telegram ?? null,
        brazalete ?? null,
        hash_id,
        marca_agua ?? true,
      ],
    );
    const creado = await app.db.query<Usuario>(
      `SELECT ${COLS_USUARIO} FROM usuarios WHERE id = $1`,
      [id],
    );
    return reply.code(201).send(creado[0]);
  });

  app.patch("/api/usuarios/:id", { preHandler: requireRol("admin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = actualizarUsuarioSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });

    const rows = await app.db.query<UsuarioRow>("SELECT * FROM usuarios WHERE id = $1", [id]);
    const actual = rows[0];
    if (!actual) return reply.code(404).send({ error: "Usuario no encontrado" });

    const { rol, password } = parsed.data;
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

    // Campos de texto simples (mismo nombre en el body y la columna).
    const camposTexto = [
      "nombre",
      "sector_asignado",
      "jerarquia",
      "cedula",
      "responsabilidad",
      "whatsapp",
      "telegram",
      "brazalete",
    ] as const;
    for (const campo of camposTexto) {
      const valor = parsed.data[campo];
      if (valor !== undefined) {
        sets.push(`${campo} = $${i++}`);
        vals.push(valor);
      }
    }
    if (rol !== undefined) {
      sets.push(`rol = $${i++}`);
      vals.push(rol);
    }
    if (parsed.data.marca_agua !== undefined) {
      sets.push(`marca_agua = $${i++}`);
      vals.push(parsed.data.marca_agua);
    }
    if (password) {
      sets.push(`password_hash = $${i++}`);
      vals.push(await hashPassword(password));
    }

    if (!sets.length) return reply.code(400).send({ error: "Nada que actualizar" });

    vals.push(id);
    await app.db.query(`UPDATE usuarios SET ${sets.join(", ")} WHERE id = $${i}`, vals);

    const actualizados = await app.db.query<Usuario>(
      `SELECT ${COLS_USUARIO} FROM usuarios WHERE id = $1`,
      [id],
    );
    return actualizados[0];
  });
}
