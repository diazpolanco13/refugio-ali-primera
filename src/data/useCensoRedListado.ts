import { useCallback, useEffect, useState } from "react";
import { obtenerListadoCensoRed, type RegistroCensoRed } from "./reposCenso";

export function useCensoRedListado() {
  const [registros, setRegistros] = useState<RegistroCensoRed[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerListadoCensoRed();
      setRegistros(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el listado");
      setRegistros([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  return { registros, cargando, error, refrescar };
}
