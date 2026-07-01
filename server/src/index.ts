import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { config, usandoPostgresReal } from "./config.ts";
import { crearDb, type Db } from "./db/client.ts";
import { bootstrap } from "./db/bootstrap.ts";
import { seedAdmin } from "./seedAdmin.ts";
import { rutasAuth } from "./routes/auth.ts";
import { rutasSync } from "./routes/sync.ts";
import { rutasHistorial } from "./routes/historial.ts";
import { registrarCliente } from "./ws.ts";
import type { TokenPayload } from "./types.ts";

// Augmentaciones de tipos de Fastify.
declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

async function main() {
  const db = await crearDb();
  await bootstrap(db);
  await seedAdmin(db);

  const app = Fastify({ logger: true });
  app.decorate("db", db);

  await app.register(cors, {
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    credentials: true,
  });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(websocket);

  app.get("/api/health", async () => ({
    ok: true,
    db: usandoPostgresReal ? "postgres" : "pglite",
    serverTime: Date.now(),
  }));

  await app.register(rutasAuth);
  await app.register(rutasSync);
  await app.register(rutasHistorial);

  // WebSocket de tiempo real. Auth por ?token= (el navegador no envía headers en WS).
  await app.register(async (scope) => {
    scope.get("/ws", { websocket: true }, (socket, req) => {
      const token = (req.query as { token?: string }).token;
      try {
        app.jwt.verify(token ?? "");
      } catch {
        socket.close(1008, "No autenticado");
        return;
      }
      registrarCliente(socket);
      socket.send(JSON.stringify({ type: "hola", serverTime: Date.now() }));
    });
  });

  await app.listen({ port: config.port, host: config.host });
  console.log(`[server] Escuchando en :${config.port} (${usandoPostgresReal ? "Postgres" : "PGlite"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
