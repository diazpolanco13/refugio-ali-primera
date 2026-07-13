// Métricas demográficas del censo nominal (conteos desde alojamientos activos).

import {
  META_NIVEL_AFECTACION,
  nivelAfectacionHogar,
  type NivelAfectacion,
} from "@/domain/nivelAfectacionHogar";
import {
  grupoEtarioRefugiado,
  type AlojamientoEnriquecido,
  type EstatusVivienda,
} from "@/domain/refugiados";

export interface MetricasDemograficasNominal {
  total: number;
  mujeres: number;
  hombres: number;
  embarazadas: number;
  discapacidad: number;
  adultosMayores: number;
  menores: number;
  /** Condiciones crónicas, lesiones o medicamentos urgentes. */
  conEnfermedad: number;
  lactancia: number;
  /** Hogares con al menos 1 desaparecido declarado. */
  hogaresConDesaparecidos: number;
  /** Hogares con al menos 1 fallecido confirmado. */
  hogaresConFallecidos: number;
  /** Hogares en nivel crítico (pérdidas o vivienda destruida/inhabitable). */
  hogaresCriticos: number;
}

export function tieneEnfermedadNominal(a: AlojamientoEnriquecido): boolean {
  const s = a.refugiado.salud;
  if (!s) return false;
  return Boolean(
    (s.condiciones_cronicas && s.condiciones_cronicas.trim()) ||
      (s.lesiones && s.lesiones.trim()) ||
      s.medicamentos_urgente,
  );
}

export function nivelHogarDeAlojamiento(
  a: AlojamientoEnriquecido,
  estatusPorFamilia?: Map<string, EstatusVivienda> | null,
): NivelAfectacion {
  const fam = a.familia;
  const estatus =
    (a.familia_id && estatusPorFamilia?.get(a.familia_id)) || "sin_verificar";
  return nivelAfectacionHogar(
    estatus,
    fam?.fallecidos_confirmados ?? 0,
    fam?.desaparecidos ?? 0,
  );
}

export function metaNivelHogar(
  a: AlojamientoEnriquecido,
  estatusPorFamilia?: Map<string, EstatusVivienda> | null,
) {
  return META_NIVEL_AFECTACION[nivelHogarDeAlojamiento(a, estatusPorFamilia)];
}

/** Agrega KPIs demográficos del listado nominal activo. */
export function metricasDemograficasNominal(
  alojamientos: AlojamientoEnriquecido[],
  estatusPorFamilia?: Map<string, EstatusVivienda> | null,
): MetricasDemograficasNominal {
  let mujeres = 0;
  let hombres = 0;
  let embarazadas = 0;
  let discapacidad = 0;
  let adultosMayores = 0;
  let menores = 0;
  let conEnfermedad = 0;
  let lactancia = 0;

  const famDesaparecidos = new Set<string>();
  const famFallecidos = new Set<string>();
  const famCriticos = new Set<string>();

  for (const a of alojamientos) {
    const r = a.refugiado;
    if (r.sexo === "F") mujeres++;
    else if (r.sexo === "M") hombres++;

    if (r.vulnerabilidades?.embarazada) embarazadas++;
    if (r.vulnerabilidades?.discapacidad) discapacidad++;
    if (r.salud?.lactancia) lactancia++;
    if (tieneEnfermedadNominal(a)) conEnfermedad++;

    const grupo = grupoEtarioRefugiado(r.fecha_nacimiento);
    if (grupo === "adulto_mayor") adultosMayores++;
    if (grupo === "menor5" || grupo === "ninez" || grupo === "adolescente") {
      menores++;
    }

    const famId = a.familia_id || `solo:${a.id}`;
    if ((a.familia?.desaparecidos ?? 0) > 0) famDesaparecidos.add(famId);
    if ((a.familia?.fallecidos_confirmados ?? 0) > 0) famFallecidos.add(famId);
    if (nivelHogarDeAlojamiento(a, estatusPorFamilia) === "critico") {
      famCriticos.add(famId);
    }
  }

  return {
    total: alojamientos.length,
    mujeres,
    hombres,
    embarazadas,
    discapacidad,
    adultosMayores,
    menores,
    conEnfermedad,
    lactancia,
    hogaresConDesaparecidos: famDesaparecidos.size,
    hogaresConFallecidos: famFallecidos.size,
    hogaresCriticos: famCriticos.size,
  };
}
