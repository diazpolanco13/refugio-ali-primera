import { PARQUE_CENTRO } from "../domain/tipos";

// Zoom por defecto ~30 m en la barra de escala, a la latitud del parque
// (verificado empíricamente: el rango 17.5–17.9 muestra "30 m").
export const ZOOM_DEFECTO = 17.7;

export interface Vista {
  center: [number, number];
  zoom: number;
}

const KEY = "refugio.vista";

export const VISTA_DEFECTO: Vista = {
  center: PARQUE_CENTRO,
  zoom: ZOOM_DEFECTO,
};

export function cargarVista(): Vista {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return VISTA_DEFECTO;
    const v = JSON.parse(raw) as Partial<Vista>;
    if (
      Array.isArray(v.center) &&
      v.center.length === 2 &&
      typeof v.zoom === "number"
    ) {
      return { center: [v.center[0], v.center[1]], zoom: v.zoom };
    }
  } catch {
    // ignore
  }
  return VISTA_DEFECTO;
}

export function guardarVista(v: Vista): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // ignore (modo privado / almacenamiento lleno)
  }
}

export function borrarVista(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
