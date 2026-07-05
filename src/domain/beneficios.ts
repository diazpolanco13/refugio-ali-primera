// Dotaciones trazables a nivel de persona (`beneficios_otorgados`).

/** Ítems granulares del Kit Mínimo. */
export type ItemKit =
  | "camiseta"
  | "pantalon"
  | "ropa_interior"
  | "zapatos"
  | "calcetines"
  | "abrigo_ligero"
  | "toalla"
  | "kit_higiene_personal"
  | "colchoneta_sabana"
  | "panales"
  | "kit_menstrual";

export interface MetaItemKit {
  valor: ItemKit;
  label: string;
  usaTalla: boolean;
}

export const CATALOGO_ITEM_KIT: MetaItemKit[] = [
  { valor: "camiseta", label: "Camiseta", usaTalla: true },
  { valor: "pantalon", label: "Pantalón", usaTalla: true },
  { valor: "ropa_interior", label: "Ropa interior", usaTalla: true },
  { valor: "zapatos", label: "Zapatos", usaTalla: true },
  { valor: "calcetines", label: "Calcetines", usaTalla: true },
  { valor: "abrigo_ligero", label: "Abrigo ligero", usaTalla: false },
  { valor: "toalla", label: "Toalla", usaTalla: false },
  { valor: "kit_higiene_personal", label: "Kit de higiene", usaTalla: false },
  { valor: "colchoneta_sabana", label: "Colchoneta/sábana", usaTalla: false },
  { valor: "panales", label: "Pañales", usaTalla: false },
  { valor: "kit_menstrual", label: "Kit menstrual", usaTalla: false },
];

export const META_ITEM_KIT: Record<ItemKit, MetaItemKit> = Object.fromEntries(
  CATALOGO_ITEM_KIT.map((i) => [i.valor, i]),
) as Record<ItemKit, MetaItemKit>;

export function normalizarItemKit(raw: string | null | undefined): ItemKit {
  const claves = CATALOGO_ITEM_KIT.map((i) => i.valor);
  if (raw && claves.includes(raw as ItemKit)) return raw as ItemKit;
  return "camiseta";
}

/** Claves del catálogo de beneficios/dotaciones (legacy). */
export type TipoBeneficio =
  | "carpa"
  | "colchon"
  | "litera"
  | "ropa"
  | "kit_higiene"
  | "cobija"
  | "kit_cocina"
  | "otro";

export interface MetaBeneficio {
  valor: TipoBeneficio;
  label: string;
  /** Si true, la alerta anti-repetición avisa al registrar otro del mismo tipo. */
  unico: boolean;
}

export const CATALOGO_BENEFICIOS: MetaBeneficio[] = [
  { valor: "carpa", label: "Carpa", unico: true },
  { valor: "colchon", label: "Colchón", unico: true },
  { valor: "litera", label: "Litera", unico: true },
  { valor: "cobija", label: "Cobija", unico: false },
  { valor: "ropa", label: "Ropa", unico: false },
  { valor: "kit_higiene", label: "Kit de higiene", unico: true },
  { valor: "kit_cocina", label: "Kit de cocina", unico: true },
  { valor: "otro", label: "Otro", unico: false },
];

export const META_BENEFICIO: Record<TipoBeneficio, MetaBeneficio> = Object.fromEntries(
  CATALOGO_BENEFICIOS.map((b) => [b.valor, b]),
) as Record<TipoBeneficio, MetaBeneficio>;

/** Beneficio otorgado a una persona (histórico red-wide). */
export interface BeneficioOtorgado {
  id: string;
  refugiado_id: string;
  centro_id: string;
  tipo: TipoBeneficio;
  item_kit: ItemKit | null;
  talla: string;
  cantidad: number;
  fecha: string;
  observacion: string;
  otorgado_por: string;
  updated_at: number;
  updated_by: string;
}

export function normalizarTipoBeneficio(raw: string | null | undefined): TipoBeneficio {
  const claves = CATALOGO_BENEFICIOS.map((b) => b.valor);
  if (raw && claves.includes(raw as TipoBeneficio)) return raw as TipoBeneficio;
  return "otro";
}

export function normalizarBeneficio(
  raw: Partial<BeneficioOtorgado> & { id: string; refugiado_id: string; centro_id: string },
): BeneficioOtorgado {
  return {
    id: raw.id,
    refugiado_id: raw.refugiado_id,
    centro_id: raw.centro_id,
    tipo: normalizarTipoBeneficio(raw.tipo),
    item_kit: raw.item_kit ? normalizarItemKit(raw.item_kit) : null,
    talla: (raw.talla ?? "").trim(),
    cantidad: Math.max(1, raw.cantidad ?? 1),
    fecha: raw.fecha ?? "",
    observacion: (raw.observacion ?? "").trim(),
    otorgado_por: raw.otorgado_por ?? "",
    updated_at: raw.updated_at ?? 0,
    updated_by: raw.updated_by ?? "",
  };
}

/** Etiqueta display de un beneficio (kit o legacy). */
export function etiquetaBeneficio(b: BeneficioOtorgado): string {
  if (b.item_kit) return META_ITEM_KIT[b.item_kit]?.label ?? b.item_kit;
  return META_BENEFICIO[b.tipo]?.label ?? b.tipo;
}

/** Agrupa beneficios por ítem de kit. */
export function beneficiosPorItemKit(
  beneficios: BeneficioOtorgado[],
): Map<ItemKit, BeneficioOtorgado[]> {
  const map = new Map<ItemKit, BeneficioOtorgado[]>();
  for (const b of beneficios) {
    if (!b.item_kit) continue;
    const arr = map.get(b.item_kit) ?? [];
    arr.push(b);
    map.set(b.item_kit, arr);
  }
  return map;
}
export function beneficiosPorTipo(
  beneficios: BeneficioOtorgado[],
): Map<TipoBeneficio, BeneficioOtorgado[]> {
  const map = new Map<TipoBeneficio, BeneficioOtorgado[]>();
  const ordenados = [...beneficios].sort((a, b) => b.fecha.localeCompare(a.fecha));
  for (const b of ordenados) {
    const arr = map.get(b.tipo) ?? [];
    arr.push(b);
    map.set(b.tipo, arr);
  }
  return map;
}

/** ¿Ya recibió un beneficio de este tipo? (para alertas anti-repetición). */
export function yaRecibioBeneficio(
  beneficios: BeneficioOtorgado[],
  tipo: TipoBeneficio,
): BeneficioOtorgado | null {
  const meta = META_BENEFICIO[tipo];
  if (!meta?.unico) return null;
  const delTipo = beneficios.filter((b) => b.tipo === tipo);
  if (delTipo.length === 0) return null;
  return [...delTipo].sort((a, b) => b.fecha.localeCompare(a.fecha))[0] ?? null;
}
