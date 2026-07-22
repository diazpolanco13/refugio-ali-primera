// Agrega progreso del censo nominal por campamento (Realtime vía hooks base).

import { useMemo } from "react";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { claveDia } from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQueryConEstado } from "@/data/useSupabaseQuery";
import {
  contrasteDesdeProgreso,
  type ResumenCensoNominalCentro,
} from "@/domain/censoNominalRed";
import {
  COMPLEJO_GRAN_COLOMBIA,
  IDS_COMPLEJO_GRAN_COLOMBIA,
} from "@/domain/complejosCentros";
import {
  esCentroDePrueba,
  metaUnidadSebinCentro,
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
import {
  serieDiariaCensoNominal,
  variacionKpisCenso,
  type PuntoSerieCensoNominal,
  type VariacionKpisCenso,
} from "@/domain/serieCensoNominal";

export function useCensoNominalRed(): {
  resumenes: ResumenCensoNominalCentro[];
  serieDiaria: PuntoSerieCensoNominal[];
  variacion: VariacionKpisCenso | null;
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

      let adultosMayores = 0;
      let mujeres = 0;
      let hombres = 0;
      let menores = 0;
      let ultimoRegistroTs = 0;

      for (const a of activos) {
        ultimoRegistroTs = Math.max(ultimoRegistroTs, a.creada_ts || 0);
        const r = a.refugiado;
        if (r.sexo === "F") mujeres++;
        else if (r.sexo === "M") hombres++;
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

      const esGranColombia = (IDS_COMPLEJO_GRAN_COLOMBIA as readonly string[]).includes(
        centro.id,
      );
      const complejoId =
        centro.complejoId?.trim() ||
        (esGranColombia ? COMPLEJO_GRAN_COLOMBIA : null);
      const metaUnidad = metaUnidadSebinCentro(centro);

      return {
        centroId: centro.id,
        centroNombre: centro.nombre || centro.id,
        nro: centro.nro ?? null,
        complejoId,
        unidadSebin:
          metaUnidad.clave !== "sin_asignar" ? metaUnidad.label : "",
        registrados: progreso.registradosRefugiados,
        familias: progreso.registradosFamilias,
        metaRefugiados: progreso.metaRefugiados,
        metaFamilias: progreso.metaFamilias,
        pctRefugiados: progreso.pctRefugiados,
        pctFamilias: progreso.pctFamilias,
        parteDia: snap?.dia ?? null,
        ultimoRegistroTs,
        contraste: contrasteDesdeProgreso(progreso),
        adultosMayores,
        mujeres,
        hombres,
        menores,
      };
    });
  }, [alojamientos, centros, snapshots]);

  const { serieDiaria, variacion } = useMemo(() => {
    const activos = alojamientosActivos(alojamientos);
    const hoyClave = claveDia(Date.now());
    const serie = serieDiariaCensoNominal(
      activos.map((a) => ({
        centro_id: a.centro_id,
        creada_ts: a.creada_ts || 0,
      })),
      resumenes.map((r) => ({
        centroId: r.centroId,
        metaRefugiados: r.metaRefugiados,
      })),
      hoyClave,
    );
    return { serieDiaria: serie, variacion: variacionKpisCenso(serie) };
  }, [alojamientos, resumenes]);

  return {
    resumenes,
    serieDiaria,
    variacion,
    cargando: cargandoAloj || cargandoCentros,
  };
}
