import type { Rol } from "@/data/authSupabase";
import { rolUsaCentrosAsignados } from "@/domain/permisos";

/** Resumen de cobertura de la red según asignaciones de usuarios. */
export type CoberturaCentros = {
  total: number;
  asignados: number;
  sinAsignar: number;
  idsAsignados: Set<string>;
  idsSinAsignar: string[];
};

type CentroId = { id: string };
type UsuarioCobertura = {
  rol: Rol;
  centros_asignados: string[] | null;
};

/**
 * Un centro está "asignado" si aparece en `centros_asignados` de algún usuario
 * cuyo rol usa centros asignados (analista SAE, supervisor, operador).
 *
 * @example
 * calcularCoberturaCentros([{ id: "a" }, { id: "b" }], [
 *   { rol: "supervisor", centros_asignados: ["a"] },
 * ])
 * // → { total: 2, asignados: 1, sinAsignar: 1, ... }
 */
export function calcularCoberturaCentros(
  centros: CentroId[],
  usuarios: UsuarioCobertura[],
): CoberturaCentros {
  const idsAsignados = new Set<string>();
  for (const u of usuarios) {
    if (!rolUsaCentrosAsignados(u.rol)) continue;
    for (const id of u.centros_asignados ?? []) {
      idsAsignados.add(id);
    }
  }

  const idsRed = new Set(centros.map((c) => c.id));
  // Solo contar asignaciones que existen en la red activa.
  const asignadosEnRed = new Set(
    [...idsAsignados].filter((id) => idsRed.has(id)),
  );
  const idsSinAsignar = centros
    .map((c) => c.id)
    .filter((id) => !asignadosEnRed.has(id));

  return {
    total: centros.length,
    asignados: asignadosEnRed.size,
    sinAsignar: idsSinAsignar.length,
    idsAsignados: asignadosEnRed,
    idsSinAsignar,
  };
}
