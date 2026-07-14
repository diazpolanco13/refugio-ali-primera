import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

// Bases de mapa disponibles. Las de MapTiler ("*-hd", outdoor) requieren
// VITE_MAPTILER_KEY (clave gratuita) y solo aparecen si está configurada.
export type BaseMapa =
  | "dark-matter"
  | "calles-claro"
  | "positron"
  | "osm"
  | "hibrido"
  | "satelite-hd"
  | "calles-hd"
  | "outdoor";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
export const MAPTILER_DISPONIBLE = Boolean(MAPTILER_KEY);

/** Estilo vectorial Carto Dark Matter (GL). */
export const ESTILO_DARK_MATTER_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Tiles vectoriales OpenFreeMap (OpenMapTiles) para extrusión 3D. */
export const FUENTE_OPENFREEMAP_URL = "https://tiles.openfreemap.org/planet";
export const ID_FUENTE_EDIFICIOS_3D = "openfreemap";
export const ID_CAPA_EDIFICIOS_3D = "edificios-3d";

/** Capas planas de edificios del estilo Carto (se ocultan al activar 3D). */
const CAPAS_EDIFICIO_PLANAS_CARTO = ["building", "building-top"] as const;

/** Helper: subdominios CARTO (MapLibre no soporta {s}). */
function tilesCarto(path: string): string[] {
  return ["a", "b", "c", "d"].map(
    (s) => `https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}.png`,
  );
}

/** Opciones que se muestran en la UI (MapTiler solo si hay clave). */
export const BASES_DISPONIBLES: { valor: BaseMapa; label: string }[] = [
  { valor: "dark-matter", label: "🌑 Carto Dark Matter" },
  { valor: "calles-claro", label: "🗺️ Calles claro" },
  { valor: "positron", label: "◻️ Positron" },
  { valor: "osm", label: "🌍 OpenStreetMap" },
  { valor: "hibrido", label: "🛰️ Híbrido" },
  ...(MAPTILER_DISPONIBLE
    ? ([
        { valor: "satelite-hd", label: "🛰️ Satélite HD" },
        { valor: "calles-hd", label: "🗺️ Calles HD" },
        { valor: "outdoor", label: "🏕️ Outdoor" },
      ] as { valor: BaseMapa; label: string }[])
    : []),
];

/** Capas base (raster) que se activan/desactivan según la base seleccionada. */
export const CAPAS_BASE = [
  "base-carto-voyager",
  "base-carto-positron",
  "base-osm",
  "base-esri-img",
  "base-esri-transp",
  "base-esri-ref",
  "base-mt-sat",
  "base-mt-calles",
  "base-mt-outdoor",
] as const;

/** Qué capas base deben estar visibles para cada modo. */
export const VISIBILIDAD_BASE: Record<BaseMapa, string[]> = {
  "dark-matter": [],
  "calles-claro": ["base-carto-voyager"],
  positron: ["base-carto-positron"],
  osm: ["base-osm"],
  hibrido: ["base-esri-img", "base-esri-transp", "base-esri-ref"],
  "satelite-hd": ["base-mt-sat", "base-esri-transp", "base-esri-ref"],
  "calles-hd": ["base-mt-calles"],
  outdoor: ["base-mt-outdoor"],
};

/** True si la base carga un style.json externo (no el estilo raster compuesto). */
export function esBaseEstiloExterno(base: BaseMapa): boolean {
  return base === "dark-matter";
}

/** Estilo inicial / al cambiar de base: URL externa o especificación raster. */
export function estiloMapaParaBase(base: BaseMapa): string | StyleSpecification {
  if (base === "dark-matter") return ESTILO_DARK_MATTER_URL;
  return construirEstilo(base);
}

/**
 * Rango de zoom del fade-in de los edificios 3D (ver `fill-extrusion-opacity`
 * abajo): invisibles hasta este punto, opacidad plena al llegar al segundo.
 * Las etiquetas de nombre de los marcadores (`escalaVista.ts`) usan el mismo
 * rango para aparecer "en la misma proporción" — una sola fuente de verdad.
 */
export const ZOOM_INICIO_FADE_EDIFICIOS_3D = 14;
export const ZOOM_FIN_FADE_EDIFICIOS_3D = 14.5;

/**
 * Fuente OpenFreeMap + capa fill-extrusion. Visible por defecto.
 * Idempotente. Colores pensados para contrastar sobre Dark Matter.
 */
export function asegurarEdificios3d(map: MapLibreMap): void {
  for (const id of CAPAS_EDIFICIO_PLANAS_CARTO) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", "none");
    }
  }

  if (!map.getSource(ID_FUENTE_EDIFICIOS_3D)) {
    map.addSource(ID_FUENTE_EDIFICIOS_3D, {
      type: "vector",
      url: FUENTE_OPENFREEMAP_URL,
    });
  }

  if (map.getLayer(ID_CAPA_EDIFICIOS_3D)) {
    map.setLayoutProperty(ID_CAPA_EDIFICIOS_3D, "visibility", "visible");
    return;
  }

  const layers = map.getStyle().layers ?? [];
  let beforeId: string | undefined;
  for (const layer of layers) {
    const layout = layer.layout as Record<string, unknown> | undefined;
    if (layer.type === "symbol" && layout && "text-field" in layout) {
      beforeId = layer.id;
      break;
    }
  }

  // Nota: `zoom` solo vale como input de `interpolate`/`step` de primer nivel.
  // No usar `zoom` dentro de `case` (MapLibre lanza y la capa no se crea).
  map.addLayer(
    {
      id: ID_CAPA_EDIFICIOS_3D,
      source: ID_FUENTE_EDIFICIOS_3D,
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: ZOOM_INICIO_FADE_EDIFICIOS_3D,
      filter: ["!=", ["get", "hide_3d"], true],
      layout: { visibility: "visible" },
      paint: {
        // Ramp por altura con los mismos acentos que los pines de unidad SEBIN
        // (slate "sin unidad" → teal de marca → azul/violeta/magenta): las
        // estructuras bajas quedan en un tono neutro que se funde con el fondo,
        // y cada tramo de altura resalta en el acento que ya usan tarjetas/badges.
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], 0],
          0,
          "#334155",
          15,
          "#0d9488",
          50,
          "#2563eb",
          120,
          "#7c3aed",
          200,
          "#db2777",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15,
          ["coalesce", ["get", "render_height"], 5],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          15,
          ["coalesce", ["get", "render_min_height"], 0],
        ],
        // Fade-in con el zoom (igual que Osiris): opacidad 0 justo al cruzar
        // minzoom y sube a la opacidad plena a medio nivel de zoom, para que
        // los edificios se "materialicen" en vez de aparecer de golpe.
        "fill-extrusion-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          ZOOM_INICIO_FADE_EDIFICIOS_3D,
          0,
          ZOOM_FIN_FADE_EDIFICIOS_3D,
          0.85,
        ],
      },
    },
    beforeId,
  );
}

/** Activa o desactiva extrusión 3D sobre Carto Dark Matter (idempotente). */
export function aplicarEdificios3d(map: MapLibreMap, activo: boolean): void {
  if (activo) {
    asegurarEdificios3d(map);
    return;
  }

  if (map.getLayer(ID_CAPA_EDIFICIOS_3D)) {
    map.setLayoutProperty(ID_CAPA_EDIFICIOS_3D, "visibility", "none");
  }
  for (const id of CAPAS_EDIFICIO_PLANAS_CARTO) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", "visible");
    }
  }
}

/** Bases del selector rápido MAP / SAT (híbrido con calles). */
export const BASE_MAPA_CARTO: BaseMapa = "dark-matter";
export const BASE_MAPA_SATELITE: BaseMapa = "hibrido";

/** Base al primer ingreso (sin preferencia guardada en localStorage). */
export const BASE_MAPA_DEFECTO: BaseMapa = BASE_MAPA_CARTO;

export function construirEstilo(baseActiva: BaseMapa = "hibrido"): StyleSpecification {
  const visibles = new Set(VISIBILIDAD_BASE[baseActiva] ?? VISIBILIDAD_BASE.hibrido);
  const vis = (id: string): "visible" | "none" =>
    visibles.has(id) ? "visible" : "none";

  const sources: StyleSpecification["sources"] = {
    "carto-voyager": {
      type: "raster",
      tiles: tilesCarto("rastertiles/voyager"),
      tileSize: 256,
      maxzoom: 20,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
    "carto-positron": {
      type: "raster",
      tiles: tilesCarto("light_all"),
      tileSize: 256,
      maxzoom: 20,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
    "esri-img": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    "esri-transp": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
    "esri-ref": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
    },
  };

  const layers: StyleSpecification["layers"] = [
    {
      id: "base-carto-voyager",
      type: "raster",
      source: "carto-voyager",
      layout: { visibility: vis("base-carto-voyager") },
    },
    {
      id: "base-carto-positron",
      type: "raster",
      source: "carto-positron",
      layout: { visibility: vis("base-carto-positron") },
    },
    {
      id: "base-osm",
      type: "raster",
      source: "osm",
      layout: { visibility: vis("base-osm") },
    },
    {
      id: "base-esri-img",
      type: "raster",
      source: "esri-img",
      layout: { visibility: vis("base-esri-img") },
    },
  ];

  if (MAPTILER_DISPONIBLE) {
    sources["mt-sat"] = {
      type: "raster",
      tiles: [
        `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`,
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© MapTiler © OpenStreetMap contributors",
    };
    sources["mt-calles"] = {
      type: "raster",
      tiles: [
        `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© MapTiler © OpenStreetMap contributors",
    };
    sources["mt-outdoor"] = {
      type: "raster",
      tiles: [
        `https://api.maptiler.com/maps/outdoor-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
      ],
      tileSize: 256,
      maxzoom: 20,
      attribution: "© MapTiler © OpenStreetMap contributors",
    };
    layers.push(
      {
        id: "base-mt-sat",
        type: "raster",
        source: "mt-sat",
        layout: { visibility: vis("base-mt-sat") },
      },
      {
        id: "base-mt-calles",
        type: "raster",
        source: "mt-calles",
        layout: { visibility: vis("base-mt-calles") },
      },
      {
        id: "base-mt-outdoor",
        type: "raster",
        source: "mt-outdoor",
        layout: { visibility: vis("base-mt-outdoor") },
      },
    );
  }

  layers.push(
    {
      id: "base-esri-transp",
      type: "raster",
      source: "esri-transp",
      layout: { visibility: vis("base-esri-transp") },
    },
    {
      id: "base-esri-ref",
      type: "raster",
      source: "esri-ref",
      layout: { visibility: vis("base-esri-ref") },
    },
  );

  return { version: 8, sources, layers };
}

/** Conjunto de claves válidas según las bases disponibles en este build. */
export const CLAVES_BASE_MAPA = new Set(BASES_DISPONIBLES.map((b) => b.valor));
