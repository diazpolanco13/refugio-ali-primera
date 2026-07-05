import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface MapaCentrosContextValue {
  panelCentrosAbierto: boolean;
  setPanelCentrosAbierto: (open: boolean) => void;
  abrirListaCentros: () => void;
}

const MapaCentrosContext = createContext<MapaCentrosContextValue | null>(null);

/** Estado compartido entre AppShell, AppSidebar y la vista mapa de centros. */
export function MapaCentrosProvider({ children }: { children: ReactNode }) {
  const [panelCentrosAbierto, setPanelCentrosAbiertoRaw] = useState(false);

  const setPanelCentrosAbierto = useCallback((open: boolean) => {
    setPanelCentrosAbiertoRaw(open);
  }, []);

  const abrirListaCentros = useCallback(() => {
    setPanelCentrosAbiertoRaw(true);
  }, []);

  const value = useMemo(
    () => ({
      panelCentrosAbierto,
      setPanelCentrosAbierto,
      abrirListaCentros,
    }),
    [panelCentrosAbierto, setPanelCentrosAbierto, abrirListaCentros],
  );

  return (
    <MapaCentrosContext.Provider value={value}>{children}</MapaCentrosContext.Provider>
  );
}

export function useMapaCentros(): MapaCentrosContextValue {
  const ctx = useContext(MapaCentrosContext);
  if (!ctx) {
    throw new Error("useMapaCentros debe usarse dentro de MapaCentrosProvider");
  }
  return ctx;
}

/** Versión opcional para componentes que pueden renderizarse fuera del mapa. */
export function useMapaCentrosOptional(): MapaCentrosContextValue | null {
  return useContext(MapaCentrosContext);
}
