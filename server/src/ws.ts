import type { WebSocket } from "@fastify/websocket";
import type { Entidad, FilaSync } from "./types.ts";

// Hub simple de WebSocket: mantiene las conexiones y difunde los cambios.
const clientes = new Set<WebSocket>();

export function registrarCliente(socket: WebSocket): void {
  clientes.add(socket);
  socket.on("close", () => clientes.delete(socket));
  socket.on("error", () => clientes.delete(socket));
}

export interface MensajeCambio {
  type: "cambio";
  entidad: Entidad;
  filas: FilaSync[];
  serverTime: number;
}

/** Difunde filas cambiadas a todos los clientes conectados. */
export function difundirCambio(entidad: Entidad, filas: FilaSync[]): void {
  if (filas.length === 0) return;
  const msg: MensajeCambio = {
    type: "cambio",
    entidad,
    filas,
    serverTime: Date.now(),
  };
  const texto = JSON.stringify(msg);
  for (const c of clientes) {
    try {
      c.send(texto);
    } catch {
      clientes.delete(c);
    }
  }
}
