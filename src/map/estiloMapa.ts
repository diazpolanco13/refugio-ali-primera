import type { StyleSpecification } from "maplibre-gl";

// Bases de mapa disponibles. Todas las "base" sin sufijo funcionan sin clave.
// Las MapTiler ("*-hd") requieren VITE_MAPTILER_KEY (clave gratuita) y solo
// aparecen si está configurada.
export type BaseMapa =
  | "satelite"
  | "hibrido"
  | "calles"
  | "topo"
  | "satelite-hd"
  | "calles-hd";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
export const MAPTILER_DISPONIBLE = Boolean(MAPTILER_KEY);

/** Opciones que se muestran en la UI (las HD solo si hay clave MapTiler). */
export const BASES_DISPONIBLES: { valor: BaseMapa; label: string }[] = [
  { valor: "satelite", label: "🛰️ Satélite" },
  { valor: "hibrido", label: "🛰️ Híbrido" },
  { valor: "calles", label: "🗺️ Calles" },
  { valor: "topo", label: "🏔️ Topo" },
  ...(MAPTILER_DISPONIBLE
    ? ([
        { valor: "satelite-hd", label: "🛰️ Satélite HD" },
        { valor: "calles-hd", label: "🗺️ Calles HD" },
      ] as { valor: BaseMapa; label: string }[])
    : []),
];

// Subdominios de CARTO para repartir carga (MapLibre no soporta {s}).
const cartoVoyager = ["a", "b", "c", "d"].map(
  (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`,
);
const openTopo = ["a", "b", "c"].map(
  (s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`,
);

/** Capas base (raster) que se activan/desactivan según la base seleccionada. */
export const CAPAS_BASE = [
  "base-esri-img",
  "base-carto",
  "base-topo",
  "base-esri-transp",
  "base-esri-ref",
  "base-mt-sat",
  "base-mt-calles",
] as const;

/** Qué capas base deben estar visibles para cada modo. */
export const VISIBILIDAD_BASE: Record<BaseMapa, string[]> = {
  satelite: ["base-esri-img"],
  hibrido: ["base-esri-img", "base-esri-transp", "base-esri-ref"],
  calles: ["base-carto"],
  topo: ["base-topo"],
  "satelite-hd": ["base-mt-sat", "base-esri-transp", "base-esri-ref"],
  "calles-hd": ["base-mt-calles"],
};

export function construirEstilo(): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
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
    carto: {
      type: "raster",
      tiles: cartoVoyager,
      tileSize: 256,
      maxzoom: 20,
      attribution: "© OpenStreetMap contributors, © CARTO",
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
    { id: "base-esri-img", type: "raster", source: "esri-img", layout: { visibility: "visible" } },
    { id: "base-carto", type: "raster", source: "carto", layout: { visibility: "none" } },
    { id: "base-topo", type: "raster", source: "topo", layout: { visibility: "none" } },
  ];

  // Fuentes MapTiler opcionales (mejor detalle) si hay clave.
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
    layers.push(
      { id: "base-mt-sat", type: "raster", source: "mt-sat", layout: { visibility: "none" } },
      { id: "base-mt-calles", type: "raster", source: "mt-calles", layout: { visibility: "none" } },
    );
  }

  // Overlays de referencia (calles + nombres) para las vistas híbridas;
  // van encima de la imagen satelital.
  layers.push(
    { id: "base-esri-transp", type: "raster", source: "esri-transp", layout: { visibility: "none" } },
    { id: "base-esri-ref", type: "raster", source: "esri-ref", layout: { visibility: "none" } },
  );

  return { version: 8, sources, layers };
}
