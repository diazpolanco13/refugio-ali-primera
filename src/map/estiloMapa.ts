import type { StyleSpecification } from "maplibre-gl";

// Bases de mapa disponibles. Las de MapTiler ("*-hd", outdoor) requieren
// VITE_MAPTILER_KEY (clave gratuita) y solo aparecen si está configurada.
export type BaseMapa =
  | "calles"
  | "calles-claro"
  | "positron"
  | "osm"
  | "satelite"
  | "hibrido"
  | "topo"
  | "satelite-hd"
  | "calles-hd"
  | "outdoor";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
export const MAPTILER_DISPONIBLE = Boolean(MAPTILER_KEY);

/** Helper: subdominios CARTO (MapLibre no soporta {s}). */
function tilesCarto(path: string): string[] {
  return ["a", "b", "c", "d"].map(
    (s) => `https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}.png`,
  );
}

const openTopo = ["a", "b", "c"].map(
  (s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`,
);

/** Opciones que se muestran en la UI (MapTiler solo si hay clave). */
export const BASES_DISPONIBLES: { valor: BaseMapa; label: string }[] = [
  { valor: "calles", label: "🗺️ Calles" },
  { valor: "calles-claro", label: "🗺️ Calles claro" },
  { valor: "positron", label: "◻️ Positron" },
  { valor: "osm", label: "🌍 OpenStreetMap" },
  { valor: "satelite", label: "🛰️ Satélite" },
  { valor: "hibrido", label: "🛰️ Híbrido" },
  { valor: "topo", label: "🏔️ Topo" },
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
  "base-carto-dark",
  "base-carto-voyager",
  "base-carto-positron",
  "base-osm",
  "base-esri-img",
  "base-topo",
  "base-esri-transp",
  "base-esri-ref",
  "base-mt-sat",
  "base-mt-calles",
  "base-mt-outdoor",
] as const;

/** Qué capas base deben estar visibles para cada modo. */
export const VISIBILIDAD_BASE: Record<BaseMapa, string[]> = {
  // Oscuro por defecto — encaja con la UI de la app.
  calles: ["base-carto-dark"],
  "calles-claro": ["base-carto-voyager"],
  positron: ["base-carto-positron"],
  osm: ["base-osm"],
  satelite: ["base-esri-img"],
  hibrido: ["base-esri-img", "base-esri-transp", "base-esri-ref"],
  topo: ["base-topo"],
  "satelite-hd": ["base-mt-sat", "base-esri-transp", "base-esri-ref"],
  "calles-hd": ["base-mt-calles"],
  outdoor: ["base-mt-outdoor"],
};

export function construirEstilo(): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    "carto-dark": {
      type: "raster",
      tiles: tilesCarto("dark_all"),
      tileSize: 256,
      maxzoom: 20,
      attribution: "© OpenStreetMap contributors, © CARTO",
    },
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
    topo: {
      type: "raster",
      tiles: openTopo,
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenTopoMap (CC-BY-SA), © OpenStreetMap contributors",
    },
  };

  const layers: StyleSpecification["layers"] = [
    {
      id: "base-carto-dark",
      type: "raster",
      source: "carto-dark",
      layout: { visibility: "visible" },
    },
    {
      id: "base-carto-voyager",
      type: "raster",
      source: "carto-voyager",
      layout: { visibility: "none" },
    },
    {
      id: "base-carto-positron",
      type: "raster",
      source: "carto-positron",
      layout: { visibility: "none" },
    },
    { id: "base-osm", type: "raster", source: "osm", layout: { visibility: "none" } },
    { id: "base-esri-img", type: "raster", source: "esri-img", layout: { visibility: "none" } },
    { id: "base-topo", type: "raster", source: "topo", layout: { visibility: "none" } },
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
      { id: "base-mt-sat", type: "raster", source: "mt-sat", layout: { visibility: "none" } },
      { id: "base-mt-calles", type: "raster", source: "mt-calles", layout: { visibility: "none" } },
      {
        id: "base-mt-outdoor",
        type: "raster",
        source: "mt-outdoor",
        layout: { visibility: "none" },
      },
    );
  }

  layers.push(
    {
      id: "base-esri-transp",
      type: "raster",
      source: "esri-transp",
      layout: { visibility: "none" },
    },
    { id: "base-esri-ref", type: "raster", source: "esri-ref", layout: { visibility: "none" } },
  );

  return { version: 8, sources, layers };
}

/** Conjunto de claves válidas según las bases disponibles en este build. */
export const CLAVES_BASE_MAPA = new Set(BASES_DISPONIBLES.map((b) => b.valor));
