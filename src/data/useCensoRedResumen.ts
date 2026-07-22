// Hook para la vista interna /centros/censo: carga el resumen agregado
// de toda la red vía RPC censo_resumen_red() con refresh manual.

import { useCallback, useEffect, useState } from "react";
import {
  obtenerResumenCensoRed,
  obtenerResumenSiipol,
  type ResumenSiipol,
} from "./reposCenso";
import type { ResumenCensoCentro } from "@/domain/censoResumen";

export function useCensoRedResumen() {
  const [resumenes, setResumenes] = useState<ResumenCensoCentro[]>([]);
  const [siipol, setSiipol] = useState<ResumenSiipol>({
    totalImportados: 0,
    verificados: 0,
    pendientes: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [data, resumenSiipol] = await Promise.all([
        obtenerResumenCensoRed(),
        obtenerResumenSiipol(),
      ]);
      setResumenes(data);
      setSiipol(resumenSiipol);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el registro");
      setResumenes([]);
      setSiipol({ totalImportados: 0, verificados: 0, pendientes: 0 });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { resumenes, siipol, cargando, error, refrescar };
}
