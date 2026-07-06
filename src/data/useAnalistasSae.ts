import { useSupabaseQuery } from "./useSupabaseQuery";

/** Perfil resumido de un analista SAE (ámbito de monitoreo vía centros_asignados). */
export interface AnalistaSae {
  id: string;
  user_id: string;
  username: string | null;
  nombre: string | null;
  centros_asignados: string[];
}

interface PerfilAnalistaRow extends Record<string, unknown> {
  user_id: string;
  username: string | null;
  nombre: string | null;
  centros_asignados: string[] | null;
  rol: string;
}

/** Lista de analistas SAE con Realtime (para filtros de vista en campamentos). */
export function useAnalistasSae(): AnalistaSae[] {
  return useSupabaseQuery<AnalistaSae, PerfilAnalistaRow>("perfiles", {
    select: "user_id, username, nombre, centros_asignados, rol",
    filter: (q) => q.eq("rol", "analista_sae"),
    order: { column: "nombre", ascending: true },
    transform: (r) => ({
      id: r.user_id,
      user_id: r.user_id,
      username: r.username,
      nombre: r.nombre,
      centros_asignados: r.centros_asignados ?? [],
    }),
  });
}

export function etiquetaAnalistaSae(
  analista: Pick<AnalistaSae, "nombre" | "username">,
): string {
  const nombre = analista.nombre?.trim();
  if (nombre) return nombre;
  if (analista.username) return `@${analista.username}`;
  return "Sin nombre";
}

/** Campamentos de la red que tiene asignados este analista. */
export function contarCentrosAsignadosAnalista(
  analista: Pick<AnalistaSae, "centros_asignados">,
  idsCentrosActivos: ReadonlySet<string>,
): number {
  return analista.centros_asignados.filter((id) => idsCentrosActivos.has(id)).length;
}
