import { aplicarPartesActualesACentros } from "./parteActualCentros";
import {
  normalizarCentro,
  metaCuerpoDe,
  normalizarPersonal,
  PERSONAL_VACIO,
  poblacionCentro,
  totalPersonalOperativo,
  totalJusticia,
  type CentroTransitorio,
  type PersonalCentro,
} from "./centrosTransitorios";
import { COMIDAS_POR_PERSONA_DIA, demandaAguaDia } from "./estandares";
import {
  demografiaRed,
  kpisRedCentros,
  topPrioridadCentros,
} from "./redCentros";
import {
  racionesDelDia,
  type ReporteDiario,
} from "./reporteDiario";
import type { ReporteReparacionesDia } from "./reparaciones";
import type { Incidencia } from "./incidencias";
import type { NivelPrioridad } from "./prioridadCentros";
import type { TipoEventoReporte } from "./eventosReportes";
import type { SnapshotOcupacion } from "./serieOcupacionCentros";
import {
  totalHombres,
  totalMujeres,
  totalVulnerables,
  type Vulnerables,
} from "./tipos";

export interface EventoReporteEjecutivo {
  centro_id: string;
  dia: string;
  tipo: TipoEventoReporte;
}

export interface EntradaReporteEjecutivoCampamentos {
  centros: CentroTransitorio[];
  snapshots: SnapshotOcupacion[];
  reportes: ReporteDiario[];
  reportesReparaciones?: ReporteReparacionesDia[];
  eventos?: EventoReporteEjecutivo[];
  incidencias?: Incidencia[];
  dia: string;
  generadoTs?: number;
  generadoPor?: string | null;
}

export interface DemografiaEjecutiva {
  total: number;
  hombres: number;
  mujeres: number;
  recienNacidos: number;
  ninos: number;
  adolescentes: number;
  adultos: number;
  adultosMayores: number;
  embarazadas: number;
  discapacidad: number;
  vulnerables: number;
  mascotas: number;
}

export interface LogisticaEjecutiva {
  personasLogistica: number;
  racionesGestionadas: number;
  objetivoRaciones: number;
  coberturaRaciones: number;
  aguaPotableL: number;
  aguaUsoCotidianoL: number;
  comidasPorPersonaDia: number;
}

export interface ResumenDiarioEjecutivo {
  eventosPositivos: number;
  eventosNegativos: number;
  incidenciasSalud: number;
  atencionesSalud: number;
  trabajosRealizados: number;
  campamentosConTrabajo: number;
  campamentosConComida: number;
  reportesConAlimentacion: number;
}

export interface GrupoEjecutivo {
  grupo: string;
  campamentos: number;
  refugiados: number;
  familias: number;
}

export interface CuerpoEjecutivo {
  cuerpo: string;
  campamentos: number;
  refugiados: number;
  familias: number;
}

export interface PrioridadEjecutiva {
  nro: number | null;
  nombre: string;
  grupo: string;
  parroquia: string;
  nivel: NivelPrioridad;
  refugiados: number;
  familias: number;
  factores: string[];
}

export interface ReporteEjecutivoCampamentos {
  dia: string;
  generadoTs: number;
  generadoPor: string;
  kpis: ReturnType<typeof kpisRedCentros> & {
    mascotasTotal: number;
    personasLogisticaTotal: number;
  };
  demografia: DemografiaEjecutiva;
  personal: PersonalCentro & {
    justicia: number;
    total: number;
  };
  logistica: LogisticaEjecutiva;
  resumenDia: ResumenDiarioEjecutivo;
  grupos: GrupoEjecutivo[];
  cuerpos: CuerpoEjecutivo[];
  prioridades: PrioridadEjecutiva[];
}

function porcentaje(valor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((valor / total) * 100);
}

function sumarDemografia(v: Vulnerables): DemografiaEjecutiva {
  const discapacidad = v.discapacidad_h + v.discapacidad_m;
  return {
    total: totalHombres(v) + totalMujeres(v),
    hombres: totalHombres(v),
    mujeres: totalMujeres(v),
    recienNacidos: v.recien_nacidos_h + v.recien_nacidos_m,
    ninos: v.ninos + v.ninas,
    adolescentes: v.adolescentes_h + v.adolescentes_m,
    adultos: v.adultos_h + v.adultos_m,
    adultosMayores: v.adultos_mayores_h + v.adultos_mayores_m,
    embarazadas: v.embarazadas,
    discapacidad,
    vulnerables: totalVulnerables(v),
    mascotas: v.mascotas,
  };
}

function sumarPersonal(centros: CentroTransitorio[]): ReporteEjecutivoCampamentos["personal"] {
  const total = { ...PERSONAL_VACIO };
  for (const centro of centros) {
    const personal = normalizarPersonal(normalizarCentro(centro).personal);
    total.funcionarios += personal.funcionarios;
    total.trabajadores += personal.trabajadores;
    total.medicos += personal.medicos;
    total.psicologos += personal.psicologos;
    total.justicia_tjs += personal.justicia_tjs;
    total.justicia_mp += personal.justicia_mp;
    total.justicia_defensoria += personal.justicia_defensoria;
  }
  return {
    ...total,
    justicia: totalJusticia(total),
    total: totalPersonalOperativo(total),
  };
}

function agruparPorGrupo(centros: CentroTransitorio[]): GrupoEjecutivo[] {
  const grupos = new Map<string, GrupoEjecutivo>();
  for (const centro of centros) {
    const c = normalizarCentro(centro);
    const grupo = centro.grupo?.trim() || "Sin grupo";
    const fila = grupos.get(grupo) ?? {
      grupo,
      campamentos: 0,
      refugiados: 0,
      familias: 0,
    };
    fila.campamentos += 1;
    fila.refugiados += poblacionCentro(c);
    fila.familias += c.familias_ocupadas;
    grupos.set(grupo, fila);
  }
  return [...grupos.values()].sort((a, b) => b.refugiados - a.refugiados);
}

function agruparPorCuerpo(centros: CentroTransitorio[]): CuerpoEjecutivo[] {
  const cuerpos = new Map<string, CuerpoEjecutivo>();
  for (const centro of centros) {
    const c = normalizarCentro(centro);
    const cuerpo = metaCuerpoDe(centro.cuerpo).label;
    const fila = cuerpos.get(cuerpo) ?? {
      cuerpo,
      campamentos: 0,
      refugiados: 0,
      familias: 0,
    };
    fila.campamentos += 1;
    fila.refugiados += poblacionCentro(c);
    fila.familias += c.familias_ocupadas;
    cuerpos.set(cuerpo, fila);
  }
  return [...cuerpos.values()].sort(
    (a, b) => b.campamentos - a.campamentos || b.refugiados - a.refugiados,
  );
}

function resumenDiario({
  reportes,
  reportesReparaciones,
  eventos,
  incidencias,
  dia,
}: Pick<EntradaReporteEjecutivoCampamentos, "reportes" | "reportesReparaciones" | "eventos" | "incidencias" | "dia">): ResumenDiarioEjecutivo {
  const reportesDia = reportes.filter((r) => r.dia === dia);
  const eventosDia = (eventos ?? []).filter((e) => e.dia === dia);
  const reportesRepDia = (reportesReparaciones ?? []).filter((r) => r.dia === dia);
  const incidenciasDia = (incidencias ?? []).filter((i) => i.dia === dia);
  const campamentosConTrabajo = new Set(
    reportesRepDia.filter((r) => r.se_trabajo_hoy).map((r) => r.centro_id),
  );
  const campamentosConComida = new Set(
    reportesDia
      .filter((r) => racionesDelDia(r) > 0)
      .map((r) => r.centro_id),
  );

  return {
    eventosPositivos: eventosDia.filter((e) => e.tipo === "positivo").length,
    eventosNegativos: eventosDia.filter((e) => e.tipo === "negativo").length,
    incidenciasSalud: incidenciasDia.filter((i) => i.categorias.includes("salud")).length,
    atencionesSalud: reportesDia.reduce((acc, r) => acc + r.atenciones_medicas, 0),
    trabajosRealizados: reportesRepDia.filter((r) => r.se_trabajo_hoy).length,
    campamentosConTrabajo: campamentosConTrabajo.size,
    campamentosConComida: campamentosConComida.size,
    reportesConAlimentacion: campamentosConComida.size,
  };
}

export function construirReporteEjecutivoCampamentos({
  centros,
  snapshots,
  reportes,
  reportesReparaciones = [],
  eventos = [],
  incidencias = [],
  dia,
  generadoTs = Date.now(),
  generadoPor,
}: EntradaReporteEjecutivoCampamentos): ReporteEjecutivoCampamentos {
  const centrosConParte = aplicarPartesActualesACentros(centros, snapshots, dia);
  const kpisBase = kpisRedCentros(centrosConParte);
  const demografia = sumarDemografia(demografiaRed(centrosConParte));
  const personal = sumarPersonal(centrosConParte);
  const personasLogistica = kpisBase.refugiadosTotal + personal.total;
  const agua = demandaAguaDia(personasLogistica);
  const reportesDia = reportes.filter((r) => r.dia === dia);
  const racionesGestionadas = reportesDia.reduce((acc, r) => acc + racionesDelDia(r), 0);
  const objetivoRaciones = personasLogistica * COMIDAS_POR_PERSONA_DIA;

  return {
    dia,
    generadoTs,
    generadoPor: generadoPor?.trim() || "Sala Situacional",
    kpis: {
      ...kpisBase,
      mascotasTotal: demografia.mascotas,
      personasLogisticaTotal: personasLogistica,
    },
    demografia,
    personal,
    logistica: {
      personasLogistica,
      racionesGestionadas,
      objetivoRaciones,
      coberturaRaciones: porcentaje(racionesGestionadas, objetivoRaciones),
      aguaPotableL: agua.potableL,
      aguaUsoCotidianoL: agua.usoCotidianoL,
      comidasPorPersonaDia: COMIDAS_POR_PERSONA_DIA,
    },
    resumenDia: resumenDiario({
      reportes,
      reportesReparaciones,
      eventos,
      incidencias,
      dia,
    }),
    grupos: agruparPorGrupo(centrosConParte),
    cuerpos: agruparPorCuerpo(centrosConParte),
    prioridades: topPrioridadCentros(centrosConParte, 5).map(({ centro, prioridad }) => {
      const c = normalizarCentro(centro);
      return {
        nro: centro.nro ?? null,
        nombre: centro.nombre,
        grupo: centro.grupo,
        parroquia: centro.parroquia,
        nivel: prioridad.nivel,
        refugiados: poblacionCentro(c),
        familias: c.familias_ocupadas,
        factores: prioridad.factores.slice(0, 3).map((f) => f.label),
      };
    }),
  };
}
