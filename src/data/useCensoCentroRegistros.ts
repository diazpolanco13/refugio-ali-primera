// Hook para /centros/censo-rapido/:centroId: listado de registrados vía RPC censo_listado.

import { useCallback, useEffect, useState } from "react";
import { listarRegistrosCenso, type RegistroCensoGuardado } from "./reposCenso";

export function useCensoCentroRegistros(centroId: string | undefined) {
  const [registros, setRegistros] = useState<RegistroCensoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    if (!centroId) {
      setRegistros([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const data = await listarRegistrosCenso(centroId);
      setRegistros(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el listado");
      setRegistros([]);
    } finally {
      setCargando(false);
    }
  }, [centroId]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { registros, cargando, error, refrescar };
}
