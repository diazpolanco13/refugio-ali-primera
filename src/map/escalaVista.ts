import { ZOOM_INICIO_FADE_EDIFICIOS_3D, ZOOM_FIN_FADE_EDIFICIOS_3D } from "./estiloMapa";

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

/**
 * Opacidad (0-1) de las etiquetas de nombre según el zoom — mismo rango que
 * el fade-in de los edificios 3D (`fill-extrusion-opacity` en estiloMapa.ts):
 * arrancan invisibles al cruzar el mismo umbral y llegan a opacidad plena en
 * el mismo punto, para que "aparezcan progresivamente" igual que ellos.
 */
export function opacidadEtiquetaNombre(zoom: number): number {
  if (zoom <= ZOOM_INICIO_FADE_EDIFICIOS_3D) return 0;
  if (zoom >= ZOOM_FIN_FADE_EDIFICIOS_3D) return 1;
  return (
    (zoom - ZOOM_INICIO_FADE_EDIFICIOS_3D) /
    (ZOOM_FIN_FADE_EDIFICIOS_3D - ZOOM_INICIO_FADE_EDIFICIOS_3D)
  );
}

/** True apenas empieza a aparecer la etiqueta (zoom > inicio del fade). */
export function debeMostrarEtiquetaNombre(zoom: number): boolean {
  return zoom > ZOOM_INICIO_FADE_EDIFICIOS_3D;
}
