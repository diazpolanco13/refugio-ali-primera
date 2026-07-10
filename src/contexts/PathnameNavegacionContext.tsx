import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";

interface PathnameNavegacionValue {
  /** Pathname visible en menú/migas: destino pendiente o ruta comprometida. */
  pathname: string;
  search: string;
  /** Llamar en onClick de Links del menú para feedback inmediato. */
  marcarNavegacion: (to: string) => void;
}

const PathnameNavegacionContext = createContext<PathnameNavegacionValue | null>(
  null,
);

function parseTo(to: string): { pathname: string; search: string } {
  try {
    const url = new URL(to, window.location.origin);
    return { pathname: url.pathname, search: url.search };
  } catch {
    const [pathPart, searchPart] = to.split("?");
    return {
      pathname: pathPart || "/",
      search: searchPart != null ? `?${searchPart}` : "",
    };
  }
}

/**
 * React Router 7 navega dentro de `startTransition`: con Suspense/lazy la
 * `location` no se actualiza hasta que el chunk resuelve, y el menú parece
 * “pegado”. Este provider expone un pathname optimista al hacer clic.
 */
export function PathnameNavegacionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [pendiente, setPendiente] = useState<{
    pathname: string;
    search: string;
  } | null>(null);

  useEffect(() => {
    setPendiente(null);
  }, [location.pathname, location.search]);

  const marcarNavegacion = useCallback(
    (to: string) => {
      const next = parseTo(to);
      if (
        next.pathname !== location.pathname ||
        next.search !== location.search
      ) {
        setPendiente(next);
      }
    },
    [location.pathname, location.search],
  );

  const value = useMemo(
    () => ({
      pathname: pendiente?.pathname ?? location.pathname,
      search: pendiente?.search ?? location.search,
      marcarNavegacion,
    }),
    [pendiente, location.pathname, location.search, marcarNavegacion],
  );

  return (
    <PathnameNavegacionContext.Provider value={value}>
      {children}
    </PathnameNavegacionContext.Provider>
  );
}

/** Pathname para UI de navegación (optimista si hay clic pendiente). */
export function usePathnameNavegacion(): PathnameNavegacionValue {
  const ctx = useContext(PathnameNavegacionContext);
  const location = useLocation();
  if (!ctx) {
    return {
      pathname: location.pathname,
      search: location.search,
      marcarNavegacion: () => {},
    };
  }
  return ctx;
}
