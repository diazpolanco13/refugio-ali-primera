/** Secciones de la ficha de un campamento (`?vista=…`). */

export const SECCIONES_FICHA_CENTRO = [
  { id: "resumen", label: "Resumen" },
  { id: "coordinacion", label: "Coordinación" },
  { id: "poblacion", label: "Población" },
  { id: "censo_rapido", label: "Censo" },
  { id: "reporte", label: "Reporte" },
  // El id se mantiene "incidencias" por compatibilidad con enlaces guardados.
  { id: "incidencias", label: "Seguimiento" },
  { id: "infraestructura", label: "Infraestructura" },
  { id: "buzon", label: "Buzón" },
] as const;

export type SeccionFichaCentro = (typeof SECCIONES_FICHA_CENTRO)[number]["id"];

export const ETIQUETAS_SECCION_FICHA: Record<SeccionFichaCentro, string> =
  Object.fromEntries(SECCIONES_FICHA_CENTRO.map((s) => [s.id, s.label])) as Record<
    SeccionFichaCentro,
    string
  >;

export function esSeccionFichaCentro(v: string | null): v is SeccionFichaCentro {
  return SECCIONES_FICHA_CENTRO.some((s) => s.id === v);
}

/** Compatibilidad con enlaces antiguos (`?vista=capacidad`). */
export function normalizarSeccionFichaCentro(v: string | null): SeccionFichaCentro {
  if (v === "capacidad") return "infraestructura";
  if (esSeccionFichaCentro(v)) return v;
  return "resumen";
}

export function esRutaReportesRed(pathname: string): boolean {
  return pathname === "/centros/reportes" || pathname.startsWith("/centros/reportes/");
}

export function esFichaCentroPathname(pathname: string): boolean {
  return /^\/centro\/[^/]+$/.test(pathname) && pathname !== "/centro/nuevo";
}

export function esReportesCentroPathname(pathname: string): boolean {
  return /^\/centros\/reportes\/[^/]+$/.test(pathname);
}

export function centroIdDePathname(pathname: string): string | null {
  const matchCentro = pathname.match(/^\/centro\/([^/]+)$/);
  if (matchCentro && matchCentro[1] !== "nuevo") return matchCentro[1];

  const matchReportes = pathname.match(/^\/centros\/reportes\/([^/]+)$/);
  if (matchReportes) return matchReportes[1];

  return null;
}

export function baseCentroEnRuta(pathname: string, centroId: string): string {
  if (esReportesCentroPathname(pathname) || pathname.startsWith("/centros/reportes/")) {
    return `/centros/reportes/${centroId}`;
  }
  return `/centro/${centroId}`;
}

export function rutaSeccionFichaCentro(
  pathname: string,
  centroId: string,
  seccion: SeccionFichaCentro,
): string {
  const base = baseCentroEnRuta(pathname, centroId);
  return seccion === "resumen" ? base : `${base}?vista=${seccion}`;
}

/** Base de rutas de secciones dentro del flujo de reportes diarios. */
export function baseReportesCentro(centroId: string): string {
  return `/centros/reportes/${centroId}`;
}

export function rutaSeccionReportesCentro(
  centroId: string,
  seccion: SeccionFichaCentro,
): string {
  const base = baseReportesCentro(centroId);
  return seccion === "resumen" ? base : `${base}?vista=${seccion}`;
}
