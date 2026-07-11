import {
  aplicarParteActualACentro,
  aplicarPartesActualesACentros,
} from "./parteActualCentros";
import {
  normalizarCentro,
  metaCuerpoDe,
  normalizarPersonal,
  PERSONAL_VACIO,
  marcadorOcupacionCentro,
  poblacionCentro,
  totalPersonalOperativo,
  totalJusticia,
  type CentroTransitorio,
  type PersonalCentro,
} from "./centrosTransitorios";
import { responsablesCoordinacionDeCentro } from "./coordinacionCentro";
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
import type { ReporteReparacionesDia, TrabajoCentro } from "./reparaciones";
import type { ReporteControlDia } from "./controlReporte";
import type { RequerimientoSeguimiento } from "./requerimientosSeguimiento";
import type { CasoSaludCentro } from "./casosSalud";
import type { EventoReporte } from "./eventosReportes";
import { CATEGORIAS_REQUERIMIENTO } from "./requerimientosSeguimiento";
import { diasAbierto } from "./antiguedadSeguimiento";
import { metaUnidadSebinDe } from "./unidadesSebin";
import type { NivelPrioridad } from "./prioridadCentros";
import type { TipoEventoReporte } from "./eventosReportes";
import {
  serieOcupacionRedVentana,
  type SnapshotOcupacion,
} from "./serieOcupacionCentros";
import {
  totalHombres,
  totalMujeres,
  totalVulnerables,
  type Vulnerables,
} from "./tipos";
import {
  agruparPorUnidadConteo,
  contarUnidadesCon,
  marcadorOcupacionUnidad,
} from "./complejosCentros";
import {
  normalizarUbicacionCentro,
} from "./catalogosHumanitarios";

/** Ente encargado: primero coordinación comunitaria, si no el censo oficial. */
export function enteResponsableDeCentro(centro: CentroTransitorio): string {
  const c = normalizarCentro(centro);
  for (const r of responsablesCoordinacionDeCentro(c)) {
    if (r.categoria !== "comunitaria") continue;
    const ente = r.ente.trim();
    if (ente) return ente;
  }
  return c.censo_oficial.ministerio_ente.trim();
}

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
  /** Controles operativos (se filtran por `dia`). */
  controles?: ReporteControlDia[];
  /** Trabajos activos (pendiente / en progreso) de toda la red. */
  trabajosActivos?: TrabajoCentro[];
  /** Requerimientos abiertos de toda la red. */
  requerimientosActivos?: RequerimientoSeguimiento[];
  /** Casos de salud abiertos (activo / en proceso) de toda la red. */
  casosSaludAbiertos?: CasoSaludCentro[];
  /** Novedades con título/descripción (se filtran por `dia`). */
  eventosDetalle?: EventoReporte[];
  /** Estatus del censo SEBIN de la red (conteo por estado). */
  censoEstados?: CensoEstadosEjecutivo | null;
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
  /** Desglose H/M por grupo etario (para el parte demográfico detallado). */
  porGrupo: {
    etiqueta: string;
    h: number;
    m: number;
  }[];
  discapacidadH: number;
  discapacidadM: number;
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

export interface ConteoSiNo {
  si: number;
  no: number;
  sinReporte: number;
}

export interface ControlEjecutivo {
  campamentosRevisados: number;
  captahuella: ConteoSiNo;
  juezPaz: ConteoSiNo;
  servicioMedico: ConteoSiNo;
  ambulancia: ConteoSiNo;
}

export interface FilaRedEjecutiva {
  /** N° oficial del campamento en el sistema (varios locales pueden compartir el mismo). */
  nro: number | null;
  nombre: string;
  /** Estado federativo del centro. */
  estado: string;
  /**
   * Segmento de la tabla del PDF.
   * Distrito Capital + Miranda → «Caracas y Miranda»; La Guaira aparte.
   */
  segmento: string;
  parroquia: string;
  /** Ministerio / ente u organización encargado del campamento. */
  enteResponsable: string;
  cuerpo: string;
  unidadSebin: string;
  /** Supervisor SEBIN asignado al campamento (`supervision.supervisor_sebin`). */
  responsableSebin: string;
  refugiados: number;
  familias: number;
  parteDia: boolean;
  captahuella: boolean | null;
  juezPaz: boolean | null;
  trabajos: number;
  /** Antigüedad (días) del trabajo activo más viejo, o null. */
  trabajoMasViejoDias: number | null;
  /** Título y antigüedad de cada trabajo activo del campamento. */
  trabajosDetalle: { titulo: string; dias: number }[];
  casosSalud: number;
  novedades: number;
  /** Casos de salud abiertos del campamento (título, estatus y días abiertos). */
  casosDetalle: { titulo: string; estatus: string; dias: number }[];
  /** Novedades del día del campamento (título y tipo). */
  novedadesDetalle: { titulo: string; tipo: TipoEventoReporte }[];
}

/** Segmento de red para el PDF ejecutivo (une capital + Miranda). */
export function segmentoReporteRed(estadoFederativo: string): string {
  const e = estadoFederativo.trim().toLocaleLowerCase("es");
  if (
    e === "distrito capital" ||
    e === "dtto. capital" ||
    e === "dtto capital" ||
    e === "caracas" ||
    e === "miranda"
  ) {
    return "Caracas y Miranda";
  }
  if (e === "la guaira" || e === "vargas") {
    return "La Guaira";
  }
  return estadoFederativo.trim() || "Sin estado";
}

function ordenSegmentoReporte(segmento: string): number {
  if (segmento === "Caracas y Miranda") return 1;
  if (segmento === "La Guaira") return 2;
  return 9;
}

export interface CasoSaludEjecutivo {
  centro: string;
  titulo: string;
  descripcion: string;
  estatus: string;
  dias: number;
}

export interface NovedadEjecutiva {
  centro: string;
  tipo: TipoEventoReporte;
  titulo: string;
  descripcion: string;
}

export interface RequerimientoCategoriaEjecutivo {
  categoria: string;
  items: number;
  unidades: number;
}

export interface CensoEstadosEjecutivo {
  completados: number;
  enCurso: number;
  sinIniciar: number;
}

export interface UnidadSebinEjecutiva {
  unidad: string;
  campamentos: number;
  refugiados: number;
}

export interface TrabajoRedItem {
  centro: string;
  titulo: string;
  estatus: string;
  dias: number;
}

export interface TrabajosRedEjecutivo {
  activos: number;
  pendientes: number;
  enProgreso: number;
  campamentos: number;
  masViejoDias: number | null;
  /** Detalle de cada trabajo activo (más viejos primero). */
  lista: TrabajoRedItem[];
}

export interface OcupacionRedEjecutiva {
  activo: number;
  sinRefugiados: number;
}

/** Ocupación de unidades de conteo por segmento regional. */
export interface OcupacionSegmentoEjecutivo {
  /** Etiqueta de visualización (p. ej. «Caracas / Miranda», «Vargas»). */
  segmento: string;
  /** Unidades con damnificados. */
  conPersonas: number;
  /** Unidades sin damnificados. */
  desocupados: number;
  total: number;
}

/** Punto diario de la totalización semanal (últimos 7 días). */
export interface PuntoSerieSemanalEjecutivo {
  dia: string;
  total: number;
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
  control: ControlEjecutivo;
  filasRed: FilaRedEjecutiva[];
  casosSaludDetalle: CasoSaludEjecutivo[];
  novedadesDetalle: NovedadEjecutiva[];
  requerimientosPorCategoria: RequerimientoCategoriaEjecutivo[];
  trabajosRed: TrabajosRedEjecutivo;
  /** Campamentos con parte numérico del día del corte. */
  partesDelDia: number;
  unidadesSebin: UnidadSebinEjecutiva[];
  censo: CensoEstadosEjecutivo | null;
  ocupacionRed: OcupacionRedEjecutiva;
  /** Ocupación por región (Caracas/Miranda, Vargas, …). */
  ocupacionPorSegmento: OcupacionSegmentoEjecutivo[];
  /** Total de personas (damnificados) por día, últimos 7 días hasta el corte. */
  serieSemanal: PuntoSerieSemanalEjecutivo[];
}

function etiquetaSegmentoOcupacion(segmento: string): string {
  if (segmento === "Caracas y Miranda") return "Caracas / Miranda";
  if (segmento === "La Guaira") return "Vargas";
  return segmento;
}

function conteosOcupacionRed(
  centros: CentroTransitorio[],
  snapshots: SnapshotOcupacion[],
  dia: string,
): OcupacionRedEjecutiva {
  let activo = 0;
  let sinRefugiados = 0;
  for (const miembros of agruparPorUnidadConteo(centros).values()) {
    const marcadores = miembros.map((centro) => {
      const snap = snapshots.find((s) => s.centro_id === centro.id && s.dia === dia);
      const base = snap ? aplicarParteActualACentro(centro, snap) : centro;
      return marcadorOcupacionCentro(base);
    });
    if (marcadorOcupacionUnidad(marcadores) === "activo") activo += 1;
    else sinRefugiados += 1;
  }
  return { activo, sinRefugiados };
}

function conteosOcupacionPorSegmento(
  centros: CentroTransitorio[],
  snapshots: SnapshotOcupacion[],
  dia: string,
): OcupacionSegmentoEjecutivo[] {
  const porClave = new Map<string, { conPersonas: number; desocupados: number }>();
  for (const miembros of agruparPorUnidadConteo(centros).values()) {
    const representante = miembros[0];
    if (!representante) continue;
    const ubi = normalizarUbicacionCentro(normalizarCentro(representante));
    const clave = segmentoReporteRed(
      ubi.estado_federativo || representante.estado_federativo || "",
    );
    const marcadores = miembros.map((centro) => {
      const snap = snapshots.find((s) => s.centro_id === centro.id && s.dia === dia);
      const base = snap ? aplicarParteActualACentro(centro, snap) : centro;
      return marcadorOcupacionCentro(base);
    });
    const fila = porClave.get(clave) ?? { conPersonas: 0, desocupados: 0 };
    if (marcadorOcupacionUnidad(marcadores) === "activo") fila.conPersonas += 1;
    else fila.desocupados += 1;
    porClave.set(clave, fila);
  }
  return [...porClave.entries()]
    .sort((a, b) => ordenSegmentoReporte(a[0]) - ordenSegmentoReporte(b[0]))
    .map(([clave, v]) => ({
      segmento: etiquetaSegmentoOcupacion(clave),
      conPersonas: v.conPersonas,
      desocupados: v.desocupados,
      total: v.conPersonas + v.desocupados,
    }));
}

function porcentaje(valor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((valor / total) * 100);
}

function sumarDemografia(v: Vulnerables): DemografiaEjecutiva {
  const discapacidad = v.discapacidad_h + v.discapacidad_m;
  const porGrupo = [
    { etiqueta: "0-2 años", h: v.recien_nacidos_h, m: v.recien_nacidos_m },
    { etiqueta: "3-11 años", h: v.ninos, m: v.ninas },
    { etiqueta: "12-17 años", h: v.adolescentes_h, m: v.adolescentes_m },
    { etiqueta: "18-59 años", h: v.adultos_h, m: v.adultos_m },
    { etiqueta: "60+ años", h: v.adultos_mayores_h, m: v.adultos_mayores_m },
  ];
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
    porGrupo,
    discapacidadH: v.discapacidad_h,
    discapacidadM: v.discapacidad_m,
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
  for (const miembros of agruparPorUnidadConteo(centros).values()) {
    const representante = miembros[0];
    if (!representante) continue;
    const grupo = representante.grupo?.trim() || "Sin grupo";
    const fila = grupos.get(grupo) ?? {
      grupo,
      campamentos: 0,
      refugiados: 0,
      familias: 0,
    };
    fila.campamentos += 1;
    for (const centro of miembros) {
      const c = normalizarCentro(centro);
      fila.refugiados += poblacionCentro(c);
      fila.familias += c.familias_ocupadas;
    }
    grupos.set(grupo, fila);
  }
  return [...grupos.values()].sort((a, b) => b.refugiados - a.refugiados);
}

function agruparPorCuerpo(centros: CentroTransitorio[]): CuerpoEjecutivo[] {
  const cuerpos = new Map<string, CuerpoEjecutivo>();
  for (const miembros of agruparPorUnidadConteo(centros).values()) {
    const representante = miembros[0];
    if (!representante) continue;
    const cuerpo = metaCuerpoDe(representante.cuerpo).label;
    const fila = cuerpos.get(cuerpo) ?? {
      cuerpo,
      campamentos: 0,
      refugiados: 0,
      familias: 0,
    };
    fila.campamentos += 1;
    for (const centro of miembros) {
      const c = normalizarCentro(centro);
      fila.refugiados += poblacionCentro(c);
      fila.familias += c.familias_ocupadas;
    }
    cuerpos.set(cuerpo, fila);
  }
  return [...cuerpos.values()].sort(
    (a, b) => b.campamentos - a.campamentos || b.refugiados - a.refugiados,
  );
}

function resumenDiario({
  reportes,
  snapshots,
  eventos,
  dia,
}: Pick<
  EntradaReporteEjecutivoCampamentos,
  "reportes" | "snapshots" | "eventos" | "dia"
>): ResumenDiarioEjecutivo {
  const reportesDia = reportes.filter((r) => r.dia === dia);
  const eventosDia = (eventos ?? []).filter((e) => e.dia === dia);
  const campamentosConTrabajo = new Set(
    reportesDia.filter((r) => r.trabajos_revisados).map((r) => r.centro_id),
  );
  const incidenciasSaludSnapshots = snapshots
    .filter((s) => s.dia === dia)
    .reduce((acc, s) => acc + (s.incidencias_salud ?? 0), 0);

  return {
    eventosPositivos: eventosDia.filter((e) => e.tipo === "positivo").length,
    eventosNegativos: eventosDia.filter((e) => e.tipo === "negativo").length,
    incidenciasSalud: incidenciasSaludSnapshots,
    atencionesSalud: reportesDia.reduce((acc, r) => acc + r.atenciones_medicas, 0),
    trabajosRealizados: reportesDia.filter((r) => r.trabajos_revisados).length,
    campamentosConTrabajo: campamentosConTrabajo.size,
    campamentosConComida: 0,
    reportesConAlimentacion: 0,
  };
}

function conteoSiNoUnidades(
  centros: CentroTransitorio[],
  controles: ReporteControlDia[],
  campo: "captahuella" | "juez_paz" | "servicio_medico" | "ambulancia",
): ConteoSiNo {
  const controlPorCentro = new Map(controles.map((c) => [c.centro_id, c]));
  let si = 0;
  let no = 0;
  let sinReporte = 0;
  for (const miembros of agruparPorUnidadConteo(centros).values()) {
    const valores = miembros.map((m) => controlPorCentro.get(m.id)?.[campo]);
    if (valores.some((v) => v === true)) si += 1;
    else if (valores.some((v) => v === false)) no += 1;
    else sinReporte += 1;
  }
  return { si, no, sinReporte };
}

export function construirReporteEjecutivoCampamentos({
  centros,
  snapshots,
  reportes,
  eventos = [],
  controles = [],
  trabajosActivos = [],
  requerimientosActivos = [],
  casosSaludAbiertos = [],
  eventosDetalle = [],
  censoEstados = null,
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

  // ---- Secciones nuevas: control, tabla de red y detalle del día ----
  const hoyRef = dia;
  const controlesDia = controles.filter((c) => c.dia === dia);
  const controlPorCentro = new Map(controlesDia.map((c) => [c.centro_id, c]));
  const trabajosVivos = trabajosActivos.filter(
    (t) => t.estatus === "pendiente" || t.estatus === "en_progreso",
  );
  const trabajosPorCentro = new Map<string, TrabajoCentro[]>();
  for (const t of trabajosVivos) {
    const lista = trabajosPorCentro.get(t.centro_id) ?? [];
    lista.push(t);
    trabajosPorCentro.set(t.centro_id, lista);
  }
  const casosPorCentro = new Map<string, CasoSaludCentro[]>();
  for (const c of casosSaludAbiertos) {
    const lista = casosPorCentro.get(c.centro_id) ?? [];
    lista.push(c);
    casosPorCentro.set(c.centro_id, lista);
  }
  const eventosDia = eventosDetalle.filter((e) => e.dia === dia);
  const eventosPorCentro = new Map<string, EventoReporte[]>();
  for (const e of eventosDia) {
    const lista = eventosPorCentro.get(e.centro_id) ?? [];
    lista.push(e);
    eventosPorCentro.set(e.centro_id, lista);
  }
  const diasConParteHoy = new Set(
    snapshots.filter((s) => s.dia === dia).map((s) => s.centro_id),
  );
  const nombreDe = new Map(centrosConParte.map((c) => [c.id, c.nombre]));

  const control: ControlEjecutivo = {
    campamentosRevisados: contarUnidadesCon(centrosConParte, (c) =>
      Boolean(controlPorCentro.get(c.id)?.revisado),
    ),
    captahuella: conteoSiNoUnidades(centrosConParte, controlesDia, "captahuella"),
    juezPaz: conteoSiNoUnidades(centrosConParte, controlesDia, "juez_paz"),
    servicioMedico: conteoSiNoUnidades(centrosConParte, controlesDia, "servicio_medico"),
    ambulancia: conteoSiNoUnidades(centrosConParte, controlesDia, "ambulancia"),
  };

  const filasRed: FilaRedEjecutiva[] = centrosConParte
    .map((centro) => {
      const c = normalizarCentro(centro);
      const ubi = normalizarUbicacionCentro(c);
      const ctrl = controlPorCentro.get(centro.id);
      const trabajosCentro = trabajosPorCentro.get(centro.id) ?? [];
      const masViejo = trabajosCentro.length
        ? Math.max(...trabajosCentro.map((t) => diasAbierto(t.reportada_dia, hoyRef)))
        : null;
      const unidad = metaUnidadSebinDe(centro.supervision?.unidad_sebin);
      return {
        nro: centro.nro ?? null,
        nombre: centro.nombre,
        estado: ubi.estado_federativo.trim() || "Sin estado",
        segmento: segmentoReporteRed(ubi.estado_federativo || centro.estado_federativo || ""),
        parroquia: ubi.parroquia || centro.parroquia,
        enteResponsable: enteResponsableDeCentro(c),
        cuerpo: metaCuerpoDe(centro.cuerpo).label,
        unidadSebin: unidad.clave !== "sin_asignar" ? unidad.label : "",
        responsableSebin: centro.supervision?.supervisor_sebin?.trim() ?? "",
        refugiados: poblacionCentro(c),
        familias: c.familias_ocupadas,
        parteDia: diasConParteHoy.has(centro.id),
        captahuella: ctrl ? ctrl.captahuella : null,
        juezPaz: ctrl ? ctrl.juez_paz : null,
        trabajos: trabajosCentro.length,
        trabajoMasViejoDias: masViejo,
        trabajosDetalle: trabajosCentro
          .map((t) => ({ titulo: t.titulo, dias: diasAbierto(t.reportada_dia, hoyRef) }))
          .sort((a, b) => b.dias - a.dias),
        casosSalud: (casosPorCentro.get(centro.id) ?? []).length,
        novedades: (eventosPorCentro.get(centro.id) ?? []).length,
        casosDetalle: (casosPorCentro.get(centro.id) ?? [])
          .map((caso) => ({
            titulo: caso.titulo,
            estatus: caso.estatus,
            dias: diasAbierto(caso.reportado_dia, hoyRef),
          }))
          .sort((a, b) => b.dias - a.dias),
        novedadesDetalle: (eventosPorCentro.get(centro.id) ?? []).map((e) => ({
          titulo: e.titulo,
          tipo: e.tipo,
        })),
      };
    })
    .sort(
      (a, b) =>
        ordenSegmentoReporte(a.segmento) - ordenSegmentoReporte(b.segmento) ||
        a.segmento.localeCompare(b.segmento, "es") ||
        (a.nro ?? 9999) - (b.nro ?? 9999) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );

  const casosSaludDetalle: CasoSaludEjecutivo[] = [...casosSaludAbiertos]
    .sort(
      (a, b) =>
        diasAbierto(b.reportado_dia, hoyRef) - diasAbierto(a.reportado_dia, hoyRef),
    )
    .map((c) => ({
      centro: nombreDe.get(c.centro_id) ?? c.centro_id,
      titulo: c.titulo,
      descripcion: c.descripcion,
      estatus: c.estatus,
      dias: diasAbierto(c.reportado_dia, hoyRef),
    }));

  const novedadesDetalle: NovedadEjecutiva[] = eventosDia.map((e) => ({
    centro: nombreDe.get(e.centro_id) ?? e.centro_id,
    tipo: e.tipo,
    titulo: e.titulo,
    descripcion: e.descripcion,
  }));

  const etiquetasCategoria = new Map<string, string>(
    CATEGORIAS_REQUERIMIENTO.map((c) => [c.valor, c.label]),
  );
  const porCategoria = new Map<string, RequerimientoCategoriaEjecutivo>();
  for (const r of requerimientosActivos) {
    const label = etiquetasCategoria.get(r.categoria) ?? r.categoria;
    const acc = porCategoria.get(label) ?? { categoria: label, items: 0, unidades: 0 };
    acc.items += 1;
    acc.unidades += r.cantidad;
    porCategoria.set(label, acc);
  }
  const requerimientosPorCategoria = [...porCategoria.values()].sort(
    (a, b) => b.items - a.items,
  );

  const unidadesMap = new Map<string, UnidadSebinEjecutiva>();
  for (const miembros of agruparPorUnidadConteo(centrosConParte).values()) {
    const representante = miembros[0];
    if (!representante) continue;
    const unidad = metaUnidadSebinDe(representante.supervision?.unidad_sebin);
    const etiqueta = unidad.clave !== "sin_asignar" ? unidad.label : "Sin unidad asignada";
    const fila = unidadesMap.get(etiqueta) ?? { unidad: etiqueta, campamentos: 0, refugiados: 0 };
    fila.campamentos += 1;
    for (const centro of miembros) {
      fila.refugiados += poblacionCentro(normalizarCentro(centro));
    }
    unidadesMap.set(etiqueta, fila);
  }
  const unidadesSebin = [...unidadesMap.values()].sort(
    (a, b) => b.campamentos - a.campamentos || a.unidad.localeCompare(b.unidad),
  );

  const trabajosRed: TrabajosRedEjecutivo = {
    activos: trabajosVivos.length,
    pendientes: trabajosVivos.filter((t) => t.estatus === "pendiente").length,
    enProgreso: trabajosVivos.filter((t) => t.estatus === "en_progreso").length,
    campamentos: trabajosPorCentro.size,
    masViejoDias: trabajosVivos.length
      ? Math.max(...trabajosVivos.map((t) => diasAbierto(t.reportada_dia, hoyRef)))
      : null,
    lista: [...trabajosVivos]
      .map((t) => ({
        centro: nombreDe.get(t.centro_id) ?? t.centro_id,
        titulo: t.titulo,
        estatus: t.estatus,
        dias: diasAbierto(t.reportada_dia, hoyRef),
      }))
      .sort((a, b) => b.dias - a.dias || a.centro.localeCompare(b.centro)),
  };

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
      snapshots,
      eventos,
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
    control,
    filasRed,
    casosSaludDetalle,
    novedadesDetalle,
    requerimientosPorCategoria,
    trabajosRed,
    partesDelDia: contarUnidadesCon(centrosConParte, (c) => diasConParteHoy.has(c.id)),
    unidadesSebin,
    censo: censoEstados,
    ocupacionRed: conteosOcupacionRed(centros, snapshots, dia),
    ocupacionPorSegmento: conteosOcupacionPorSegmento(centros, snapshots, dia),
    serieSemanal: serieOcupacionRedVentana(
      snapshots,
      centros.map((c) => ({ id: c.id, grupo: c.grupo })),
      7,
      dia,
    ).map((p) => ({ dia: p.dia, total: p.total })),
  };
}
