// Íconos de estado del reporte diario:
// Casos de Salud, Novedades Diarias, estatus del censo nominal, Parte Diario Completado.
// Vista presentacional + cálculo puro + hook por centro + hook de red (lista).

import { useMemo } from "react";
import {
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  Stethoscope,
} from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { useCensoNominalRed } from "@/data/useCensoNominalRed";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useReportesCentros } from "@/data/useReportesCentros";
import {
  contrasteDesdeProgreso,
  estadoCensoNominalRed,
  type EstadoCensoNominalRed,
  type ResumenCensoNominalCentro,
} from "@/domain/censoNominalRed";
import {
  eventosRevisados,
  reporteDelDia,
  type ReporteDiario,
} from "@/domain/reporteDiario";
import type { CasoSaludCentro } from "@/domain/casosSalud";
import { casosSaludPendientes } from "@/domain/seguimientoReportes";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import {
  alojamientosActivos,
  contarFamiliasActivas,
  progresoCensoNominal,
} from "@/domain/refugiados";
import { cn } from "@/lib/utils";

const META_CENSO: Record<
  EstadoCensoNominalRed,
  { label: string; clase: string }
> = {
  sin_iniciar: {
    label: "Registro sin iniciar",
    clase: "text-muted-foreground",
  },
  en_curso: {
    label: "Registro en curso",
    clase: "text-sky-400",
  },
  meta_alcanzada: {
    label: "Registro cuadra con el parte",
    clase: "text-emerald-400",
  },
  discrepancia: {
    label: "Registro con discrepancia vs parte",
    clase: "text-red-400",
  },
};

export interface EstadoIconosReporteDia {
  tituloSalud: string;
  claseSalud: string;
  tituloNovedades: string;
  claseNovedades: string;
  tituloCenso: string;
  claseCenso: string;
  tituloParte: string;
  claseParte: string;
  /** Algún bloque pendiente o con alerta (salud activa, etc.). */
  tienePendiente: boolean;
}

export function calcularEstadoIconosReporteDia(input: {
  reporte: ReporteDiario | undefined;
  parteOk: boolean;
  casosActivos: number;
  estadoCenso: EstadoCensoNominalRed;
}): EstadoIconosReporteDia {
  const { reporte, parteOk, casosActivos, estadoCenso } = input;
  const saludReportada = reporte?.salud_reportada === true;
  const novedadesOk = eventosRevisados(reporte);
  const metaCenso = META_CENSO[estadoCenso];

  let tituloSalud = "Casos de salud · sin reportar";
  let claseSalud = "text-muted-foreground";
  if (casosActivos > 0) {
    tituloSalud = `Casos de salud · ${casosActivos} activo${casosActivos === 1 ? "" : "s"}`;
    claseSalud = "text-rose-400";
  } else if (saludReportada) {
    tituloSalud = "Casos de salud · reportado";
    claseSalud = "text-emerald-400";
  }

  const tituloNovedades = novedadesOk
    ? "Novedades diarias · revisadas"
    : "Novedades diarias · pendientes";
  const claseNovedades = novedadesOk ? "text-emerald-400" : "text-muted-foreground";

  const tituloParte = parteOk
    ? "Parte diario · completado"
    : "Parte diario · pendiente";
  const claseParte = parteOk ? "text-emerald-400" : "text-muted-foreground";

  const censoOk = estadoCenso === "meta_alcanzada";
  const saludOk = casosActivos === 0 && saludReportada;
  const tienePendiente = !parteOk || !novedadesOk || !saludOk || !censoOk;

  return {
    tituloSalud,
    claseSalud,
    tituloNovedades,
    claseNovedades,
    tituloCenso: metaCenso.label,
    claseCenso: metaCenso.clase,
    tituloParte,
    claseParte,
    tienePendiente,
  };
}

export const ESTADO_ICONOS_VACIO = calcularEstadoIconosReporteDia({
  reporte: undefined,
  parteOk: false,
  casosActivos: 0,
  estadoCenso: "sin_iniciar",
});

function IconoEstado({
  titulo,
  clase,
  children,
}: {
  titulo: string;
  clase: string;
  children: React.ReactNode;
}) {
  return (
    <span title={titulo} className={cn("inline-flex", clase)} aria-label={titulo}>
      {children}
    </span>
  );
}

/** Solo pinta los 4 íconos a partir de un estado ya calculado. */
export function IconosEstadoReporteDiaView({
  estado,
  className,
  tamano = "size-3.5",
}: {
  estado: EstadoIconosReporteDia;
  className?: string;
  tamano?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center gap-1", className)}
      aria-label="Estado del reporte diario"
    >
      <IconoEstado titulo={estado.tituloSalud} clase={estado.claseSalud}>
        <Stethoscope className={tamano} />
      </IconoEstado>
      <IconoEstado titulo={estado.tituloNovedades} clase={estado.claseNovedades}>
        <CalendarPlus className={tamano} />
      </IconoEstado>
      <IconoEstado titulo={estado.tituloCenso} clase={estado.claseCenso}>
        <ClipboardList className={tamano} />
      </IconoEstado>
      <IconoEstado titulo={estado.tituloParte} clase={estado.claseParte}>
        <ClipboardCheck className={tamano} />
      </IconoEstado>
    </span>
  );
}

/** Un centro (popup mapa): carga hooks propios. */
export function IconosEstadoReporteDia({
  centroId,
  metaRefugiados = 0,
  metaFamilias = 0,
  className,
  tamano = "size-3.5",
}: {
  centroId: string;
  /** Meta del parte (damnificados del centro). */
  metaRefugiados?: number;
  metaFamilias?: number;
  className?: string;
  tamano?: string;
}) {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const reportes = useReportesCentros({ centroId, dia: hoy });
  const snapshots = useOcupacionesCentros({ centroId, desde: hoy });
  const { casos } = useCasosSaludCentros({ centroId, soloActivos: true });
  const { alojamientos } = useAlojamientosCentro({ centroId, estado: "activo" });

  const estado = useMemo(() => {
    const reporte = reporteDelDia(reportes, centroId, hoy);
    const parteOk = snapshots.some((s) => s.dia === hoy);
    const casosActivos = casosSaludPendientes(casos).length;
    const activos = alojamientosActivos(alojamientos);
    const progreso = progresoCensoNominal(
      { refugiados: metaRefugiados, familias: metaFamilias },
      {
        refugiados: activos.length,
        familias: contarFamiliasActivas(activos),
      },
    );
    const estadoCenso = estadoCensoNominalRed({
      centroId,
      centroNombre: "",
      nro: null,
      unidadSebin: "",
      registrados: progreso.registradosRefugiados,
      familias: progreso.registradosFamilias,
      metaRefugiados: progreso.metaRefugiados,
      metaFamilias: progreso.metaFamilias,
      pctRefugiados: progreso.pctRefugiados,
      pctFamilias: progreso.pctFamilias,
      parteDia: null,
      ultimoRegistroTs: 0,
      contraste: contrasteDesdeProgreso(progreso),
      embarazadas: 0,
      discapacidad: 0,
      adultosMayores: 0,
      conEnfermedad: 0,
      mujeres: 0,
      hombres: 0,
      menores: 0,
    });
    return calcularEstadoIconosReporteDia({
      reporte,
      parteOk,
      casosActivos,
      estadoCenso,
    });
  }, [
    reportes,
    snapshots,
    casos,
    alojamientos,
    centroId,
    hoy,
    metaRefugiados,
    metaFamilias,
  ]);

  return (
    <IconosEstadoReporteDiaView estado={estado} className={className} tamano={tamano} />
  );
}

/**
 * Carga una sola vez datos del día para toda la red y arma un mapa
 * centroId → estado de íconos (para el panel lateral).
 * Censo = nominal (en curso), no censo rápido.
 */
export function useMapaEstadosIconosReporteDia(
  centroIds: readonly string[],
): Map<string, EstadoIconosReporteDia> {
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const reportes = useReportesCentros({ dia: hoy });
  const snapshots = useOcupacionesCentros({ desde: hoy });
  const { casos } = useCasosSaludCentros({ soloActivos: true });
  const { resumenes } = useCensoNominalRed();

  return useMemo(() => {
    const reportesPorCentro = new Map<string, ReporteDiario>();
    for (const r of reportes) {
      if (r.dia === hoy) reportesPorCentro.set(r.centro_id, r);
    }

    const snapsHoy = new Set<string>();
    for (const s of snapshots as SnapshotOcupacion[]) {
      if (s.dia === hoy) snapsHoy.add(s.centro_id);
    }

    const casosPorCentro = new Map<string, CasoSaludCentro[]>();
    for (const c of casos) {
      const lista = casosPorCentro.get(c.centro_id);
      if (lista) lista.push(c);
      else casosPorCentro.set(c.centro_id, [c]);
    }

    const resumenPorCentro = new Map<string, ResumenCensoNominalCentro>();
    for (const r of resumenes) resumenPorCentro.set(r.centroId, r);

    const out = new Map<string, EstadoIconosReporteDia>();
    for (const id of centroIds) {
      const casosCentro = casosPorCentro.get(id) ?? [];
      const resumen = resumenPorCentro.get(id);
      out.set(
        id,
        calcularEstadoIconosReporteDia({
          reporte: reportesPorCentro.get(id),
          parteOk: snapsHoy.has(id),
          casosActivos: casosSaludPendientes(casosCentro).length,
          estadoCenso: resumen ? estadoCensoNominalRed(resumen) : "sin_iniciar",
        }),
      );
    }
    return out;
  }, [centroIds, reportes, snapshots, casos, resumenes, hoy]);
}
