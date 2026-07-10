// Estado local: el dispositivo ya guardó autoridades desde /terreno.

const prefijo = "terreno_autoridades_v1:";

export function autoridadesTerrenoGuardadasLocal(centroId: string): boolean {
  if (!centroId) return false;
  try {
    return localStorage.getItem(`${prefijo}${centroId}`) === "1";
  } catch {
    return false;
  }
}

export function marcarAutoridadesTerrenoGuardadas(centroId: string): void {
  if (!centroId) return;
  try {
    localStorage.setItem(`${prefijo}${centroId}`, "1");
  } catch {
    /* ignorar */
  }
}
