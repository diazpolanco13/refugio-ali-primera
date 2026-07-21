// Seguimiento operativo derivado de los reportes diarios: casos de salud
// (`casos_salud_centros`), novedades (`eventos_reportes`) y trabajos
// (`reparaciones_centros` — ver SeguimientoTrabajosCentro).

import {
  casosAbiertosSeguimiento,
  META_ESTATUS_CASO_SALUD,
  type CasoSaludCentro,
  type EstatusCasoSalud,
} from "./casosSalud";
import {
  META_TIPO_EVENTO_REPORTE,
  type EventoReporte,
  type TipoEventoReporte,
} from "./eventosReportes";
import type { SnapshotOcupacion } from "./serieOcupacionCentros";

export type VentanaSeguimiento = 7 | 15 | 30;

export type TipoListaSeguimiento = "todos" | "salud" | "novedades";

export interface PuntoSerieSeguimiento {
  dia: string;
  incidenciasSalud: number;
  novedadesPositivas: number;
  novedadesNegativas: number;
  total: number;
}

export interface ContadoresSeguimientoCentro {
  casosAbiertos: number;
  casosActivos: number;
  casosResueltos: number;
  novedadesNegativasRecientes: number;
  novedadesHoy: number;
}

/** Casos que requieren seguimiento (activo, en proceso o resuelto sin archivar). */
export function casosSaludEnSeguimiento(casos: CasoSaludCentro[]): CasoSaludCentro[] {
  return casos.filter((c) => c.estatus !== "archivado");
}

/** Casos abiertos operativamente (activo o en proceso). */
export function casosSaludPendientes(casos: CasoSaludCentro[]): CasoSaludCentro[] {
  return casosAbiertosSeguimiento(casos);
}

export function contadoresSeguimientoCentro(
  casos: CasoSaludCentro[],
  eventos: EventoReporte[],
  hoyClave: string,
  diasRecientes = 7,
): ContadoresSeguimientoCentro {
  const enSeguimiento = casosSaludEnSeguimiento(casos);
  const pendientes = casosSaludPendientes(casos);
  const resueltos = enSeguimiento.filter((c) => c.estatus === "resuelto");

  const desdeReciente = restarDias(hoyClave, diasRecientes - 1);
  const novedadesNegativasRecientes = eventos.filter(
    (e) => e.tipo === "negativo" && e.dia >= desdeReciente,
  ).length;
  const novedadesHoy = eventos.filter((e) => e.dia === hoyClave).length;

  return {
    casosAbiertos: pendientes.length + resueltos.length,
    casosActivos: pendientes.length,
    casosResueltos: resueltos.length,
    novedadesNegativasRecientes,
    novedadesHoy,
  };
}

export function ultimosDiasSeguimiento(ventana: VentanaSeguimiento, hoyClave: string): string[] {
  const dias: string[] = [];
  for (let i = ventana - 1; i >= 0; i -= 1) {
    dias.push(restarDias(hoyClave, i));
  }
  return dias;
}

export function serieSeguimientoCentroVentana(
  centroId: string,
  snapshots: SnapshotOcupacion[],
  eventos: EventoReporte[],
  ventana: VentanaSeguimiento,
  hoyClave: string,
): PuntoSerieSeguimiento[] {
  const snapsCentro = snapshots.filter((s) => s.centro_id === centroId);
  const eventosCentro = eventos.filter((e) => e.centro_id === centroId);

  return ultimosDiasSeguimiento(ventana, hoyClave).map((dia) => {
    const snap = snapsCentro.find((s) => s.dia === dia);
    const incidenciasSalud = snap?.incidencias_salud ?? 0;
    const delDia = eventosCentro.filter((e) => e.dia === dia);
    const novedadesPositivas = delDia.filter((e) => e.tipo === "positivo").length;
    const novedadesNegativas = delDia.filter((e) => e.tipo === "negativo").length;
    return {
      dia,
      incidenciasSalud,
      novedadesPositivas,
      novedadesNegativas,
      total: incidenciasSalud + delDia.length,
    };
  });
}

/** Color del día en calendario según actividad de salud y novedades. */
export function colorDiaSeguimiento(
  incidenciasSalud: number,
  novedadesNegativas: number,
  novedadesPositivas: number,
): string | undefined {
  if (incidenciasSalud > 0 || novedadesNegativas > 0) return "#ef4444";
  if (novedadesPositivas > 0) return "#22c55e";
  return undefined;
}

export function marcasCalendarioSeguimiento(
  centroId: string,
  snapshots: SnapshotOcupacion[],
  eventos: EventoReporte[],
): Map<string, string> {
  const marcas = new Map<string, string>();
  const dias = new Set<string>([
    ...snapshots.filter((s) => s.centro_id === centroId).map((s) => s.dia),
    ...eventos.filter((e) => e.centro_id === centroId).map((e) => e.dia),
  ]);

  for (const dia of dias) {
    const snap = snapshots.find((s) => s.centro_id === centroId && s.dia === dia);
    const delDia = eventos.filter((e) => e.centro_id === centroId && e.dia === dia);
    const color = colorDiaSeguimiento(
      snap?.incidencias_salud ?? 0,
      delDia.filter((e) => e.tipo === "negativo").length,
      delDia.filter((e) => e.tipo === "positivo").length,
    );
    if (color) marcas.set(dia, color);
  }
  return marcas;
}

export function agruparEventosPorDia(eventos: EventoReporte[]): Map<string, EventoReporte[]> {
  const m = new Map<string, EventoReporte[]>();
  for (const evento of eventos) {
    const lista = m.get(evento.dia) ?? [];
    lista.push(evento);
    m.set(evento.dia, lista);
  }
  for (const [dia, lista] of m) {
    m.set(
      dia,
      [...lista].sort((a, b) => a.ts - b.ts || a.titulo.localeCompare(b.titulo, "es")),
    );
  }
  return m;
}

/** Severidad máxima del día para calendario de red (salud > negativo > positivo). */
export function colorDiaSeguimientoRed(
  casosSaludDia: number,
  negativas: number,
  positivas: number,
): string | undefined {
  return colorDiaSeguimiento(casosSaludDia, negativas, positivas);
}

export function severidadMaximaPorDiaSeguimiento(
  snapshots: SnapshotOcupacion[],
  eventos: EventoReporte[],
): Map<string, string> {
  const marcas = new Map<string, string>();
  const dias = new Set<string>([
    ...snapshots.map((s) => s.dia),
    ...eventos.map((e) => e.dia),
  ]);

  for (const dia of dias) {
    const incidenciasSalud = snapshots
      .filter((s) => s.dia === dia)
      .reduce((acc, s) => acc + (s.incidencias_salud ?? 0), 0);
    const delDia = eventos.filter((e) => e.dia === dia);
    const color = colorDiaSeguimiento(
      incidenciasSalud,
      delDia.filter((e) => e.tipo === "negativo").length,
      delDia.filter((e) => e.tipo === "positivo").length,
    );
    if (color) marcas.set(dia, color);
  }
  return marcas;
}

export function totalCasosSaludAbiertosRed(casos: CasoSaludCentro[]): number {
  return casosSaludPendientes(casos).length;
}

export function totalCasosSaludActivosRed(casos: CasoSaludCentro[]): number {
  return casos.filter((c) => c.estatus === "activo").length;
}

export { META_ESTATUS_CASO_SALUD, META_TIPO_EVENTO_REPORTE };
export type { CasoSaludCentro, EstatusCasoSalud, EventoReporte, TipoEventoReporte };

function restarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
