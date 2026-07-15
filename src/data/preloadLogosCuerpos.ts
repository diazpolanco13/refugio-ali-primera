import { getCatalogoCuerpos } from "@/domain/cuerposPoliciales";

const precargados = new Set<string>();

/** Precarga en paralelo los logos únicos del catálogo (mapa / tablero). */
export function preloadLogosCuerpos(): void {
  for (const { logo } of getCatalogoCuerpos()) {
    if (!logo || precargados.has(logo)) continue;
    precargados.add(logo);
    const img = new Image();
    img.src = logo;
  }
}
