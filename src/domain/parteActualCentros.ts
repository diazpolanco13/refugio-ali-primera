import {
  normalizarCentro,
  normalizarPersonal,
  PERSONAL_VACIO,
  MAX_PERSONAL_CATEGORIA,
  totalPersonalOperativo,
  type CentroTransitorio,
  type PersonalCentro,
} from "./centrosTransitorios";
import type { SnapshotOcupacion } from "./serieOcupacionCentros";
import { normalizarVulnerables, totalPoblacion, type Vulnerables } from "./tipos";

type SnapshotConMeta = SnapshotOcupacion & {
  updated_at?: number;
  updated_by?: string | null;
};

function snapshotMasReciente(
  actual: SnapshotOcupacion | undefined,
  candidato: SnapshotOcupacion,
): SnapshotOcupacion {
  if (!actual) return candidato;
  if (candidato.dia > actual.dia) return candidato;
  if (candidato.dia < actual.dia) return actual;
  return (candidato.ts ?? 0) >= (actual.ts ?? 0) ? candidato : actual;
}

/** Último parte numérico disponible por campamento, opcionalmente hasta un día máximo. */
export function ultimosPartesPorCentro(
  snapshots: SnapshotOcupacion[],
  diaMax?: string,
): Map<string, SnapshotOcupacion> {
  const porCentro = new Map<string, SnapshotOcupacion>();
  for (const snapshot of snapshots) {
    if (diaMax && snapshot.dia > diaMax) continue;
    porCentro.set(
      snapshot.centro_id,
      snapshotMasReciente(porCentro.get(snapshot.centro_id), snapshot),
    );
  }
  return porCentro;
}

function personalConTotal(
  personal: Partial<PersonalCentro> | null | undefined,
  total: number,
): PersonalCentro {
  const normalizado = normalizarPersonal(personal);
  const totalBase = totalPersonalOperativo(normalizado);
  // Totales absurdos (dato corrupto en el snapshot) no deben reescribir el desglose.
  const objetivoRaw = Math.max(0, Math.floor(Number(total) || 0));
  const objetivo =
    objetivoRaw > MAX_PERSONAL_CATEGORIA * 7 ? totalBase : objetivoRaw;
  if (objetivo === 0 && totalBase > 0) return normalizado;
  if (totalBase === objetivo) return normalizado;
  if (objetivo === 0) return { ...PERSONAL_VACIO };

  const noFuncionarios =
    normalizado.trabajadores +
    normalizado.medicos +
    normalizado.psicologos +
    normalizado.justicia_tjs +
    normalizado.justicia_mp +
    normalizado.justicia_defensoria;

  if (objetivo >= noFuncionarios) {
    return {
      ...normalizado,
      funcionarios: objetivo - noFuncionarios,
    };
  }

  // El histórico solo guarda el total; si el desglose viejo supera ese total,
  // colapsamos a funcionarios para no mostrar un total incorrecto.
  return { ...PERSONAL_VACIO, funcionarios: objetivo };
}

/**
 * Alinea el desglose etario al total reportado del parte.
 * Si el censo y el total no cuadran (p. ej. ajustes históricos que solo
 * tocaron `total_afectados`), la diferencia se absorbe en `adultos_h`.
 */
export function ocupacionAlineadaAlTotal(
  ocupacion: Partial<Vulnerables> | null | undefined,
  total: number,
): Vulnerables {
  const normalizada = normalizarVulnerables(ocupacion);
  const desglose = totalPoblacion(normalizada);
  const objetivo = Math.max(0, Number(total) || 0);
  if (objetivo === 0 || desglose === objetivo) return normalizada;
  if (desglose === 0) return normalizada;

  // El cierre del parte manda sobre el levantamiento. Si el desglose vino
  // incompleto, cuadramos la diferencia en adultos_h como hacía el sync manual.
  return {
    ...normalizada,
    adultos_h: Math.max(0, normalizada.adultos_h + (objetivo - desglose)),
  };
}

/** Centro base actualizado con el último parte diario disponible. */
export function aplicarParteActualACentro(
  centro: CentroTransitorio,
  snapshot?: SnapshotOcupacion,
): CentroTransitorio {
  if (!snapshot) return centro;
  const base = normalizarCentro(centro);
  const meta = snapshot as SnapshotConMeta;
  return {
    ...centro,
    total_afectados: snapshot.total_afectados ?? base.total_afectados,
    familias_ocupadas: snapshot.familias ?? base.familias_ocupadas,
    ocupacion: ocupacionAlineadaAlTotal(
      snapshot.ocupacion ?? base.ocupacion,
      snapshot.total_afectados ?? base.total_afectados,
    ),
    personal: personalConTotal(base.personal, snapshot.personal_total ?? totalPersonalOperativo(base.personal)),
    updated_at: meta.updated_at ?? snapshot.ts ?? centro.updated_at,
    updated_by: meta.updated_by ?? centro.updated_by,
  };
}

/** Aplica a cada centro su último parte disponible; si no tiene histórico, queda igual. */
export function aplicarPartesActualesACentros<T extends CentroTransitorio>(
  centros: T[],
  snapshots: SnapshotOcupacion[],
  diaMax?: string,
): T[] {
  const porCentro = ultimosPartesPorCentro(snapshots, diaMax);
  return centros.map((centro) =>
    aplicarParteActualACentro(centro, porCentro.get(centro.id)) as T,
  );
}
