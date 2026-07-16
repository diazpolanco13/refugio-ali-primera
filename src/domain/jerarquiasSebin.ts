// Catálogo normalizado de jerarquías para la identificación de operadores de
// terreno (Fase A del plan de identidad). Antes el campo era texto libre y
// producía variantes como "insp" / "Inspector" / "INSPECTOR JEFE"; el
// formulario ahora usa un SELECT sobre este catálogo.

export interface GrupoJerarquias {
  grupo: string;
  jerarquias: string[];
}

export const CATALOGO_JERARQUIAS: GrupoJerarquias[] = [
  {
    grupo: "SEBIN / Policías",
    jerarquias: [
      "Comisario Mayor",
      "Comisario General",
      "Comisario Jefe",
      "Primer Comisario",
      "Comisario",
      "Inspector Jefe",
      "Primer Inspector",
      "Inspector",
      "Detective",
    ],
  },
  {
    grupo: "Militar (FANB)",
    jerarquias: [
      "General",
      "Coronel",
      "Teniente Coronel",
      "Mayor",
      "Capitán",
      "Primer Teniente",
      "Teniente",
      "Sargento",
    ],
  },
  {
    grupo: "Otros",
    jerarquias: ["Funcionario/a civil", "Otro"],
  },
];

const TODAS = new Set(
  CATALOGO_JERARQUIAS.flatMap((g) => g.jerarquias.map((j) => j.toLowerCase())),
);

/** ¿La jerarquía pertenece al catálogo? (para precargar el select). */
export function esJerarquiaCatalogo(jerarquia: string | null | undefined): boolean {
  return Boolean(jerarquia && TODAS.has(jerarquia.trim().toLowerCase()));
}

/** Normaliza al valor canónico del catálogo si coincide (ignora mayúsculas). */
export function jerarquiaCanonica(jerarquia: string | null | undefined): string | null {
  const buscada = jerarquia?.trim().toLowerCase();
  if (!buscada) return null;
  for (const g of CATALOGO_JERARQUIAS) {
    const hit = g.jerarquias.find((j) => j.toLowerCase() === buscada);
    if (hit) return hit;
  }
  return null;
}
