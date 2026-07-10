// Estado del directorio de autoridades en /terreno: se deriva de los datos
// del campamento (BD), no de un flag local suelto.

import {
  CATEGORIAS_AUTORIDADES_TERRENO,
  normalizarResponsableCoordinacion,
  responsableCoordinacionTieneDatos,
  type CategoriaResponsabilidadCoordinacion,
  type ResponsableCoordinacion,
} from "@/domain/coordinacionCentro";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

const SET_CATEGORIAS = new Set<string>(CATEGORIAS_AUTORIDADES_TERRENO);

/** ¿Hay al menos un responsable o un ámbito marcado «sin autoridades»? */
export function centroTieneAutoridadesTerreno(
  centro: Pick<CentroTransitorio, "responsables_coordinacion" | "ambitos_sin_autoridad">,
): boolean {
  const lista = Array.isArray(centro.responsables_coordinacion)
    ? (centro.responsables_coordinacion as ResponsableCoordinacion[])
    : [];
  const hayResponsable = lista.some((raw) => {
    const r = normalizarResponsableCoordinacion(raw);
    return SET_CATEGORIAS.has(r.categoria) && responsableCoordinacionTieneDatos(r);
  });
  if (hayResponsable) return true;

  const ambitos = centro.ambitos_sin_autoridad ?? [];
  return ambitos.some((a) => SET_CATEGORIAS.has(a as CategoriaResponsabilidadCoordinacion));
}
