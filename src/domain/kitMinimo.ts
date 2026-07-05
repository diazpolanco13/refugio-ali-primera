// Kit Mínimo de Supervivencia — catálogo, recomendaciones y pendientes.
// Lógica pura; sin dependencias de UI ni Supabase.

import type { BeneficioOtorgado, ItemKit } from "./beneficios";
import { META_ITEM_KIT, normalizarItemKit } from "./beneficios";
import {
  esAdultoMayor,
  esMenor5,
  type Refugiado,
  type TallasRefugiado,
} from "./refugiados";

export type PrioridadKit = "alta" | "media" | "baja";

export interface ItemKitRecomendado {
  item: ItemKit;
  cantidad: number;
  tallaSugerida?: string;
  notas?: string;
}

export interface PendienteKit {
  item: ItemKit;
  necesario: number;
  recibido: number;
  faltante: number;
  talla?: string;
  prioridad: PrioridadKit;
}

/** Catálogo base del kit mínimo para adulto. */
export const KIT_MINIMO_ADULTO: ItemKitRecomendado[] = [
  { item: "camiseta", cantidad: 2 },
  { item: "pantalon", cantidad: 1 },
  { item: "ropa_interior", cantidad: 3 },
  { item: "calcetines", cantidad: 2 },
  { item: "zapatos", cantidad: 1 },
  { item: "abrigo_ligero", cantidad: 1 },
  { item: "toalla", cantidad: 1 },
  { item: "kit_higiene_personal", cantidad: 1 },
  { item: "colchoneta_sabana", cantidad: 1 },
];

const KIT_NINO: ItemKitRecomendado[] = [
  { item: "camiseta", cantidad: 3 },
  { item: "pantalon", cantidad: 2 },
  { item: "ropa_interior", cantidad: 3 },
  { item: "calcetines", cantidad: 2 },
  { item: "zapatos", cantidad: 1 },
  { item: "panales", cantidad: 1, notas: "Si aplica por edad" },
  { item: "kit_higiene_personal", cantidad: 1 },
  { item: "colchoneta_sabana", cantidad: 1 },
];

const EXTRAS_EMBARAZADA: ItemKitRecomendado[] = [
  { item: "kit_menstrual", cantidad: 1 },
  { item: "abrigo_ligero", cantidad: 1 },
];

const EXTRAS_ADULTO_MAYOR: ItemKitRecomendado[] = [
  { item: "abrigo_ligero", cantidad: 1 },
  { item: "toalla", cantidad: 1 },
];

/** Kit recomendado según perfil demográfico y tallas registradas. */
export function kitRecomendadoParaPersona(
  refugiado: Refugiado,
  tallas?: TallasRefugiado,
): ItemKitRecomendado[] {
  const base = esMenor5(refugiado.fecha_nacimiento) ? [...KIT_NINO] : [...KIT_MINIMO_ADULTO];

  if (refugiado.vulnerabilidades.embarazada) {
    for (const extra of EXTRAS_EMBARAZADA) {
      const existente = base.find((b) => b.item === extra.item);
      if (existente) existente.cantidad += extra.cantidad;
      else base.push({ ...extra });
    }
  }

  if (esAdultoMayor(refugiado.fecha_nacimiento)) {
    for (const extra of EXTRAS_ADULTO_MAYOR) {
      const existente = base.find((b) => b.item === extra.item);
      if (existente) existente.cantidad += extra.cantidad;
      else base.push({ ...extra });
    }
  }

  if (refugiado.vulnerabilidades.discapacidad) {
    const toalla = base.find((b) => b.item === "toalla");
    if (toalla) toalla.cantidad += 1;
  }

  return base.map((item) => ({
    ...item,
    tallaSugerida: tallaParaItem(item.item, tallas),
  }));
}

function tallaParaItem(item: ItemKit, tallas?: TallasRefugiado): string | undefined {
  if (!tallas) return undefined;
  switch (item) {
    case "camiseta":
      return tallas.camisa || undefined;
    case "pantalon":
      return tallas.pantalon || undefined;
    case "zapatos":
      return tallas.zapatos || undefined;
    case "ropa_interior":
      return tallas.ropa_interior || undefined;
    case "calcetines":
      return tallas.calcetines || undefined;
    default:
      return undefined;
  }
}

/** Prioridad de entrega según vulnerabilidades. */
export function prioridadEntrega(refugiado: Refugiado): PrioridadKit {
  if (
    refugiado.vulnerabilidades.embarazada ||
    refugiado.vulnerabilidades.discapacidad ||
    esMenor5(refugiado.fecha_nacimiento)
  ) {
    return "alta";
  }
  if (esAdultoMayor(refugiado.fecha_nacimiento)) return "media";
  return "baja";
}

/** Cuenta entregas por ítem (incluye legacy tipo: ropa como parcial). */
function entregasPorItem(entregas: BeneficioOtorgado[]): Map<ItemKit, number> {
  const map = new Map<ItemKit, number>();
  for (const e of entregas) {
    if (e.item_kit) {
      const item = normalizarItemKit(e.item_kit);
      map.set(item, (map.get(item) ?? 0) + e.cantidad);
      continue;
    }
    // Legacy: ropa cuenta como 1 camiseta + 1 pantalón parcial
    if (e.tipo === "ropa") {
      map.set("camiseta", (map.get("camiseta") ?? 0) + e.cantidad);
      map.set("pantalon", (map.get("pantalon") ?? 0) + e.cantidad);
    }
    if (e.tipo === "kit_higiene") {
      map.set("kit_higiene_personal", (map.get("kit_higiene_personal") ?? 0) + e.cantidad);
    }
    if (e.tipo === "colchon") {
      map.set("colchoneta_sabana", (map.get("colchoneta_sabana") ?? 0) + e.cantidad);
    }
    if (e.tipo === "cobija") {
      map.set("abrigo_ligero", (map.get("abrigo_ligero") ?? 0) + e.cantidad);
    }
  }
  return map;
}

/** Calcula pendientes comparando entregas vs kit recomendado. */
export function calcularPendientes(
  entregas: BeneficioOtorgado[],
  kitRecomendado: ItemKitRecomendado[],
  prioridad: PrioridadKit = "media",
): PendienteKit[] {
  const recibidos = entregasPorItem(entregas);
  const pendientes: PendienteKit[] = [];

  for (const rec of kitRecomendado) {
    const recibido = recibidos.get(rec.item) ?? 0;
    const faltante = Math.max(0, rec.cantidad - recibido);
    if (faltante > 0) {
      pendientes.push({
        item: rec.item,
        necesario: rec.cantidad,
        recibido,
        faltante,
        talla: rec.tallaSugerida,
        prioridad,
      });
    }
  }
  return pendientes.sort((a, b) => {
    const orden: Record<PrioridadKit, number> = { alta: 0, media: 1, baja: 2 };
    return orden[a.prioridad] - orden[b.prioridad];
  });
}

/** Agrega pendientes de varias personas (titular + familia). */
export function agregarPendientesFamilia(
  kits: { refugiado: Refugiado; entregas: BeneficioOtorgado[] }[],
): PendienteKit[] {
  const acum = new Map<ItemKit, PendienteKit>();
  for (const { refugiado, entregas } of kits) {
    const kit = kitRecomendadoParaPersona(refugiado, refugiado.tallas);
    const prio = prioridadEntrega(refugiado);
    const pends = calcularPendientes(entregas, kit, prio);
    for (const p of pends) {
      const prev = acum.get(p.item);
      if (!prev) acum.set(p.item, { ...p });
      else {
        prev.necesario += p.necesario;
        prev.recibido += p.recibido;
        prev.faltante += p.faltante;
        if (prio === "alta" || (prio === "media" && prev.prioridad === "baja")) {
          prev.prioridad = prio;
        }
      }
    }
  }
  return [...acum.values()].sort((a, b) => b.faltante - a.faltante);
}

/** Reporte red-wide: filas con pendientes por persona. */
export interface FilaPendienteRed {
  refugiadoId: string;
  alojamientoId: string;
  centroId: string;
  nombre: string;
  codigoFicha: string | null;
  item: ItemKit;
  talla?: string;
  faltante: number;
  prioridad: PrioridadKit;
}

export function pendientesRed(
  personas: {
    refugiado: Refugiado;
    alojamientoId: string;
    centroId: string;
    entregas: BeneficioOtorgado[];
  }[],
  filtro?: { item?: ItemKit; talla?: string; centroId?: string },
): FilaPendienteRed[] {
  const filas: FilaPendienteRed[] = [];
  for (const p of personas) {
    if (filtro?.centroId && p.centroId !== filtro.centroId) continue;
    const kit = kitRecomendadoParaPersona(p.refugiado, p.refugiado.tallas);
    const prio = prioridadEntrega(p.refugiado);
    const pends = calcularPendientes(p.entregas, kit, prio);
    for (const pend of pends) {
      if (filtro?.item && pend.item !== filtro.item) continue;
      if (filtro?.talla && pend.talla?.toUpperCase() !== filtro.talla.toUpperCase()) continue;
      filas.push({
        refugiadoId: p.refugiado.id,
        alojamientoId: p.alojamientoId,
        centroId: p.centroId,
        nombre: [p.refugiado.primer_nombre, p.refugiado.primer_apellido].filter(Boolean).join(" "),
        codigoFicha: p.refugiado.codigo_ficha ?? null,
        item: pend.item,
        talla: pend.talla,
        faltante: pend.faltante,
        prioridad: pend.prioridad,
      });
    }
  }
  return filas;
}

/** Exporta filas a CSV. */
export function pendientesACsv(filas: FilaPendienteRed[]): string {
  const header = "Centro,Código,Nombre,Ítem,Talla,Faltante,Prioridad";
  const rows = filas.map((f) =>
    [
      f.centroId,
      f.codigoFicha ?? "",
      `"${f.nombre.replace(/"/g, '""')}"`,
      META_ITEM_KIT[f.item]?.label ?? f.item,
      f.talla ?? "",
      f.faltante,
      f.prioridad,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}
