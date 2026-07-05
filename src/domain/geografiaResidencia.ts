// Objetivos geográficos para guiar el mapa de residencia afectada (sin geocodificador externo).

import {
  DIVISIONES_VENEZUELA,
  ESTADOS_VENEZUELA,
  normalizarPais,
} from "./catalogosHumanitarios";

/** Centro [lng, lat] + zoom sugerido para encuadrar una división administrativa. */
export interface ObjetivoGeografico {
  center: [number, number];
  zoom: number;
  /** Límites opcionales [[swLng, swLat], [neLng, neLat]] para fitBounds. */
  bounds?: [[number, number], [number, number]];
  etiqueta: string;
}

type NivelGeo = "pais" | "estado" | "municipio" | "parroquia";

/** Venezuela — vista nacional. */
const VENEZUELA: ObjetivoGeografico = {
  center: [-66.5, 7.5],
  zoom: 6,
  bounds: [
    [-73.5, 0.5],
    [-59.5, 12.5],
  ],
  etiqueta: "Venezuela",
};

/** Centros aproximados por estado (24 estados). */
const CENTROS_ESTADO: Record<string, ObjetivoGeografico> = {
  Amazonas: { center: [-65.75, 3.5], zoom: 7, etiqueta: "Amazonas" },
  Anzoátegui: { center: [-64.6, 9.0], zoom: 8, etiqueta: "Anzoátegui" },
  Apure: { center: [-68.0, 7.5], zoom: 8, etiqueta: "Apure" },
  Aragua: { center: [-67.4, 10.2], zoom: 9, etiqueta: "Aragua" },
  Barinas: { center: [-70.2, 8.6], zoom: 8, etiqueta: "Barinas" },
  Bolívar: { center: [-63.5, 6.5], zoom: 7, etiqueta: "Bolívar" },
  Carabobo: { center: [-68.0, 10.2], zoom: 9, etiqueta: "Carabobo" },
  Cojedes: { center: [-68.6, 9.5], zoom: 9, etiqueta: "Cojedes" },
  "Delta Amacuro": { center: [-61.0, 8.5], zoom: 8, etiqueta: "Delta Amacuro" },
  "Distrito Capital": {
    center: [-66.9036, 10.4806],
    zoom: 12,
    bounds: [
      [-67.05, 10.35],
      [-66.75, 10.55],
    ],
    etiqueta: "Distrito Capital",
  },
  Falcón: { center: [-69.7, 11.4], zoom: 8, etiqueta: "Falcón" },
  Guárico: { center: [-66.5, 9.0], zoom: 8, etiqueta: "Guárico" },
  "La Guaira": {
    center: [-66.93, 10.6],
    zoom: 12,
    bounds: [
      [-67.05, 10.45],
      [-66.75, 10.72],
    ],
    etiqueta: "La Guaira",
  },
  Lara: { center: [-69.5, 10.1], zoom: 9, etiqueta: "Lara" },
  Mérida: { center: [-71.2, 8.6], zoom: 9, etiqueta: "Mérida" },
  Miranda: {
    center: [-66.85, 10.35],
    zoom: 11,
    bounds: [
      [-67.15, 10.15],
      [-66.55, 10.55],
    ],
    etiqueta: "Miranda",
  },
  Monagas: { center: [-63.0, 9.5], zoom: 8, etiqueta: "Monagas" },
  "Nueva Esparta": { center: [-64.1, 11.0], zoom: 9, etiqueta: "Nueva Esparta" },
  Portuguesa: { center: [-69.5, 9.2], zoom: 9, etiqueta: "Portuguesa" },
  Sucre: { center: [-62.8, 10.5], zoom: 8, etiqueta: "Sucre" },
  Táchira: { center: [-72.2, 7.9], zoom: 9, etiqueta: "Táchira" },
  Trujillo: { center: [-70.4, 9.4], zoom: 9, etiqueta: "Trujillo" },
  Yaracuy: { center: [-68.7, 10.3], zoom: 9, etiqueta: "Yaracuy" },
  Zulia: { center: [-71.5, 10.0], zoom: 8, etiqueta: "Zulia" },
};

/** Municipios con encuadre más preciso (Área Metropolitana + La Guaira). */
const CENTROS_MUNICIPIO: Record<string, Record<string, ObjetivoGeografico>> = {
  "Distrito Capital": {
    Libertador: {
      center: [-66.9036, 10.4806],
      zoom: 13,
      bounds: [
        [-67.05, 10.35],
        [-66.75, 10.55],
      ],
      etiqueta: "Libertador",
    },
  },
  Miranda: {
    Baruta: { center: [-66.88, 10.43], zoom: 13, etiqueta: "Baruta" },
    Chacao: { center: [-66.86, 10.49], zoom: 14, etiqueta: "Chacao" },
    "El Hatillo": { center: [-66.82, 10.43], zoom: 13, etiqueta: "El Hatillo" },
    Sucre: { center: [-66.82, 10.48], zoom: 13, etiqueta: "Sucre" },
    Plaza: { center: [-66.88, 10.47], zoom: 13, etiqueta: "Plaza" },
    Zamora: { center: [-66.54, 10.47], zoom: 13, etiqueta: "Zamora" },
  },
  "La Guaira": {
    Vargas: {
      center: [-66.93, 10.6],
      zoom: 12,
      bounds: [
        [-67.05, 10.45],
        [-66.75, 10.72],
      ],
      etiqueta: "Vargas",
    },
  },
  Zulia: {
    Maracaibo: { center: [-71.63, 10.65], zoom: 12, etiqueta: "Maracaibo" },
  },
  Carabobo: {
    Valencia: { center: [-68.0, 10.18], zoom: 12, etiqueta: "Valencia" },
  },
  Aragua: {
    Girardot: { center: [-67.47, 10.25], zoom: 12, etiqueta: "Girardot" },
  },
};

/** Parroquias con encuadre local (énfasis emergencia Caracas / La Guaira). */
const CENTROS_PARROQUIA: Record<string, Record<string, Record<string, ObjetivoGeografico>>> = {
  "Distrito Capital": {
    Libertador: {
      "23 de Enero": { center: [-66.93, 10.51], zoom: 15, etiqueta: "23 de Enero" },
      Altagracia: { center: [-66.91, 10.51], zoom: 15, etiqueta: "Altagracia" },
      Antímano: { center: [-66.95, 10.44], zoom: 15, etiqueta: "Antímano" },
      Candelaria: { center: [-66.91, 10.5], zoom: 15, etiqueta: "Candelaria" },
      Caricuao: { center: [-66.96, 10.43], zoom: 15, etiqueta: "Caricuao" },
      Catedral: { center: [-66.914, 10.506], zoom: 16, etiqueta: "Catedral" },
      Coche: { center: [-66.93, 10.47], zoom: 15, etiqueta: "Coche" },
      "El Junquito": { center: [-66.98, 10.42], zoom: 14, etiqueta: "El Junquito" },
      "El Paraíso": { center: [-66.93, 10.49], zoom: 15, etiqueta: "El Paraíso" },
      "El Recreo": { center: [-66.92, 10.48], zoom: 15, etiqueta: "El Recreo" },
      "El Valle": { center: [-66.91, 10.47], zoom: 15, etiqueta: "El Valle" },
      "La Pastora": { center: [-66.915, 10.505], zoom: 15, etiqueta: "La Pastora" },
      "La Vega": { center: [-66.92, 10.46], zoom: 15, etiqueta: "La Vega" },
      Macarao: { center: [-66.97, 10.4], zoom: 14, etiqueta: "Macarao" },
      "San Agustín": { center: [-66.91, 10.48], zoom: 15, etiqueta: "San Agustín" },
      "San Bernardino": { center: [-66.905, 10.505], zoom: 15, etiqueta: "San Bernardino" },
      "San José": { center: [-66.91, 10.505], zoom: 15, etiqueta: "San José" },
      "San Juan": { center: [-66.935, 10.51], zoom: 15, etiqueta: "San Juan" },
      "San Pedro": { center: [-66.9, 10.5], zoom: 15, etiqueta: "San Pedro" },
      "Santa Rosalía": { center: [-66.905, 10.495], zoom: 15, etiqueta: "Santa Rosalía" },
      "Santa Teresa": { center: [-66.908, 10.502], zoom: 15, etiqueta: "Santa Teresa" },
      Sucre: { center: [-66.9, 10.49], zoom: 15, etiqueta: "Sucre" },
    },
  },
  Miranda: {
    Baruta: {
      Baruta: { center: [-66.88, 10.43], zoom: 15, etiqueta: "Baruta" },
      "El Cafetal": { center: [-66.85, 10.45], zoom: 15, etiqueta: "El Cafetal" },
      "Las Minas de Baruta": { center: [-66.87, 10.41], zoom: 15, etiqueta: "Las Minas de Baruta" },
    },
    Chacao: { Chacao: { center: [-66.855, 10.495], zoom: 16, etiqueta: "Chacao" } },
    "El Hatillo": { "El Hatillo": { center: [-66.82, 10.43], zoom: 15, etiqueta: "El Hatillo" } },
    Sucre: {
      Petare: { center: [-66.82, 10.48], zoom: 15, etiqueta: "Petare" },
      Caucagüita: { center: [-66.8, 10.47], zoom: 15, etiqueta: "Caucagüita" },
      "Filas de Mariche": { center: [-66.78, 10.46], zoom: 15, etiqueta: "Filas de Mariche" },
      "La Dolorita": { center: [-66.79, 10.48], zoom: 15, etiqueta: "La Dolorita" },
      "Leoncio Martínez": { center: [-66.81, 10.49], zoom: 15, etiqueta: "Leoncio Martínez" },
    },
    Plaza: {
      Guarenas: { center: [-66.54, 10.47], zoom: 14, etiqueta: "Guarenas" },
      Tácata: { center: [-66.56, 10.45], zoom: 14, etiqueta: "Tácata" },
    },
    Zamora: {
      Guatire: { center: [-66.54, 10.47], zoom: 14, etiqueta: "Guatire" },
      Araira: { center: [-66.52, 10.45], zoom: 14, etiqueta: "Araira" },
    },
  },
  "La Guaira": {
    Vargas: {
      Caraballeda: { center: [-66.862, 10.597], zoom: 16, etiqueta: "Caraballeda" },
      Carayaca: { center: [-66.935, 10.58], zoom: 15, etiqueta: "Carayaca" },
      Caruao: { center: [-66.88, 10.62], zoom: 15, etiqueta: "Caruao" },
      "Catia La Mar": { center: [-67.01, 10.59], zoom: 15, etiqueta: "Catia La Mar" },
      "La Guaira": { center: [-66.935, 10.599], zoom: 15, etiqueta: "La Guaira" },
      Macuto: { center: [-66.89, 10.61], zoom: 15, etiqueta: "Macuto" },
      Maiquetía: { center: [-66.951, 10.601], zoom: 16, etiqueta: "Maiquetía" },
      Naiguatá: { center: [-66.82, 10.58], zoom: 14, etiqueta: "Naiguatá" },
      Urimare: { center: [-66.87, 10.59], zoom: 15, etiqueta: "Urimare" },
    },
  },
};

export interface SeleccionGeoResidencia {
  pais: string;
  estado: string;
  municipio: string;
  parroquia: string;
}

export interface CambioNivelGeo {
  nivel: NivelGeo;
  valor: string;
}

/** Resuelve el objetivo de cámara según la selección administrativa más específica. */
export function resolverObjetivoGeografico(sel: SeleccionGeoResidencia): ObjetivoGeografico {
  const pais = normalizarPais(sel.pais);
  if (pais !== "Venezuela") {
    return { center: [-66.5, 7.5], zoom: 5, etiqueta: pais };
  }

  const estado = sel.estado.trim();
  const municipio = sel.municipio.trim();
  const parroquia = sel.parroquia.trim();

  if (estado && municipio && parroquia) {
    const obj = CENTROS_PARROQUIA[estado]?.[municipio]?.[parroquia];
    if (obj) return obj;
  }

  if (estado && municipio) {
    const obj = CENTROS_MUNICIPIO[estado]?.[municipio];
    if (obj) return obj;
  }

  if (estado) {
    const obj = CENTROS_ESTADO[estado];
    if (obj) return obj;
  }

  return VENEZUELA;
}

/** Objetivo al cambiar un nivel concreto (para animar al seleccionar). */
export function objetivoPorCambioNivel(
  sel: SeleccionGeoResidencia,
  cambio: CambioNivelGeo,
): ObjetivoGeografico {
  const pais = normalizarPais(sel.pais);
  if (pais !== "Venezuela") {
    return { center: [-66.5, 7.5], zoom: 5, etiqueta: pais };
  }

  switch (cambio.nivel) {
    case "pais":
      return VENEZUELA;
    case "estado":
      return CENTROS_ESTADO[cambio.valor] ?? VENEZUELA;
    case "municipio":
      return (
        CENTROS_MUNICIPIO[sel.estado]?.[cambio.valor] ??
        CENTROS_ESTADO[sel.estado] ??
        VENEZUELA
      );
    case "parroquia":
      return (
        CENTROS_PARROQUIA[sel.estado]?.[sel.municipio]?.[cambio.valor] ??
        CENTROS_MUNICIPIO[sel.estado]?.[sel.municipio] ??
        CENTROS_ESTADO[sel.estado] ??
        VENEZUELA
      );
  }
}

/** Lista de municipios conocidos en catálogo geo (para validación futura). */
export function municipiosConGeo(): string[] {
  const set = new Set<string>();
  for (const div of DIVISIONES_VENEZUELA) {
    for (const m of div.municipios) set.add(m.nombre);
  }
  return [...set];
}

/** Estados con coordenadas definidas. */
export function estadosConGeo(): readonly string[] {
  return ESTADOS_VENEZUELA;
}
