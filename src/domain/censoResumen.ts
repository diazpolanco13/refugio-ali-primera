import type { Vulnerables } from "./tipos";

export type EstadoCensoCentro = "sin_iniciar" | "en_curso" | "completado_declarado";

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
}

/** Estado del levantamiento según registros y último cierre declarado. */
export function estadoCensoCentro(resumen: ResumenCensoCentro): EstadoCensoCentro {
  if (resumen.totalRegistrados === 0) return "sin_iniciar";
  if (resumen.cierreEn) return "completado_declarado";
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
