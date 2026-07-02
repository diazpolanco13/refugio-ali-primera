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
  lineas: z.array(filaSchema).optional().default([]),
  censos: z.array(filaSchema).optional().default([]),
  distribuciones: z.array(filaSchema).optional().default([]),
  limpiezas: z.array(filaSchema).optional().default([]),
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
    const [sectores, puntos, lineas, censos, distribuciones, limpiezas] =
      await Promise.all([
        filasDesde(app.db, "sectores", since),
        filasDesde(app.db, "puntos", since),
        filasDesde(app.db, "lineas", since),
        filasDesde(app.db, "censos", since),
        filasDesde(app.db, "distribuciones", since),
        filasDesde(app.db, "limpiezas", since),
      ]);
    return {
      sectores,
      puntos,
      lineas,
      censos,
      distribuciones,
      limpiezas,
      serverTime: Date.now(),
    };
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
      const lineas = await aplicar(app.db, "lineas", parsed.data.lineas, usuario);
      const censos = await aplicar(app.db, "censos", parsed.data.censos, usuario);
      const distribuciones = await aplicar(
        app.db,
        "distribuciones",
        parsed.data.distribuciones,
        usuario,
      );
      const limpiezas = await aplicar(
        app.db,
        "limpiezas",
        parsed.data.limpiezas,
        usuario,
      );

      difundirCambio("sectores", sectores);
      difundirCambio("puntos", puntos);
      difundirCambio("lineas", lineas);
      difundirCambio("censos", censos);
      difundirCambio("distribuciones", distribuciones);
      difundirCambio("limpiezas", limpiezas);

      return {
        serverTime: Date.now(),
        aplicados: {
          sectores: sectores.length,
          puntos: puntos.length,
          lineas: lineas.length,
          censos: censos.length,
          distribuciones: distribuciones.length,
          limpiezas: limpiezas.length,
        },
      };
    },
  );

  // Vaciar mapa en el servidor (solo admin). Marca todo como borrado para que
  // ningún cliente lo recupere tras limpiar caché o reinstalar la PWA.
  app.post("/api/sync/purge", { preHandler: requireRol("admin") }, async (req) => {
    const usuario = (req.user as TokenPayload).username;
    // El histórico poblacional (censos) NO se purga: se conserva aunque se
    // vacíe el mapa.
    const tablas: Entidad[] = ["sectores", "puntos", "lineas"];
    const aplicadas: Record<Entidad, FilaSync[]> = {
      sectores: [],
      puntos: [],
      lineas: [],
      censos: [],
      distribuciones: [],
      limpiezas: [],
    };

    for (const tabla of tablas) {
      const rows = await app.db.query<{ id: string; data: unknown; updated_at: number }>(
        `SELECT id, data, updated_at FROM ${tabla}`,
      );
      if (!rows.length) continue;
      // Timestamp que gana last-write-wins (incluso datos de prueba con fecha futura).
      const ts = Math.max(Date.now(), ...rows.map((r) => r.updated_at)) + 1;
      const filas = rows.map((r) => ({
        id: r.id,
        updated_at: ts,
        deleted: true,
        data: normalizarJsonb(r.data),
      }));
      aplicadas[tabla] = await aplicar(app.db, tabla, filas, usuario);
    }

    difundirCambio("sectores", aplicadas.sectores);
    difundirCambio("puntos", aplicadas.puntos);
    difundirCambio("lineas", aplicadas.lineas);

    const serverTime = Date.now();
    return {
      ok: true,
      serverTime,
      borrados: {
        sectores: aplicadas.sectores.length,
        puntos: aplicadas.puntos.length,
        lineas: aplicadas.lineas.length,
      },
    };
  });
}
