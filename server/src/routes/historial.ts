import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireRol } from "../auth.ts";
import type { TokenPayload } from "../types.ts";

const entradaSchema = z.object({
  accion: z.string().min(1),
  entidad: z.string().optional(),
  entidad_id: z.string().optional(),
  detalle: z.unknown().optional(),
});

export async function rutasHistorial(app: FastifyInstance) {
  // Registrar una entrada (cualquier usuario autenticado que pueda escribir).
  app.post(
    "/api/historial",
    { preHandler: requireRol("admin", "coordinador", "campo") },
    async (req, reply) => {
      const parsed = entradaSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
      const usuario = (req.user as TokenPayload).username;
      const id = crypto.randomUUID();
      await app.db.query(
        `INSERT INTO historial (id, ts, usuario, accion, entidad, entidad_id, detalle)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          id,
          Date.now(),
          usuario,
          parsed.data.accion,
          parsed.data.entidad ?? null,
          parsed.data.entidad_id ?? null,
          JSON.stringify(parsed.data.detalle ?? null),
        ],
      );
      return reply.code(201).send({ id });
    },
  );

  // Consultar la bitácora (más recientes primero).
  app.get("/api/historial", { preHandler: requireAuth }, async (req) => {
    const limite = Math.min(Number((req.query as { limit?: string }).limit ?? 200) || 200, 1000);
    return app.db.query(
      "SELECT id, ts, usuario, accion, entidad, entidad_id, detalle FROM historial ORDER BY ts DESC LIMIT $1",
      [limite],
    );
  });
}
