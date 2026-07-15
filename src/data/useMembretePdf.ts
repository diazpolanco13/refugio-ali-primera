// Membrete institucional del PDF, listo para renderizar: resuelve el cuerpo
// del usuario (ámbito del analista), toma su branding del catálogo vivo y
// convierte los logos a data URLs PNG (react-pdf no acepta WebP).

import { useEffect, useState } from "react";
import { resolverMembretePdf } from "@/domain/membretePdf";
import { prepararMembrete, type MembreteListo } from "@/lib/imagenPdf";
import { useSesion } from "./authSupabase";
import { useCatalogoCuerpos } from "./useCuerposPoliciales";

export type { MembreteListo };

/** Membrete del usuario actual (`null` mientras se preparan los logos). */
export function useMembretePdf(): MembreteListo | null {
  const sesion = useSesion();
  const catalogo = useCatalogoCuerpos();
  const [membrete, setMembrete] = useState<MembreteListo | null>(null);

  useEffect(() => {
    let cancelado = false;
    setMembrete(null);
    void prepararMembrete(resolverMembretePdf(sesion?.user ?? null)).then((m) => {
      if (!cancelado) setMembrete(m);
    });
    return () => {
      cancelado = true;
    };
  }, [sesion, catalogo]);

  return membrete;
}

/** Versión imperativa (flujos que generan el PDF con `pdf(...)`). */
export async function obtenerMembretePdf(
  usuario: { rol?: string; cuerpo_asignado?: string | null } | null | undefined,
): Promise<MembreteListo> {
  return prepararMembrete(resolverMembretePdf(usuario));
}
