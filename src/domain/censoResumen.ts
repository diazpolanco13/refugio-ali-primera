import type { Vulnerables } from "./tipos";

export type EstadoCensoCentro =
  | "sin_iniciar"
  | "en_curso"
  | "completado_declarado"
  /** Cierre declarado con 0 personas (sin damnificados / en adecuación). */
  | "sin_ocupantes";

/** Resumen agregado del censo rápido de una escuela/campamento. */
export interface ResumenCensoCentro {
  centroId: string;
  centroNombre: string;
  totalRegistrados: number;
  ultimoRegistroEn: string | null;
  cierreEn: string | null;
  cierreTotal: number | null;
  cierreFuncionario: string | null;
  hombres: number;
  mujeres: number;
  otrosSexo: number;
  recienNacidosH: number;
  recienNacidosM: number;
  ninos: number;
  ninas: number;
  adolescentesH: number;
  adolescentesM: number;
  adultosH: number;
  adultosM: number;
  adultosMayoresH: number;
  adultosMayoresM: number;
  embarazadas: number;
  discapacidad: number;
  discapacidadH: number;
  discapacidadM: number;
  enfermedad: number;
  viviendaDestruida: number;
  viviendaInhabitable: number;
  viviendaNoPosee: number;
  sinCondicionVivienda: number;
  /** Último parte numérico (ocupaciones_centros.total_afectados). */
  parteTotal: number | null;
  parteFamilias: number | null;
  parteDia: string | null;
  /** Registros sin cédula/documento. */
  sinCedula: number;
  /** Origen import_excel / legacy «Importación planilla» (no verificados). */
  importadosPlanilla: number;
  /** Sin edad consignada. */
  sinEdad: number;
  /** Personas marcadas como solicitadas en verificación SIIPOL/planilla. */
  solicitados: number;
  /** Personas con registro policial reportado en verificación SIIPOL/planilla. */
  conRegistroPolicial: number;
  /** Legado RPC: siempre 0 en UI (dato político retirado). */
  firmoContraPresidente: number;
}

export type EstadoContrasteCenso =
  | "sin_parte"
  | "sin_censo"
  | "en_progreso"
  | "cuadra"
  | "excede_parte";

/** Contraste censo vs último parte numérico de la revista diaria. */
export function estadoContrasteCenso(resumen: ResumenCensoCentro): EstadoContrasteCenso {
  const meta = resumen.parteTotal ?? 0;
  const actual = resumen.totalRegistrados;
  if (meta <= 0) return "sin_parte";
  if (actual <= 0) return "sin_censo";
  if (actual > meta) return "excede_parte";
  if (actual === meta) return "cuadra";
  return "en_progreso";
}

/** Avance del censo rápido vs el último parte numérico del campamento. */
export function progresoCensoVsParte(resumen: ResumenCensoCentro): {
  meta: number;
  actual: number;
  pctParte: number;
  pctCenso: number;
  faltan: number;
  excedente: number;
  tieneParte: boolean;
  contraste: EstadoContrasteCenso;
} {
  const meta = resumen.parteTotal ?? 0;
  const actual = resumen.totalRegistrados;
  const tieneParte = meta > 0;
  const contraste = estadoContrasteCenso(resumen);
  const escala = Math.max(meta, actual, 1);
  return {
    meta,
    actual,
    pctParte: tieneParte ? Math.round((meta / escala) * 100) : 0,
    pctCenso: tieneParte ? Math.round((actual / escala) * 100) : 0,
    faltan: meta > actual ? meta - actual : 0,
    excedente: actual > meta ? actual - meta : 0,
    tieneParte,
    contraste,
  };
}

/** Porcentaje de registros con cédula (0–100). */
export function pctConCedula(resumen: ResumenCensoCentro): number {
  if (resumen.totalRegistrados <= 0) return 0;
  const conCedula = resumen.totalRegistrados - resumen.sinCedula;
  return Math.round((conCedula / resumen.totalRegistrados) * 100);
}

/** Estado del levantamiento según registros y último cierre declarado. */
export function estadoCensoCentro(resumen: ResumenCensoCentro): EstadoCensoCentro {
  // El cierre declarado manda: un centro vacío con cierre no es "sin iniciar".
  if (resumen.cierreEn) {
    if (resumen.totalRegistrados === 0) return "sin_ocupantes";
    return "completado_declarado";
  }
  if (resumen.totalRegistrados === 0) return "sin_iniciar";
  return "en_curso";
}

/** Suma de grupos etarios (excluye otros_sexo sin edad/sexo asignado). */
export function totalPoblacionResumen(resumen: ResumenCensoCentro): number {
  return (
    resumen.recienNacidosH +
    resumen.recienNacidosM +
    resumen.ninos +
    resumen.ninas +
    resumen.adolescentesH +
    resumen.adolescentesM +
    resumen.adultosH +
    resumen.adultosM +
    resumen.adultosMayoresH +
    resumen.adultosMayoresM
  );
}

/** Adaptador para reutilizar DemografiaResumen sin duplicar markup. */
export function aVulnerables(resumen: ResumenCensoCentro): Partial<Vulnerables> {
  return {
    recien_nacidos_h: resumen.recienNacidosH,
    recien_nacidos_m: resumen.recienNacidosM,
    ninos: resumen.ninos,
    ninas: resumen.ninas,
    adolescentes_h: resumen.adolescentesH,
    adolescentes_m: resumen.adolescentesM,
    adultos_h: resumen.adultosH,
    adultos_m: resumen.adultosM,
    adultos_mayores_h: resumen.adultosMayoresH,
    adultos_mayores_m: resumen.adultosMayoresM,
    embarazadas: resumen.embarazadas,
    discapacidad_h: resumen.discapacidadH,
    discapacidad_m: resumen.discapacidadM,
    mascotas: 0,
  };
}
