// Membrete institucional de los PDF (franja superior de parte ejecutivo y
// estatus del censo). Antes estaba hardcodeado SEBIN/SAE; ahora sale del
// catálogo `cuerpos_policiales`: cada cuerpo define su nombre oficial, escudo
// y sala/unidad de análisis. El cuerpo del membrete es el del analista que
// genera (ámbito 'cuerpo'); admin y analistas de red usan el del SEBIN
// (institución de la sala situacional central, editable como cualquier otra).

import { getMetaCuerpoMap, type MetaCuerpo } from "./cuerposPoliciales";

export interface MembretePdf {
  /** Líneas del lado izquierdo (nombre institucional). */
  izqLineas: string[];
  /** Escudo del cuerpo (path público o URL Storage). */
  izqLogo: string | null;
  /** Líneas del lado derecho (sala/unidad de análisis; vacío = se omite). */
  derLineas: string[];
  derLogo: string | null;
}

/** Compatibilidad histórica: PNG de alta resolución del membrete SEBIN/SAE. */
const LOGO_MEMBRETE_SEBIN = "/logos/logo-sebin.png";

/** Divide un nombre largo en 2 líneas balanceadas por palabras. */
export function partirEnDosLineas(texto: string): string[] {
  const limpio = texto.trim().replace(/\s+/g, " ");
  if (!limpio) return [];
  if (limpio.length <= 18) return [limpio];
  const palabras = limpio.split(" ");
  if (palabras.length === 1) return [limpio];
  let mejor = 1;
  let mejorDif = Number.POSITIVE_INFINITY;
  for (let i = 1; i < palabras.length; i++) {
    const a = palabras.slice(0, i).join(" ").length;
    const b = palabras.slice(i).join(" ").length;
    const dif = Math.abs(a - b);
    if (dif < mejorDif) {
      mejorDif = dif;
      mejor = i;
    }
  }
  return [palabras.slice(0, mejor).join(" "), palabras.slice(mejor).join(" ")];
}

/** Cuerpo cuyo membrete corresponde al usuario que genera el PDF. */
export function claveCuerpoMembrete(
  usuario: { rol?: string; cuerpo_asignado?: string | null } | null | undefined,
): string {
  if (usuario?.rol === "analista_sae" && usuario.cuerpo_asignado) {
    return usuario.cuerpo_asignado;
  }
  return "sebin";
}

/** Membrete del PDF para el usuario dado (URLs sin convertir aún). */
export function resolverMembretePdf(
  usuario: { rol?: string; cuerpo_asignado?: string | null } | null | undefined,
): MembretePdf {
  const clave = claveCuerpoMembrete(usuario);
  const meta: MetaCuerpo | undefined = getMetaCuerpoMap()[clave];

  const nombre = meta?.nombreOficial || meta?.label || "";
  // El escudo del SEBIN del catálogo es WebP 96px; para su membrete se
  // conserva el PNG histórico de mejor resolución.
  const izqLogo =
    clave === "sebin" ? LOGO_MEMBRETE_SEBIN : (meta?.logo ?? null);

  return {
    izqLineas: partirEnDosLineas(nombre),
    izqLogo,
    derLineas: meta?.salaNombre ? partirEnDosLineas(meta.salaNombre) : [],
    derLogo: meta?.salaLogo ?? null,
  };
}
