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
  cuerpo_asignado?: string | null;
};

/**
 * Filtra por rol, cuerpo policial y búsqueda (nombre, username, cédula,
 * hash_id, etiquetas de centro). Un usuario está "vinculado a un cuerpo" si
 * tiene ese cuerpo asignado (alcance por cuerpo) o si alguno de sus
 * campamentos asignados pertenece al cuerpo (`mapaCentroCuerpo`: id → clave).
 *
 * @example
 * filtrarUsuariosGestion({
 *   usuarios,
 *   mapaCentrosEtiqueta: new Map([["c1", "N.° 1 · UEN …"]]),
 *   filtroRol: "analista_sae",
 *   filtroCuerpo: "pnb",
 *   mapaCentroCuerpo: new Map([["c1", "pnb"]]),
 *   busqueda: "ale",
 * })
 */
export function filtrarUsuariosGestion<T extends UsuarioFiltro>({
  usuarios,
  mapaCentrosEtiqueta,
  filtroRol,
  busqueda,
  filtroCuerpo = "todos",
  mapaCentroCuerpo,
}: {
  usuarios: T[];
  mapaCentrosEtiqueta: Map<string, string>;
  filtroRol: Rol | "todos";
  busqueda: string;
  filtroCuerpo?: string | "todos";
  mapaCentroCuerpo?: Map<string, string>;
}): T[] {
  const q = busqueda.trim().toLowerCase();
  return usuarios.filter((u) => {
    if (filtroRol !== "todos" && u.rol !== filtroRol) return false;
    if (filtroCuerpo !== "todos") {
      const porCuerpoAsignado = u.cuerpo_asignado === filtroCuerpo;
      const porCentros = (u.centros_asignados ?? []).some(
        (id) => mapaCentroCuerpo?.get(id) === filtroCuerpo,
      );
      if (!porCuerpoAsignado && !porCentros) return false;
    }
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
