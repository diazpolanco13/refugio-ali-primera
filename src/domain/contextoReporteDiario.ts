// Helper de herencia al abrir el reporte diario de hoy.

import type { CasoSaludCentro } from "./casosSalud";
import { casosAbiertosSeguimiento, casosSaludActivos } from "./casosSalud";
import {
  CONTROL_VACIO,
  normalizarReporteControlDia,
  reporteControlDelDia,
  type ReporteControlDia,
} from "./controlReporte";
import { claveDiaAnterior } from "./antiguedadSeguimiento";
import { requerimientosActivos, type RequerimientoSeguimiento } from "./requerimientosSeguimiento";
import { trabajosActivos, type TrabajoCentro } from "./reparaciones";
import type { SnapshotOcupacion } from "./serieOcupacionCentros";

export interface ContextoReporteHoy {
  /** Control heredado de ayer si hoy no está guardado. */
  controlBorrador: Omit<ReporteControlDia, "id">;
  controlHeredadoDeAyer: boolean;
  /** Ítems vivos (no archivados). */
  trabajos: TrabajoCentro[];
  requerimientos: RequerimientoSeguimiento[];
  casosSalud: CasoSaludCentro[];
  /** Contador manual del parte; 0 si hoy no confirmado. */
  incidenciasSalud: number;
  parteConfirmadoHoy: boolean;
}

export function construirContextoReporteHoy(opts: {
  centroId: string;
  hoyClave: string;
  snapshots: SnapshotOcupacion[];
  controles: ReporteControlDia[];
  trabajos: TrabajoCentro[];
  requerimientos: RequerimientoSeguimiento[];
  casosSalud: CasoSaludCentro[];
}): ContextoReporteHoy {
  const {
    centroId,
    hoyClave,
    snapshots,
    controles,
    trabajos,
    requerimientos,
    casosSalud,
  } = opts;

  const ayer = claveDiaAnterior(hoyClave);
  const controlHoy = reporteControlDelDia(controles, centroId, hoyClave);
  const controlAyer = reporteControlDelDia(controles, centroId, ayer);

  let controlBorrador: Omit<ReporteControlDia, "id">;
  let controlHeredadoDeAyer = false;

  if (controlHoy) {
    controlBorrador = { ...controlHoy };
  } else if (controlAyer) {
    const base = normalizarReporteControlDia(controlAyer);
    controlBorrador = {
      ...base,
      dia: hoyClave,
      revisado: false,
      updated_at: 0,
      updated_by: "",
    };
    controlHeredadoDeAyer = true;
  } else {
    controlBorrador = {
      ...CONTROL_VACIO,
      centro_id: centroId,
      dia: hoyClave,
    };
  }

  const snapHoy = snapshots.find((s) => s.centro_id === centroId && s.dia === hoyClave);
  const parteConfirmadoHoy = Boolean(snapHoy);

  const casosCentro = casosSaludActivos(casosSalud.filter((c) => c.centro_id === centroId));
  const abiertosSeguimiento = casosAbiertosSeguimiento(casosCentro).length;

  return {
    controlBorrador,
    controlHeredadoDeAyer,
    trabajos: trabajosActivos(trabajos.filter((t) => t.centro_id === centroId)),
    requerimientos: requerimientosActivos(
      requerimientos.filter((r) => r.centro_id === centroId),
    ),
    casosSalud: casosCentro,
    incidenciasSalud: snapHoy?.incidencias_salud ?? abiertosSeguimiento,
    parteConfirmadoHoy,
  };
}
