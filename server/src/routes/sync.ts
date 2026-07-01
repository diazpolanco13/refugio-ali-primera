import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRol } from "../auth.ts";
import { difundirCambio } from "../ws.ts";
import type { Db } from "../db/client.ts";
import type { Entidad, FilaSync, TokenPayload } from "../types.ts";
import { normalizarJsonb } from "../jsonb.ts";

const filaSchema = z.object({
  id: z.string().min(1),
  updated_at: z.number(),
  deleted: z.boolean().optional().default(false),
  data: z.unknown(),
});

const pushSchema = z.object({
  sectores: z.array(filaSchema).optional().default([]),
  puntos: z.array(filaSchema).optional().default([]),
});

async function filasDesde(db: Db, tabla: Entidad, since: number): Promise<FilaSync[]> {
  const filas = await db.query<FilaSync>(
    `SELECT id, updated_at, updated_by, deleted, data FROM ${tabla}
     WHERE updated_at > $1 ORDER BY updated_at`,
    [since],
  );
  // Filas antiguas pueden tener `data` como string JSON (doble codificación).
  return filas.map((f) => ({ ...f, data: normalizarJsonb(f.data) }));
}

/** Upsert con last-write-wins. Devuelve solo las filas realmente aplicadas. */
async function aplicar(
  db: Db,
  tabla: Entidad,
  filas: z.infer<typeof filaSchema>[],
  usuario: string,
): Promise<FilaSync[]> {
  const aplicadas: FilaSync[] = [];
  for (const f of filas) {
    const res = await db.query<FilaSync>(
      `INSERT INTO ${tabla} (id, updated_at, updated_by, deleted, data)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by,
         deleted = EXCLUDED.deleted,
         data = EXCLUDED.data
       WHERE EXCLUDED.updated_at >= ${tabla}.updated_at
       RETURNING id, updated_at, updated_by, deleted, data`,
      // Pasar el objeto directo: postgres.js serializa a jsonb. JSON.stringify
      // previo guardaba un string jsonb (sin geom al leer en el cliente).
      [f.id, f.updated_at, usuario, f.deleted ?? false, f.data ?? null],
    );
    if (res[0]) aplicadas.push({ ...res[0], data: normalizarJsonb(res[0].data) });
  }
  return aplicadas;
}

export async function rutasSync(app: FastifyInstance) {
  // Pull: cambios desde un timestamp.
  app.get("/api/sync", { preHandler: requireAuth }, async (req) => {
    const since = Number((req.query as { since?: string }).since ?? 0) || 0;
    const [sectores, puntos] = await Promise.all([
      filasDesde(app.db, "sectores", since),
      filasDesde(app.db, "puntos", since),
    ]);
    return { sectores, puntos, serverTime: Date.now() };
  });

  // Push: subir cambios locales (visor no puede escribir).
  app.post(
    "/api/sync",
    { preHandler: requireRol("admin", "coordinador", "campo") },
    async (req, reply) => {
      const parsed = pushSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
      const usuario = (req.user as TokenPayload).username;

      const sectores = await aplicar(app.db, "sectores", parsed.data.sectores, usuario);
      const puntos = await aplicar(app.db, "puntos", parsed.data.puntos, usuario);

      difundirCambio("sectores", sectores);
      difundirCambio("puntos", puntos);

      return { serverTime: Date.now(), aplicados: { sectores: sectores.length, puntos: puntos.length } };
    },
  );
}
