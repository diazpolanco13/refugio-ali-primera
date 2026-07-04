import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface MapaCentrosContextValue {
  menuDrawerOpen: boolean;
  setMenuDrawerOpen: (open: boolean) => void;
  panelCentrosAbierto: boolean;
  setPanelCentrosAbierto: (open: boolean) => void;
  abrirListaCentros: () => void;
  abrirNuevoCentro: () => void;
  registrarAbrirNuevoCentro: (fn: (() => void) | null) => void;
}

const MapaCentrosContext = createContext<MapaCentrosContextValue | null>(null);

/** Estado compartido entre AppShell, AppSidebar y la vista mapa de centros. */
export function MapaCentrosProvider({ children }: { children: ReactNode }) {
  const [menuDrawerOpen, setMenuDrawerOpenRaw] = useState(false);
  const [panelCentrosAbierto, setPanelCentrosAbiertoRaw] = useState(false);
  const abrirNuevoCentroRef = useRef<(() => void) | null>(null);

  const setMenuDrawerOpen = useCallback((open: boolean) => {
    setMenuDrawerOpenRaw(open);
    if (open) setPanelCentrosAbiertoRaw(false);
  }, []);

  const setPanelCentrosAbierto = useCallback((open: boolean) => {
    setPanelCentrosAbiertoRaw(open);
    if (open) setMenuDrawerOpenRaw(false);
  }, []);

  const abrirListaCentros = useCallback(() => {
    setMenuDrawerOpenRaw(false);
    setPanelCentrosAbiertoRaw(true);
  }, []);

  const registrarAbrirNuevoCentro = useCallback((fn: (() => void) | null) => {
    abrirNuevoCentroRef.current = fn;
  }, []);

  const abrirNuevoCentro = useCallback(() => {
    setMenuDrawerOpenRaw(false);
    abrirNuevoCentroRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      menuDrawerOpen,
      setMenuDrawerOpen,
      panelCentrosAbierto,
      setPanelCentrosAbierto,
      abrirListaCentros,
      abrirNuevoCentro,
      registrarAbrirNuevoCentro,
    }),
    [
      menuDrawerOpen,
      setMenuDrawerOpen,
      panelCentrosAbierto,
      setPanelCentrosAbierto,
      abrirListaCentros,
      abrirNuevoCentro,
      registrarAbrirNuevoCentro,
    ],
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
