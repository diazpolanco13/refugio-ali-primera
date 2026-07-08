// Estado (localStorage) de las pantallas de instrucciones de las vistas de
// campo (/censo y el reporte diario desde /terreno). Por defecto se muestran
// una sola vez por dispositivo; el portal /terreno permite volver a verlas
// (restablecer) o verlas siempre en cada entrada.

export const INSTRUCCIONES_CENSO_KEY = "censo_instrucciones_v1";
export const INSTRUCCIONES_REPORTE_KEY = "reporte_instrucciones_v1";
const SIEMPRE_KEY = "instrucciones_campo_siempre_v1";

export function verInstruccionesSiempre(): boolean {
  try {
    return localStorage.getItem(SIEMPRE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVerInstruccionesSiempre(valor: boolean): void {
  try {
    if (valor) localStorage.setItem(SIEMPRE_KEY, "1");
    else localStorage.removeItem(SIEMPRE_KEY);
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
  } catch {
    /* ignorar */
  }
}
