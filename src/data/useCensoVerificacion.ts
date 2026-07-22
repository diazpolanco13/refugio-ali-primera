// Hook para /centros/censo/verificacion: agregados Nexus/SIIPOL por campamento
// (solo origen=import_excel) vía RPC censo_verificacion_por_centro.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  obtenerVerificacionPorCentro,
  type VerificacionCensoCentro,
} from "./reposCenso";

export interface TotalesVerificacionCenso {
  campamentos: number;
  campamentosConLista: number;
  campamentosSinLista: number;
  censadas: number;
  menores: number;
  adultos: number;
  nexus: number;
  siipol: number;
  ambos: number;
  soloNexus: number;
  soloSiipol: number;
  verificadas: number;
  faltan: number;
  solicitadas: number;
  conRegistro: number;
  campamentosConSolicitadas: number;
  campamentosConRegistro: number;
}

function sumarTotales(filas: VerificacionCensoCentro[]): TotalesVerificacionCenso {
  const totales: TotalesVerificacionCenso = {
    campamentos: filas.length,
    campamentosConLista: 0,
    campamentosSinLista: 0,
    censadas: 0,
    menores: 0,
    adultos: 0,
    nexus: 0,
    siipol: 0,
    ambos: 0,
    soloNexus: 0,
    soloSiipol: 0,
    verificadas: 0,
    faltan: 0,
    solicitadas: 0,
    conRegistro: 0,
    campamentosConSolicitadas: 0,
    campamentosConRegistro: 0,
  };

  for (const f of filas) {
    if (f.censadas > 0) totales.campamentosConLista += 1;
    else totales.campamentosSinLista += 1;
    totales.censadas += f.censadas;
    totales.menores += f.menores;
    totales.adultos += f.adultos;
    totales.nexus += f.nexus;
    totales.siipol += f.siipol;
    totales.ambos += f.ambos;
    totales.soloNexus += f.soloNexus;
    totales.soloSiipol += f.soloSiipol;
    totales.verificadas += f.verificadas;
    totales.faltan += f.faltan;
    totales.solicitadas += f.solicitadas;
    totales.conRegistro += f.conRegistro;
    if (f.solicitadas > 0) totales.campamentosConSolicitadas += 1;
    if (f.conRegistro > 0) totales.campamentosConRegistro += 1;
  }

  return totales;
}

export function useCensoVerificacion(enabled = true) {
  const [filas, setFilas] = useState<VerificacionCensoCentro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!enabled) {
      setFilas([]);
      setCargando(false);
      setError(null);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerVerificacionPorCentro();
      setFilas(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar la verificación",
      );
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  const totales = useMemo(() => sumarTotales(filas), [filas]);

  return { filas, totales, cargando, error, refrescar };
}
