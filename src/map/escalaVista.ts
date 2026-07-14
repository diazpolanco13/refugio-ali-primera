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

export interface ReglaEscala {
  /** Ancho de la barra en píxeles (representa `etiqueta` a la escala actual). */
  anchoPx: number;
  /** Distancia "redonda" que representa la barra: "1 km", "200 m"… */
  etiqueta: string;
}

/** Pasos "redondos" de la regla, en km, de mayor a menor (igual que Osiris). */
const PASOS_REGLA_ESCALA_KM = [
  5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1,
];

/**
 * Regla de escala cartográfica: la barra representa siempre una distancia
 * redonda (1 km, 500 m, 200 m…) y su ancho en px cambia con el zoom — al
 * acercar, la misma distancia real ocupa más píxeles, así que la barra crece
 * (y al llegar a su tope se salta al siguiente paso más chico). Fórmula de
 * metros/px de Web Mercator, igual que `zoomParaAnchoMetros`.
 */
export function calcularReglaEscala(zoom: number, latitud: number): ReglaEscala {
  const cosLat = Math.max(0.05, Math.cos((latitud * Math.PI) / 180));
  const metrosPorPx = (156543.03392 * cosLat) / 2 ** zoom;
  const anchoMaximoPx = 100;
  const kmMaximo = (metrosPorPx * anchoMaximoPx) / 1000;

  const menorPaso = PASOS_REGLA_ESCALA_KM[PASOS_REGLA_ESCALA_KM.length - 1];
  let paso = menorPaso;
  for (const candidato of PASOS_REGLA_ESCALA_KM) {
    if (candidato <= kmMaximo) {
      paso = candidato;
      break;
    }
  }

  const anchoPx = Math.max(24, Math.round((paso * 1000) / metrosPorPx));
  const etiqueta = paso >= 1 ? `${paso} km` : `${Math.round(paso * 1000)} m`;
  return { anchoPx, etiqueta };
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
