import {
  CARACAS_CENTRO,
  CARACAS_ZOOM,
} from "@/domain/centrosTransitorios";
import type { BaseMapa } from "@/map/estiloMapa";
import { CLAVES_BASE_MAPA } from "@/map/estiloMapa";

const CLAVE_VISTA = "refugio-vista-centros";
const CLAVE_BASE = "refugio-base-centros";

export interface VistaMapaCentros {
  center: [number, number];
  zoom: number;
}

export const VISTA_DEFECTO_CENTROS: VistaMapaCentros = {
  center: CARACAS_CENTRO,
  zoom: CARACAS_ZOOM,
};

function esCoordenada(v: unknown): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

/** Última vista guardada del mapa de centros (centro + zoom). */
export function cargarVistaCentros(): VistaMapaCentros | null {
  try {
    const raw = localStorage.getItem(CLAVE_VISTA);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<VistaMapaCentros>;
    if (!esCoordenada(data.center) || typeof data.zoom !== "number" || !Number.isFinite(data.zoom)) {
      return null;
    }
    return {
      center: data.center,
      zoom: Math.min(19, Math.max(3, data.zoom)),
    };
  } catch {
    return null;
  }
}

export function guardarVistaCentros(vista: VistaMapaCentros): void {
  try {
    localStorage.setItem(
      CLAVE_VISTA,
      JSON.stringify({
        center: vista.center,
        zoom: Math.min(19, Math.max(3, vista.zoom)),
      }),
    );
  } catch {
    // localStorage lleno o bloqueado — ignorar
  }
}

export function cargarBaseMapaCentros(): BaseMapa | null {
  try {
    const v = localStorage.getItem(CLAVE_BASE);
    if (!v || !CLAVES_BASE_MAPA.has(v as BaseMapa)) return null;
    return v as BaseMapa;
  } catch {
    return null;
  }
}

export function guardarBaseMapaCentros(base: BaseMapa): void {
  try {
    localStorage.setItem(CLAVE_BASE, base);
  } catch {
    // ignorar
  }
}
