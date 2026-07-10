import type { Rol } from "@/data/authSupabase";
import { ROLES } from "@/domain/permisos";

/** Shape mínimo para filtrar/agrupar en Gestión de usuarios. */
export type UsuarioFiltro = {
  user_id: string;
  username: string | null;
  nombre: string | null;
  rol: Rol;
  cedula: string | null;
  hash_id: string | null;
  centros_asignados: string[] | null;
};

/**
 * Filtra por rol y búsqueda (nombre, username, cédula, hash_id, etiquetas de centro).
 *
 * @example
 * filtrarUsuariosGestion({
 *   usuarios,
 *   mapaCentrosEtiqueta: new Map([["c1", "N.° 1 · UEN …"]]),
 *   filtroRol: "analista_sae",
 *   busqueda: "ale",
 * })
 */
export function filtrarUsuariosGestion<T extends UsuarioFiltro>({
  usuarios,
  mapaCentrosEtiqueta,
  filtroRol,
  busqueda,
}: {
  usuarios: T[];
  mapaCentrosEtiqueta: Map<string, string>;
  filtroRol: Rol | "todos";
  busqueda: string;
}): T[] {
  const q = busqueda.trim().toLowerCase();
  return usuarios.filter((u) => {
    if (filtroRol !== "todos" && u.rol !== filtroRol) return false;
    if (!q) return true;

    const campos = [
      u.nombre,
      u.username,
      u.cedula,
      u.hash_id,
      ...(u.centros_asignados ?? []).map(
        (id) => mapaCentrosEtiqueta.get(id) ?? id,
      ),
    ];
    return campos.some((c) => (c ?? "").toLowerCase().includes(q));
  });
}

/** Agrupa usuarios por rol respetando el orden del catálogo `ROLES`. */
export function agruparUsuariosPorRol<T extends UsuarioFiltro>(
  usuarios: T[],
): { rol: Rol; usuarios: T[] }[] {
  return ROLES.map((rol) => ({
    rol,
    usuarios: usuarios.filter((u) => u.rol === rol),
  })).filter((g) => g.usuarios.length > 0);
}
