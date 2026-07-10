// Estado local de «campamento ya geolocalizado desde este dispositivo».
// Complementa el flag que viene de la BD (`geom` / RPC terreno_centro) para
// pintar el botón verde en el menú de /terreno en cuanto se guarda.

const prefijo = "terreno_geolocalizado_v1:";

export function centroGeolocalizadoLocal(centroId: string): boolean {
  if (!centroId) return false;
  try {
    return localStorage.getItem(`${prefijo}${centroId}`) === "1";
  } catch {
    return false;
  }
}

export function marcarCentroGeolocalizado(centroId: string): void {
  if (!centroId) return;
  try {
    localStorage.setItem(`${prefijo}${centroId}`, "1");
  } catch {
    /* ignorar */
  }
}
