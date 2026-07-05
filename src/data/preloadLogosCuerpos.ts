import { CATALOGO_CUERPOS } from "@/domain/centrosTransitorios";

const precargados = new Set<string>();

/** Precarga en paralelo los logos únicos del catálogo (mapa / tablero). */
export function preloadLogosCuerpos(): void {
  for (const { logo } of CATALOGO_CUERPOS) {
    if (!logo || precargados.has(logo)) continue;
    precargados.add(logo);
    const img = new Image();
    img.src = logo;
  }
}
