import type maplibregl from "maplibre-gl";

/** Ancho visible (m) por debajo del cual se muestra el nombre en el marcador.
 * Coincide con la etiqueta de escala "25k" (≈ 25 km de viewport). */
export const UMBRAL_ETIQUETA_NOMBRE_METROS = 25_000;

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

/** True cuando la escala es inferior a 25k (más acercado). */
export function debeMostrarEtiquetaNombre(map: maplibregl.Map): boolean {
  return anchoVisibleMetros(map) < UMBRAL_ETIQUETA_NOMBRE_METROS;
}
