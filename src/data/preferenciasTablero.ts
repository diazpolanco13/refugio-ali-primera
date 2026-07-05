const CLAVE_VISTA = "refugio-vista-tablero-centros";

export type VistaTableroCentros = "grid" | "lista";

/** Vista guardada del tablero de campamentos (cuadrícula o lista). */
export function cargarVistaTableroCentros(): VistaTableroCentros {
  try {
    const v = localStorage.getItem(CLAVE_VISTA);
    if (v === "grid" || v === "lista") return v;
  } catch {
    // ignorar
  }
  return "grid";
}

export function guardarVistaTableroCentros(vista: VistaTableroCentros): void {
  try {
    localStorage.setItem(CLAVE_VISTA, vista);
  } catch {
    // localStorage lleno o bloqueado — ignorar
  }
}
