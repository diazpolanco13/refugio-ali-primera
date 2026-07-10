// Criterio de «capacidad registrada» para el botón verde de /terreno.

import { analisisCentro } from "@/domain/capacidadCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

/** Misma regla que la ficha: aforo oficial, algún recurso Esfera o agua medida. */
export function centroTieneCapacidadTerreno(centro: CentroTransitorio): boolean {
  const a = analisisCentro(centro);
  return (
    a.capacidadInstalada != null ||
    a.recursos.some((r) => r.medido) ||
    a.agua.medido
  );
}
