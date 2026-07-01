import { hash, verify } from "@node-rs/argon2";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Rol, TokenPayload } from "./types.ts";

export function hashPassword(plano: string): Promise<string> {
  return hash(plano);
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
