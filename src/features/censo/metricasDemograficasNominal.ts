// Métricas demográficas del registro nominal (conteos desde alojamientos activos).

import { grupoEtarioRefugiado, type AlojamientoEnriquecido } from "@/domain/refugiados";

export interface MetricasDemograficasNominal {
  total: number;
  mujeres: number;
  hombres: number;
  adultosMayores: number;
  menores: number;
}

/** Agrega KPIs demográficos del listado nominal activo. */
export function metricasDemograficasNominal(
  alojamientos: AlojamientoEnriquecido[],
): MetricasDemograficasNominal {
  let mujeres = 0;
  let hombres = 0;
  let adultosMayores = 0;
  let menores = 0;

  for (const a of alojamientos) {
    const r = a.refugiado;
    if (r.sexo === "F") mujeres++;
    else if (r.sexo === "M") hombres++;

    const grupo = grupoEtarioRefugiado(r.fecha_nacimiento);
    if (grupo === "adulto_mayor") adultosMayores++;
    if (grupo === "menor5" || grupo === "ninez" || grupo === "adolescente") {
      menores++;
    }
  }

  return {
    total: alojamientos.length,
    mujeres,
    hombres,
    adultosMayores,
    menores,
  };
}
