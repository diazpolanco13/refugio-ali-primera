import { useEffect, useState } from "react";

/** Punto de corte para "móvil" (coincide con el breakpoint `md` de Tailwind). */
const CONSULTA = "(max-width: 767px)";

/** Devuelve `true` en viewports de móvil y reacciona a cambios de tamaño. */
export function useEsMovil(): boolean {
  const [esMovil, setEsMovil] = useState(
    () => typeof window !== "undefined" && window.matchMedia(CONSULTA).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches);
    mq.addEventListener("change", handler);
    setEsMovil(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return esMovil;
}
