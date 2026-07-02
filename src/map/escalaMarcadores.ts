import { ZOOM_DEFECTO } from "../data/preferencias";

const ESCALA_MIN = 0.26;
const ESCALA_MAX = 1.12;

function factorMovil(): number {
  if (typeof window === "undefined") return 1;
  return window.matchMedia("(pointer: coarse)").matches ? 0.86 : 1;
}

/** Escala visual de marcadores HTML (1 = zoom de trabajo habitual). */
export function escalaMarcadorPorZoom(zoom: number): number {
  const t = (zoom - ZOOM_DEFECTO) / 3;
  const raw = 2 ** (t * 0.85) * factorMovil();
  return Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, raw));
}

/** Por debajo de este zoom solo se muestra el ícono (sin capacidad). */
export const ZOOM_COMPACTO = 15.3;

/** Por debajo de este zoom se ocultan las etiquetas de sector. */
export const ZOOM_OCULTAR_SECTORES = 14.8;

export function esVistaCompacta(zoom: number): boolean {
  return zoom < ZOOM_COMPACTO;
}

export function ocultarNombreSector(zoom: number): boolean {
  return zoom < ZOOM_OCULTAR_SECTORES;
}

/** Selector del hijo donde va el scale (MapLibre usa transform en el padre). */
export const MK_ESCALA_SELECTOR = ".map-mk-scale";

export function aplicarTransformEscala(el: HTMLElement, escala: number): void {
  el.style.transform = `scale(${escala})`;
  el.style.transformOrigin = "center center";
}
