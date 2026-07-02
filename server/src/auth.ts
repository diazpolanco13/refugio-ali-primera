import { createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Rol, TokenPayload } from "./types.ts";

export function hashPassword(plano: string): Promise<string> {
  return hash(plano);
}

/**
 * Genera el identificador de sistema (hash) de un usuario de forma
 * determinista a partir de su id. Estable, corto y legible; se usará como
 * marca de agua para trazar quién fotografía la pantalla.
 * Formato: XXXX-XXXX (8 hex en mayúsculas).
 */
export function generarHashId(id: string): string {
  const hex = createHash("sha256").update(id).digest("hex").slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function verifyPassword(hashGuardado: string, plano: string): Promise<boolean> {
  return verify(hashGuardado, plano);
}

/** preHandler: exige un JWT válido. Deja el payload en request.user. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "No autenticado" });
  }
}

/** preHandler factory: exige que el rol esté entre los permitidos. */
export function requireRol(...roles: Rol[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "No autenticado" });
    }
    const payload = req.user as TokenPayload;
    if (!roles.includes(payload.rol)) {
      return reply.code(403).send({ error: "Sin permiso" });
    }
  };
}
