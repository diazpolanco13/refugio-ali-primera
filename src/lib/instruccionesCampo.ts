// Estado (localStorage) de las pantallas de instrucciones de las vistas de
// campo (/censo y el reporte diario desde /terreno). Por defecto se muestran
// siempre en cada entrada (primera visita); el usuario puede desactivar el
// toggle o restablecerlas una sola vez desde /terreno.

export const INSTRUCCIONES_CENSO_KEY = "censo_instrucciones_v3";
export const INSTRUCCIONES_REPORTE_KEY = "reporte_instrucciones_v1";
export const INSTRUCCIONES_GEO_KEY = "geo_instrucciones_v1";
export const INSTRUCCIONES_AUTORIDADES_KEY = "autoridades_instrucciones_v1";
export const INSTRUCCIONES_CAPACIDAD_KEY = "capacidad_instrucciones_v1";
const SIEMPRE_KEY = "instrucciones_campo_siempre_v1";

/**
 * Preferencia «ver instrucciones cada vez».
 * Sin valor guardado (primera visita) → activo. Solo queda off si el usuario
 * lo desactivó explícitamente (`"0"`).
 */
export function verInstruccionesSiempre(): boolean {
  try {
    const v = localStorage.getItem(SIEMPRE_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function setVerInstruccionesSiempre(valor: boolean): void {
  try {
    localStorage.setItem(SIEMPRE_KEY, valor ? "1" : "0");
  } catch {
    /* ignorar */
  }
}

/** ¿Toca mostrar la pantalla de instrucciones al entrar? */
export function debeMostrarInstrucciones(key: string): boolean {
  if (verInstruccionesSiempre()) return true;
  try {
    return localStorage.getItem(key) !== "1";
  } catch {
    return true;
  }
}

export function marcarInstruccionesVistas(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignorar */
  }
}

/** Borra las marcas de "ya visto": las instrucciones vuelven a salir una vez. */
export function restablecerInstruccionesVistas(): void {
  try {
    localStorage.removeItem(INSTRUCCIONES_CENSO_KEY);
    localStorage.removeItem(INSTRUCCIONES_REPORTE_KEY);
    localStorage.removeItem(INSTRUCCIONES_GEO_KEY);
    localStorage.removeItem(INSTRUCCIONES_AUTORIDADES_KEY);
    localStorage.removeItem(INSTRUCCIONES_CAPACIDAD_KEY);
  } catch {
    /* ignorar */
  }
}
