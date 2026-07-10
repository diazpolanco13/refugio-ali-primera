// Análisis de capacidad vs. ocupación de un Centro Transitorio (lógica pura,
// análoga a `brechas.ts`). Responde tres preguntas distintas:
//   1. ¿Cuánta gente MÁS cabe según el censo oficial? → "cupo oficial":
//      capacidad_instalada − damnificados (puede ser negativo = sobrecupo).
//   2. ¿Cuánta gente MÁS puede recibir con seguridad Esfera? → "cupo real":
//      el mínimo entre camas, baños y duchas operativos. Diagnóstico de
//      infraestructura; ya no es el KPI primario de cupo.
//   3. ¿El agua está garantizada? → autonomía en días (no fija headcount).

import {
  normalizarCentro,
  personasLogistica,
  poblacionCentro,
  totalPersonalOperativo,
  type CentroTransitorio,
} from "./centrosTransitorios";
import { AGUA_LITROS_PERSONA_DIA, ESTANDARES } from "./estandares";

/** Ratios Esfera: personas cubiertas por una unidad operativa. */
const PERSONAS_POR_POCETA = ESTANDARES.sanitarios?.personasPorUnidad ?? 20;
const PERSONAS_POR_DUCHA = ESTANDARES.duchas?.personasPorUnidad ?? 50;
/** Lavaderos / lavado de ropa: 1 por cada N personas (Esfera 2018). */
const PERSONAS_POR_LAVADERO = 100;
/** Contenedores de basura: 1 por cada N familias (Esfera, base familias). */
const FAMILIAS_POR_CONTENEDOR = ESTANDARES.residuos?.personasPorUnidad ?? 10;

export type ClaveRecurso = "camas" | "pocetas" | "duchas" | "lavaderos" | "contenedores";

export interface RecursoAnalisis {
  clave: ClaveRecurso;
  label: string;
  /** Unidades instaladas / operativas. */
  instaladas: number;
  operativas: number;
  /** Unidades operativas que DEBERÍAN existir para la población/familias actuales. */
  requeridas: number;
  /** Unidad para mostrar ("camas", "baños", "duchas", "contenedores"). */
  unidad: string;
  /** Explicación del estándar usado para `requeridas` (para el info/tooltip). */
  descripcionEstandar: string;
  /** Personas que soporta el recurso operativo según su ratio. */
  capacidadPersonas: number;
  /** ¿Hay dato suficiente para evaluar este recurso? */
  medido: boolean;
  /** ¿Entra en el cálculo de cupo real / recurso que fija el límite? */
  cuentaParaCupo: boolean;
  /** No hay población → la necesidad es 0 (no aplica cobertura). */
  sinNecesidad: boolean;
  /** % de cobertura de la necesidad (operativas / requeridas). */
  cobertura: number;
  /** Personas adicionales que aún soporta (capacidadPersonas - ocupados). */
  margen: number;
  /** % de uso del recurso (ocupados / capacidadPersonas). */
  porcentaje: number;
}

/** % de cobertura operativas vs. necesarias. Sin necesidad → 100 (cubierto). */
function cobertura(operativas: number, requeridas: number): number {
  if (requeridas <= 0) return 100;
  return Math.round((operativas / requeridas) * 100);
}

// ---------------------------------------------------------------------------
// Agua: no es un recurso "contable" como camas, es almacenamiento con autonomía.
// ---------------------------------------------------------------------------

export type EstadoAgua = "ok" | "atencion" | "critico" | "sin_datos";

export interface AnalisisAgua {
  /** Hay tanque con capacidad registrada. */
  medido: boolean;
  tanque: boolean;
  /** El suministro está operativo (llega/funciona). */
  operativa: boolean;
  /** Capacidad del tanque (litros). */
  litros: number;
  /** Estándar de consumo usado (L por persona/día). */
  litrosPersonaDia: number;
  /** Consumo estimado del centro por día (personas × estándar). */
  consumoDiaL: number;
  /** Días que dura el tanque sin reposición. null si no hay consumo. */
  autonomiaDias: number | null;
  estado: EstadoAgua;
  /** Mensaje accionable para el jefe del centro. */
  recomendacion: string;
  /** Explicación del estándar (para el info/tooltip). */
  descripcionEstandar: string;
}

function fmtDias(d: number): string {
  if (d < 1) return "menos de 1 día";
  const r = Math.floor(d);
  return `${r} día${r === 1 ? "" : "s"}`;
}

function analizarAgua(
  tanque: boolean,
  operativa: boolean,
  litros: number,
  ocupados: number,
): AnalisisAgua {
  const litrosPersonaDia = AGUA_LITROS_PERSONA_DIA;
  const consumoDiaL = ocupados * litrosPersonaDia;
  const medido = tanque && litros > 0;
  const descripcionEstandar =
    `Esfera 2018: ${litrosPersonaDia} L por persona/día para uso doméstico (aseo, ` +
    `pocetas, cocina, bebida y lavado de ropa). Es el mínimo; el consumo real suele ` +
    `ser mayor. El tanque solo almacena: la clave es reponerlo antes de que se agote.`;

  const base = {
    medido,
    tanque,
    operativa,
    litros,
    litrosPersonaDia,
    consumoDiaL,
    descripcionEstandar,
  };

  if (!medido) {
    return {
      ...base,
      autonomiaDias: null,
      estado: "sin_datos",
      recomendacion: "Registra si hay tanque y su capacidad en litros.",
    };
  }

  const autonomiaDias = consumoDiaL > 0 ? litros / consumoDiaL : null;

  if (!operativa) {
    return {
      ...base,
      autonomiaDias,
      estado: "critico",
      recomendacion:
        "El tanque no tiene suministro operativo. Restablecer el agua es prioritario.",
    };
  }

  if (autonomiaDias == null) {
    return {
      ...base,
      autonomiaDias,
      estado: "ok",
      recomendacion: "Sin población alojada: no hay consumo por ahora.",
    };
  }

  if (autonomiaDias < 1) {
    return {
      ...base,
      autonomiaDias,
      estado: "critico",
      recomendacion:
        `El tanque cubre menos de 1 día para ${ocupados.toLocaleString("es")} personas. ` +
        `Reponer hoy y asegurar suministro diario.`,
    };
  }

  if (autonomiaDias < 3) {
    return {
      ...base,
      autonomiaDias,
      estado: "atencion",
      recomendacion:
        `El tanque cubre ~${fmtDias(autonomiaDias)} para ${ocupados.toLocaleString("es")} ` +
        `personas. Programar reposición frecuente; en zonas sin agua diaria, no esperar a que se vacíe.`,
    };
  }

  return {
    ...base,
    autonomiaDias,
    estado: "ok",
    recomendacion:
      `El tanque cubre ~${fmtDias(autonomiaDias)} para ${ocupados.toLocaleString("es")} ` +
      `personas. Garantizar la reposición recurrente (el agua puede no llegar a diario).`,
  };
}

// ---------------------------------------------------------------------------

export type SemaforoCentro = "verde" | "amarillo" | "rojo" | "sin_datos";

export interface AnalisisCentro {
  /** Damnificados / población afectada alojada. */
  refugiados: number;
  /** Personal operativo desplegado (funcionarios, salud, justicia). */
  personal: number;
  /** Damnificados + personal → demanda real de agua, comida y baños. */
  personasLogistica: number;
  /** @deprecated Alias de `refugiados` (compatibilidad con UI existente). */
  ocupados: number;
  familias: number;
  /** Recursos contables (camas, baños, duchas, basura). Agua va aparte. */
  recursos: RecursoAnalisis[];
  agua: AnalisisAgua;
  /** Capacidad efectiva Esfera = mínima capacidadPersonas entre recursos que cuentan. */
  capacidadEfectiva: number | null;
  /** Cupo Esfera (>= 0). Diagnóstico de infraestructura, no KPI primario. */
  cupoReal: number | null;
  /** Aforo habilitado del censo oficial (editable). */
  capacidadInstalada: number | null;
  /** Aforo teórico del inmueble (censo oficial). */
  capacidadMaxima: number | null;
  /**
   * Cupo oficial: capacidad_instalada − damnificados.
   * Puede ser negativo (sobrecupo). null si no hay capacidad_instalada.
   */
  cupoOficial: number | null;
  /**
   * KPI primario de cupo: oficial si hay dato; si no, cupo Esfera.
   * El oficial puede ser negativo; el Esfera está acotado a >= 0.
   */
  cupoDisponible: number | null;
  /** Recurso que fija el límite Esfera (menor margen). null si no hay datos. */
  cuelloBotella: RecursoAnalisis | null;
  /** % de ocupación respecto a la capacidad usada para el semáforo. */
  porcentajeOcupacion: number | null;
  semaforo: SemaforoCentro;
}

/** Damnificados alojados en el centro (sin contar personal operativo). */
export function ocupadosDe(centro: CentroTransitorio): number {
  return poblacionCentro(centro);
}

/**
 * Cupo según censo oficial: capacidad_instalada − damnificados.
 * null si aún no se registró capacidad_instalada. Puede ser negativo.
 */
export function cupoOficial(centro: CentroTransitorio): number | null {
  const inst = normalizarCentro(centro).censo_oficial.capacidad_instalada;
  if (inst == null) return null;
  return inst - poblacionCentro(centro);
}

function pct(ocupados: number, cap: number): number {
  if (cap <= 0) return ocupados > 0 ? 999 : 0;
  return Math.round((ocupados / cap) * 100);
}

function semaforoPorOcupacion(porcentaje: number): SemaforoCentro {
  if (porcentaje >= 100) return "rojo";
  if (porcentaje >= 80) return "amarillo";
  return "verde";
}

/**
 * Análisis completo de capacidad/ocupación de un centro.
 * - Cupo KPI: censo oficial (`capacidad_instalada`) cuando existe.
 * - Esfera (camas/baños/duchas): diagnóstico de infraestructura; un recurso sin
 *   instalar no fuerza el cupo Esfera a 0 (se asume "no medido").
 */
export function analisisCentro(centro: CentroTransitorio): AnalisisCentro {
  const c = normalizarCentro(centro);
  const cap = c.capacidad;
  const refugiados = poblacionCentro(centro);
  const personal = totalPersonalOperativo(c.personal);
  const logistica = personasLogistica(centro);
  const familias = c.familias_ocupadas;
  const capacidadInstalada = c.censo_oficial.capacidad_instalada;
  const capacidadMaxima = c.censo_oficial.capacidad_maxima;
  const cupoOficialValor =
    capacidadInstalada == null ? null : capacidadInstalada - refugiados;

  // Unidades que DEBERÍAN existir para damnificados + personal (Esfera).
  const reqCamas = logistica;
  const reqPocetas = logistica > 0 ? Math.ceil(logistica / PERSONAS_POR_POCETA) : 0;
  const reqDuchas = logistica > 0 ? Math.ceil(logistica / PERSONAS_POR_DUCHA) : 0;
  const reqLavaderos = logistica > 0 ? Math.ceil(logistica / PERSONAS_POR_LAVADERO) : 0;
  const reqContenedores = familias > 0 ? Math.ceil(familias / FAMILIAS_POR_CONTENEDOR) : 0;

  const recursos: RecursoAnalisis[] = [
    {
      clave: "camas",
      label: "Camas",
      unidad: "camas",
      descripcionEstandar: "1 cama/colchón por cada persona alojada.",
      instaladas: cap.camas_instaladas,
      operativas: cap.camas_operativas,
      requeridas: reqCamas,
      capacidadPersonas: cap.camas_operativas,
      medido: cap.camas_instaladas > 0,
      cuentaParaCupo: true,
      sinNecesidad: reqCamas === 0,
      cobertura: cobertura(cap.camas_operativas, reqCamas),
      margen: cap.camas_operativas - logistica,
      porcentaje: pct(logistica, cap.camas_operativas),
    },
    {
      clave: "pocetas",
      label: "Pocetas / baños",
      unidad: "baños",
      descripcionEstandar: `Esfera 2018: 1 baño/letrina por cada ${PERSONAS_POR_POCETA} personas (mediano plazo; 1:50 en fase inicial). Objetivo 3:1 mujeres:hombres.`,
      instaladas: cap.pocetas_instaladas,
      operativas: cap.pocetas_operativas,
      requeridas: reqPocetas,
      capacidadPersonas: cap.pocetas_operativas * PERSONAS_POR_POCETA,
      medido: cap.pocetas_instaladas > 0,
      cuentaParaCupo: true,
      sinNecesidad: reqPocetas === 0,
      cobertura: cobertura(cap.pocetas_operativas, reqPocetas),
      margen: cap.pocetas_operativas * PERSONAS_POR_POCETA - logistica,
      porcentaje: pct(logistica, cap.pocetas_operativas * PERSONAS_POR_POCETA),
    },
    {
      clave: "duchas",
      label: "Duchas",
      unidad: "duchas",
      descripcionEstandar: `Esfera 2018: máx. ${PERSONAS_POR_DUCHA} personas por instalación de baño/ducha.`,
      instaladas: cap.duchas_instaladas,
      operativas: cap.duchas_operativas,
      requeridas: reqDuchas,
      capacidadPersonas: cap.duchas_operativas * PERSONAS_POR_DUCHA,
      medido: cap.duchas_instaladas > 0,
      cuentaParaCupo: true,
      sinNecesidad: reqDuchas === 0,
      cobertura: cobertura(cap.duchas_operativas, reqDuchas),
      margen: cap.duchas_operativas * PERSONAS_POR_DUCHA - logistica,
      porcentaje: pct(logistica, cap.duchas_operativas * PERSONAS_POR_DUCHA),
    },
    {
      clave: "lavaderos",
      label: "Lavaderos de ropa",
      unidad: "lavaderos",
      descripcionEstandar: `Esfera 2018: máx. ${PERSONAS_POR_LAVADERO} personas por instalación de lavado de ropa. Lavar ropa con frecuencia consume mucha agua: súmalo a la demanda del tanque.`,
      instaladas: cap.lavaderos_instalados,
      operativas: cap.lavaderos_operativos,
      requeridas: reqLavaderos,
      // Servicio de higiene; no fija el headcount → no entra en el cupo de personas.
      capacidadPersonas: 0,
      medido: cap.lavaderos_instalados > 0,
      cuentaParaCupo: false,
      sinNecesidad: reqLavaderos === 0,
      cobertura: cobertura(cap.lavaderos_operativos, reqLavaderos),
      margen: 0,
      porcentaje: 0,
    },
    {
      clave: "contenedores",
      label: "Contenedores de basura",
      unidad: "contenedores",
      descripcionEstandar: `Esfera: 1 contenedor de basura por cada ${FAMILIAS_POR_CONTENEDOR} familias.`,
      instaladas: cap.contenedores_instalados,
      operativas: cap.contenedores_operativos,
      requeridas: reqContenedores,
      // Se mide por familias, no por personas → no entra en el cupo de personas.
      capacidadPersonas: 0,
      medido: cap.contenedores_instalados > 0,
      cuentaParaCupo: false,
      sinNecesidad: reqContenedores === 0,
      cobertura: cobertura(cap.contenedores_operativos, reqContenedores),
      margen: 0,
      porcentaje: 0,
    },
  ];

  const agua = analizarAgua(cap.agua_tanque, cap.agua_operativa, cap.agua_litros, logistica);

  const medidos = recursos.filter((r) => r.medido && r.cuentaParaCupo);

  let capacidadEfectiva: number | null = null;
  let cupoReal: number | null = null;
  let cuelloBotella: RecursoAnalisis | null = null;
  let porcentajeEsfera: number | null = null;
  let semaforoEsfera: SemaforoCentro = "sin_datos";

  if (medidos.length > 0) {
    capacidadEfectiva = Math.min(...medidos.map((r) => r.capacidadPersonas));
    cupoReal = Math.max(0, capacidadEfectiva - logistica);
    cuelloBotella = medidos.reduce((min, r) => (r.margen < min.margen ? r : min), medidos[0]);
    porcentajeEsfera = pct(logistica, capacidadEfectiva);
    semaforoEsfera = semaforoPorOcupacion(porcentajeEsfera);
  }

  // Semáforo / %: prioriza censo oficial; fallback Esfera.
  let porcentajeOcupacion: number | null = null;
  let semaforo: SemaforoCentro = "sin_datos";
  if (capacidadInstalada != null) {
    porcentajeOcupacion = pct(refugiados, capacidadInstalada);
    semaforo = semaforoPorOcupacion(porcentajeOcupacion);
  } else if (porcentajeEsfera != null) {
    porcentajeOcupacion = porcentajeEsfera;
    semaforo = semaforoEsfera;
  }

  const cupoDisponible = cupoOficialValor ?? cupoReal;

  return {
    refugiados,
    personal,
    personasLogistica: logistica,
    ocupados: refugiados,
    familias,
    recursos,
    agua,
    capacidadEfectiva,
    cupoReal,
    capacidadInstalada,
    capacidadMaxima,
    cupoOficial: cupoOficialValor,
    cupoDisponible,
    cuelloBotella,
    porcentajeOcupacion,
    semaforo,
  };
}

// ---------------------------------------------------------------------------
// Alertas por recurso: qué servicios del centro están en déficit. Alimenta los
// íconos de alerta (cama, poceta, ducha…) del panel lateral y otras listas.
// ---------------------------------------------------------------------------

export type ClaveAlerta = ClaveRecurso | "agua";

export interface AlertaCentro {
  clave: ClaveAlerta;
  label: string;
  severidad: "rojo" | "amarillo";
  /** Explicación corta para el tooltip (qué falta y cuánto). */
  detalle: string;
}

/**
 * Recursos del centro en déficit según el estándar Esfera. Solo considera
 * recursos medidos y con necesidad real (población > 0). Rojo = cobertura
 * < 60% (o agua crítica); amarillo = cobertura parcial / agua por agotarse.
 */
export function alertasCentro(centro: CentroTransitorio): AlertaCentro[] {
  const a = analisisCentro(centro);
  const alertas: AlertaCentro[] = [];
  for (const r of a.recursos) {
    if (!r.medido || r.sinNecesidad || r.cobertura >= 100) continue;
    alertas.push({
      clave: r.clave,
      label: r.label,
      severidad: r.cobertura < 60 ? "rojo" : "amarillo",
      detalle: `${r.label}: ${r.operativas} de ${r.requeridas} ${r.unidad} requeridas (${r.cobertura}% de cobertura).`,
    });
  }
  if (a.agua.estado === "critico" || a.agua.estado === "atencion") {
    alertas.push({
      clave: "agua",
      label: "Agua potable",
      severidad: a.agua.estado === "critico" ? "rojo" : "amarillo",
      detalle: a.agua.recomendacion,
    });
  }
  return alertas;
}

/** Color del semáforo para pintar marcadores/tarjetas. */
export const COLOR_SEMAFORO: Record<SemaforoCentro, string> = {
  verde: "#22c55e",
  amarillo: "#f59e0b",
  rojo: "#ef4444",
  sin_datos: "#64748b",
};

/** Color por estado del agua. */
export const COLOR_ESTADO_AGUA: Record<EstadoAgua, string> = {
  ok: "#22c55e",
  atencion: "#f59e0b",
  critico: "#ef4444",
  sin_datos: "#64748b",
};
