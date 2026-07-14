import type maplibregl from "maplibre-gl";

/** Ancho visible (m) por debajo del cual se muestra el nombre — escritorio.
 * Coincide con la etiqueta de escala "25k" (≈ 25 km de viewport). */
export const UMBRAL_ETIQUETA_NOMBRE_METROS = 25_000;

/** En pantallas chicas (< md) solo mostrar nombres más cerca — escala "3k". */
export const UMBRAL_ETIQUETA_NOMBRE_MOVIL_METROS = 3_000;

/** Coincide con el breakpoint `md` de Tailwind (768px). */
const ANCHO_ESCRITORIO_PX = 768;

function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ancho visible del mapa en metros (horizontal, al centro del viewport). */
export function anchoVisibleMetros(map: maplibregl.Map): number {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const y = h / 2;
  const oeste = map.unproject([0, y]);
  const este = map.unproject([w, y]);
  return distanciaMetros(oeste.lat, oeste.lng, este.lat, este.lng);
}

/**
 * Zoom mercator aproximado para un ancho de viewport en metros a una latitud.
 * Sirve para aterrizar la intro cerca de la etiqueta de escala ("30k", etc.).
 */
export function zoomParaAnchoMetros(
  anchoMetros: number,
  latitud: number,
  anchoViewportPx: number,
): number {
  const w = Math.max(1, anchoViewportPx);
  const metros = Math.max(100, anchoMetros);
  const cosLat = Math.max(0.05, Math.cos((latitud * Math.PI) / 180));
  // metros/px en z=0 ≈ 156543.03392 * cos(lat)
  const zoom = Math.log2((156543.03392 * cosLat * w) / metros);
  return Math.min(19, Math.max(0, zoom));
}

/** Etiqueta compacta de escala: "500m", "3k", "45k". */
export function formatearEscalaVista(metros: number): string {
  if (metros < 1000) {
    const m = Math.max(50, Math.round(metros / 50) * 50);
    return `${m}m`;
  }
  const km = metros / 1000;
  if (km < 10) {
    const redondeado = Math.round(km);
    return `${redondeado}k`;
  }
  if (km < 100) {
    return `${Math.round(km / 5) * 5}k`;
  }
  return `${Math.round(km / 10) * 10}k`;
}

export function escalaVistaDelMapa(map: maplibregl.Map): string {
  return formatearEscalaVista(anchoVisibleMetros(map));
}

/** Umbral de etiquetas según ancho del contenedor del mapa (móvil vs escritorio). */
export function umbralEtiquetaNombreMetros(map: maplibregl.Map): number {
  return map.getContainer().clientWidth < ANCHO_ESCRITORIO_PX
    ? UMBRAL_ETIQUETA_NOMBRE_MOVIL_METROS
    : UMBRAL_ETIQUETA_NOMBRE_METROS;
}

/** True cuando la escala está más cerca que el umbral (móvil < 3k, escritorio < 25k). */
export function debeMostrarEtiquetaNombre(map: maplibregl.Map): boolean {
  return anchoVisibleMetros(map) < umbralEtiquetaNombreMetros(map);
}
