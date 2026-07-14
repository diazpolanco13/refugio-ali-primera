import {
  CARACAS_CENTRO,
  CARACAS_ZOOM,
} from "@/domain/centrosTransitorios";
import type { BaseMapa } from "@/map/estiloMapa";
import { CLAVES_BASE_MAPA } from "@/map/estiloMapa";

const CLAVE_VISTA = "refugio-vista-centros-v2";
const CLAVE_BASE = "refugio-base-centros";
const CLAVE_MODO_3D = "refugio-modo-3d-centros";
const CLAVE_MODO_GLOBO = "refugio-modo-globo-centros";
const CLAVE_MODO_MARCADOR = "refugio-modo-marcador-centros";
const CLAVE_MOSTRAR_PARTE = "refugio-mostrar-parte-marcador";
const CLAVE_MOSTRAR_LEYENDA = "refugio-mostrar-leyenda-marcador";
const CLAVE_MOSTRAR_CINTA = "refugio-mostrar-cinta-totales";
const CLAVE_COLOREAR_UNIDAD = "refugio-colorear-marcador-unidad";

/** Vista del ícono en el mapa: logo SEBIN o punto de color por dirección. */
export type ModoMarcadorCentros = "logo" | "color";

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
      // 0 permite alejarse hasta ver la esfera (proyección globe de MapLibre).
      zoom: Math.min(19, Math.max(0, data.zoom)),
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
        zoom: Math.min(19, Math.max(0, vista.zoom)),
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

/** Preferencia de extrusión 3D sobre Carto Dark Matter (default: activo). */
export function cargarModo3dCentros(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_MODO_3D);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function guardarModo3dCentros(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE_MODO_3D, activo ? "1" : "0");
  } catch {
    // ignorar
  }
}

/** Preferencia de proyección globo/esfera (MapLibre `setProjection`). Default: off. */
export function cargarModoGloboCentros(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_MODO_GLOBO);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function guardarModoGloboCentros(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE_MODO_GLOBO, activo ? "1" : "0");
  } catch {
    // ignorar
  }
}

export function cargarModoMarcadorCentros(): ModoMarcadorCentros | null {
  try {
    const v = localStorage.getItem(CLAVE_MODO_MARCADOR);
    if (v === "logo" || v === "color") return v;
    return null;
  } catch {
    return null;
  }
}

export function guardarModoMarcadorCentros(modo: ModoMarcadorCentros): void {
  try {
    localStorage.setItem(CLAVE_MODO_MARCADOR, modo);
  } catch {
    // ignorar
  }
}

export function cargarMostrarParteMarcador(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_MOSTRAR_PARTE);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function guardarMostrarParteMarcador(mostrar: boolean): void {
  try {
    localStorage.setItem(CLAVE_MOSTRAR_PARTE, mostrar ? "1" : "0");
  } catch {
    // ignorar
  }
}

export function cargarMostrarLeyendaMarcador(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_MOSTRAR_LEYENDA);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function guardarMostrarLeyendaMarcador(mostrar: boolean): void {
  try {
    localStorage.setItem(CLAVE_MOSTRAR_LEYENDA, mostrar ? "1" : "0");
  } catch {
    // ignorar
  }
}

export function cargarMostrarCintaTotales(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_MOSTRAR_CINTA);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function guardarMostrarCintaTotales(mostrar: boolean): void {
  try {
    localStorage.setItem(CLAVE_MOSTRAR_CINTA, mostrar ? "1" : "0");
  } catch {
    // ignorar
  }
}

/** Núcleo del marcador coloreado por unidad SEBIN (default: off → un solo color neutro). */
export function cargarColorearPorUnidad(): boolean | null {
  try {
    const v = localStorage.getItem(CLAVE_COLOREAR_UNIDAD);
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function guardarColorearPorUnidad(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE_COLOREAR_UNIDAD, activo ? "1" : "0");
  } catch {
    // ignorar
  }
}
