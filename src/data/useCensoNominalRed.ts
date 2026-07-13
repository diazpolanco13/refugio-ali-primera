// Agrega progreso del censo nominal por campamento (Realtime vía hooks base).

import { useMemo } from "react";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQueryConEstado } from "@/data/useSupabaseQuery";
import {
  contrasteDesdeProgreso,
  type ResumenCensoNominalCentro,
} from "@/domain/censoNominalRed";
import {
  esCentroDePrueba,
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { ultimosPartesPorCentro } from "@/domain/parteActualCentros";
import {
  alojamientosActivos,
  contarFamiliasActivas,
  grupoEtarioRefugiado,
  progresoCensoNominal,
} from "@/domain/refugiados";
import { tieneEnfermedadNominal } from "@/features/censo/metricasDemograficasNominal";

export function useCensoNominalRed(): {
  resumenes: ResumenCensoNominalCentro[];
  cargando: boolean;
} {
  const { alojamientos, cargando: cargandoAloj } = useRefugiadosRed();
  const snapshots = useOcupacionesCentros();

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const { datos: filasCentros, cargando: cargandoCentros } =
    useSupabaseQueryConEstado<CentroFila, FilaSync<CentroTransitorio>>(
      "centros",
      {
        transform: desenvolver as (
          raw: FilaSync<CentroTransitorio>,
        ) => CentroFila,
        clientFilter: (c) => !c.deleted && !esCentroDePrueba(c),
      },
    );

  const centros = useMemo(
    () =>
      [...filasCentros]
        .map((c) => normalizarCentro(c))
        .sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );

  const resumenes = useMemo((): ResumenCensoNominalCentro[] => {
    const partes = ultimosPartesPorCentro(snapshots);
    const porCentro = new Map<string, typeof alojamientos>();

    for (const a of alojamientosActivos(alojamientos)) {
      const lista = porCentro.get(a.centro_id) ?? [];
      lista.push(a);
      porCentro.set(a.centro_id, lista);
    }

    return centros.map((centro) => {
      const activos = porCentro.get(centro.id) ?? [];
      const snap = partes.get(centro.id) ?? null;
      const metaRefugiados = Math.max(
        poblacionCentro(centro),
        Math.max(0, snap?.total_afectados ?? 0),
      );
      const metaFamilias = Math.max(
        centro.familias_ocupadas ?? 0,
        Math.max(0, snap?.familias ?? 0),
      );
      const progreso = progresoCensoNominal(
        { refugiados: metaRefugiados, familias: metaFamilias },
        {
          refugiados: activos.length,
          familias: contarFamiliasActivas(activos),
        },
      );

      let embarazadas = 0;
      let discapacidad = 0;
      let adultosMayores = 0;
      let conEnfermedad = 0;
      let mujeres = 0;
      let hombres = 0;
      let menores = 0;
      let ultimoRegistroTs = 0;

      for (const a of activos) {
        ultimoRegistroTs = Math.max(ultimoRegistroTs, a.creada_ts || 0);
        const r = a.refugiado;
        if (r.sexo === "F") mujeres++;
        else if (r.sexo === "M") hombres++;
        if (r.vulnerabilidades?.embarazada) embarazadas++;
        if (r.vulnerabilidades?.discapacidad) discapacidad++;
        if (tieneEnfermedadNominal(a)) conEnfermedad++;
        const grupo = grupoEtarioRefugiado(r.fecha_nacimiento);
        if (grupo === "adulto_mayor") adultosMayores++;
        if (
          grupo === "menor5" ||
          grupo === "ninez" ||
          grupo === "adolescente"
        ) {
          menores++;
        }
      }

      return {
        centroId: centro.id,
        centroNombre: centro.nombre || centro.id,
        nro: centro.nro ?? null,
        registrados: progreso.registradosRefugiados,
        familias: progreso.registradosFamilias,
        metaRefugiados: progreso.metaRefugiados,
        metaFamilias: progreso.metaFamilias,
        pctRefugiados: progreso.pctRefugiados,
        pctFamilias: progreso.pctFamilias,
        parteDia: snap?.dia ?? null,
        ultimoRegistroTs,
        contraste: contrasteDesdeProgreso(progreso),
        embarazadas,
        discapacidad,
        adultosMayores,
        conEnfermedad,
        mujeres,
        hombres,
        menores,
      };
    });
  }, [alojamientos, centros, snapshots]);

  return {
    resumenes,
    cargando: cargandoAloj || cargandoCentros,
  };
}
