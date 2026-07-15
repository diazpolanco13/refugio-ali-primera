import {
  BASES_DISPONIBLES,
  ESTILO_DARK_MATTER_URL,
  type BaseMapa,
} from "@/map/estiloMapa";

/** Bases que pegan a basemaps.cartocdn.com (estilo o raster). */
const BASES_CARTO: ReadonlySet<BaseMapa> = new Set([
  "dark-matter",
  "calles-claro",
  "positron",
]);

/** Preferido si Carto no responde (Esri, otro dominio). */
export const BASE_FALLBACK_SIN_CARTO: BaseMapa = "hibrido";

/** Segundo intento si Esri también falla. */
export const BASE_FALLBACK_ALTERNATIVO: BaseMapa = "osm";

export const TIMEOUT_SONDA_CARTO_MS = 4500;
export const TIMEOUT_CARGA_ESTILO_CARTO_MS = 8000;
/** Tras N errores de tile/estilo Carto en la sesión del mapa, forzar fallback. */
export const ERRORES_CARTO_PARA_FALLBACK = 3;

export function baseDependeDeCarto(base: BaseMapa): boolean {
  return BASES_CARTO.has(base);
}

export function etiquetaBaseMapa(base: BaseMapa): string {
  return BASES_DISPONIBLES.find((b) => b.valor === base)?.label ?? base;
}

/** True si URL/mensaje apunta a la CDN Carto. */
export function esUrlOErrorCarto(texto: string): boolean {
  return /basemaps\.cartocdn\.com|cartocdn\.com/i.test(texto);
}

/**
 * Extrae URL o mensaje de un ErrorEvent de MapLibre (shape varía por versión).
 */
export function textoErrorMapa(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return `${error.message} ${error.stack ?? ""}`;
  if (typeof error === "object") {
    const o = error as { url?: string; message?: string; status?: number };
    return [o.url, o.message, o.status != null ? String(o.status) : ""]
      .filter(Boolean)
      .join(" ");
  }
  return String(error);
}

/**
 * Sonda rápida: ¿alcanza el style.json de Carto Dark Matter?
 * `cache: "no-store"` evita respuesta podrida del service worker.
 */
export async function cartoDisponible(
  timeoutMs: number = TIMEOUT_SONDA_CARTO_MS,
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ESTILO_DARK_MATTER_URL, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Cadena de respaldo sin Carto (sin repetir la base pedida). */
export function cadenaFallbackSinCarto(preferida: BaseMapa): BaseMapa[] {
  const cadena: BaseMapa[] = [BASE_FALLBACK_SIN_CARTO, BASE_FALLBACK_ALTERNATIVO];
  return cadena.filter((b) => b !== preferida && !baseDependeDeCarto(b));
}

export function siguienteFallbackSinCarto(
  preferida: BaseMapa,
  yaProbadas: ReadonlySet<BaseMapa> = new Set(),
): BaseMapa | null {
  for (const b of cadenaFallbackSinCarto(preferida)) {
    if (!yaProbadas.has(b)) return b;
  }
  return null;
}
