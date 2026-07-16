// Serie diaria del censo nominal (acumulado + KPIs por día).
// Fuente: creada_ts de alojamientos activos vs meta vigente del parte.

import { contrasteDesdeProgreso } from "@/domain/censoNominalRed";
import type { EstadoCensoNominalRed } from "@/domain/censoNominalRed";

export interface RegistroCensoTs {
  centro_id: string;
  creada_ts: number;
}

export interface MetaCentroCenso {
  centroId: string;
  metaRefugiados: number;
}

export interface PuntoSerieCensoNominal {
  dia: string;
  /** Acumulado de personas censadas al cierre del día. */
  censados: number;
  /** Altas netas ese día (solo altas: alojamientos activos). */
  nuevos: number;
  sinIniciar: number;
  enCurso: number;
  metaAlcanzada: number;
  discrepancias: number;
}

export interface VariacionKpisCenso {
  sinIniciar: number;
  enCurso: number;
  totalPersonas: number;
  metaAlcanzada: number;
  discrepancias: number;
}

/** YYYY-MM-DD en zona local del navegador (igual que `claveDia` de repos). */
export function claveDiaDeTs(ts: number): string {
  const d = new Date(ts);
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function rangoDiasInclusive(primero: string, ultimo: string): string[] {
  if (!primero || !ultimo || primero > ultimo) return [];
  const out: string[] = [];
  const cursor = new Date(`${primero}T12:00:00`);
  const fin = new Date(`${ultimo}T12:00:00`);
  while (cursor.getTime() <= fin.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function estadoDesdeConteo(
  registrados: number,
  meta: number,
): EstadoCensoNominalRed {
  const contraste = contrasteDesdeProgreso({
    metaRefugiados: meta,
    metaFamilias: 0,
    registradosRefugiados: registrados,
    registradosFamilias: 0,
    pctRefugiados: 0,
    pctFamilias: 0,
  });
  if (contraste === "excede_parte") return "discrepancia";
  if (contraste === "cuadra") return "meta_alcanzada";
  if (registrados <= 0) return "sin_iniciar";
  return "en_curso";
}

/**
 * Serie día a día: acumulado de censados + conteo de escuelas por estado.
 * La meta del parte se toma como vigente (snapshot actual) para clasificar.
 */
export function serieDiariaCensoNominal(
  registros: RegistroCensoTs[],
  metas: MetaCentroCenso[],
  hoyClave: string,
): PuntoSerieCensoNominal[] {
  if (metas.length === 0) return [];

  const porCentro = new Map<string, number[]>();
  for (const r of registros) {
    if (!r.creada_ts || r.creada_ts <= 0) continue;
    const lista = porCentro.get(r.centro_id) ?? [];
    lista.push(r.creada_ts);
    porCentro.set(r.centro_id, lista);
  }
  for (const lista of porCentro.values()) {
    lista.sort((a, b) => a - b);
  }

  let minDia = hoyClave;
  for (const lista of porCentro.values()) {
    if (lista.length === 0) continue;
    const dia = claveDiaDeTs(lista[0]);
    if (dia < minDia) minDia = dia;
  }

  const dias = rangoDiasInclusive(minDia, hoyClave);
  if (dias.length === 0) return [];

  const metaPorCentro = new Map(
    metas.map((m) => [m.centroId, Math.max(0, m.metaRefugiados)]),
  );
  const ids = metas.map((m) => m.centroId);
  const puntero = new Map<string, number>();
  for (const id of ids) puntero.set(id, 0);

  let prevCensados = 0;
  return dias.map((dia) => {
    let censados = 0;
    let sinIniciar = 0;
    let enCurso = 0;
    let metaAlcanzada = 0;
    let discrepancias = 0;

    for (const centroId of ids) {
      const lista = porCentro.get(centroId) ?? [];
      let n = puntero.get(centroId) ?? 0;
      while (n < lista.length && claveDiaDeTs(lista[n]) <= dia) n++;
      puntero.set(centroId, n);
      censados += n;

      const estado = estadoDesdeConteo(n, metaPorCentro.get(centroId) ?? 0);
      if (estado === "sin_iniciar") sinIniciar++;
      else if (estado === "en_curso") enCurso++;
      else if (estado === "meta_alcanzada") metaAlcanzada++;
      else discrepancias++;
    }

    const nuevos = censados - prevCensados;
    prevCensados = censados;
    return {
      dia,
      censados,
      nuevos,
      sinIniciar,
      enCurso,
      metaAlcanzada,
      discrepancias,
    };
  });
}

/** Delta del último día vs el anterior. Si solo hay 1 día, personas = nuevos. */
export function variacionKpisCenso(
  serie: PuntoSerieCensoNominal[],
): VariacionKpisCenso | null {
  if (serie.length === 0) return null;
  if (serie.length === 1) {
    const u = serie[0];
    return {
      sinIniciar: 0,
      enCurso: 0,
      totalPersonas: u.nuevos,
      metaAlcanzada: 0,
      discrepancias: 0,
    };
  }
  const prev = serie[serie.length - 2];
  const ult = serie[serie.length - 1];
  return {
    sinIniciar: ult.sinIniciar - prev.sinIniciar,
    enCurso: ult.enCurso - prev.enCurso,
    totalPersonas: ult.censados - prev.censados,
    metaAlcanzada: ult.metaAlcanzada - prev.metaAlcanzada,
    discrepancias: ult.discrepancias - prev.discrepancias,
  };
}
