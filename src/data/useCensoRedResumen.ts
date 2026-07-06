// Hook para la vista interna /centros/censo-rapido: carga el resumen agregado
// de toda la red vía RPC censo_resumen_red() con refresh manual.

import { useCallback, useEffect, useState } from "react";
import { obtenerResumenCensoRed } from "./reposCenso";
import type { ResumenCensoCentro } from "@/domain/censoResumen";

export function useCensoRedResumen() {
  const [resumenes, setResumenes] = useState<ResumenCensoCentro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerResumenCensoRed();
      setResumenes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el censo");
      setResumenes([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { resumenes, cargando, error, refrescar };
}
