import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl from "maplibre-gl";
import { MarcadorPunto } from "./MarcadorPunto";
import { MarcadorSector } from "./MarcadorSector";
import { PreviewSectorDatos } from "./PreviewSectorDatos";
import {
  aplicarTransformEscala,
  escalaMarcadorPorZoom,
  esVistaCompacta,
  MK_ESCALA_SELECTOR,
  ocultarNombreSector,
} from "./escalaMarcadores";
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
} from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { CAPAS_BASE, VISIBILIDAD_BASE, construirEstilo } from "./estiloMapa";
import {
  ESTADO_SECTOR_COLOR,
  GENERO_ICONO,
  GENERO_LABEL,
  META_POR_TIPO,
  MOVILIDAD_ICONO,
  MOVILIDAD_LABEL,
  PARQUE_CENTRO,
  type LineaReferencia,
  type PuntoServicio,
  type Sector,
  type TipoLinea,
  type TipoPunto,
} from "../domain/tipos";
import { ESTADOS_PUNTO } from "../domain/tipos";
import { estadoSector } from "../domain/brechas";
import { infoLimpieza, textoLimpieza } from "../domain/limpieza";
import { cargarVista, guardarVista, VISTA_DEFECTO } from "../data/preferencias";

export type { BaseMapa } from "./estiloMapa";
import type { BaseMapa } from "./estiloMapa";
export type ModoDibujo =
  | "none"
  | "poligono"
  | "rectangulo"
  | "punto"
  | "linea_limite"
  | "linea_calle"
  | "linea_camineria";

const CAPAS_LINEA = ["lineas-solido", "lineas-punteado", "lineas-guiones"] as const;

interface Props {
  sectores: Sector[];
  puntos: PuntoServicio[];
  lineas: LineaReferencia[];
  capasVisibles: Set<TipoPunto>;
  lineasVisibles: Set<TipoLinea>;
  mostrarSectores: boolean;
  mostrarLineas: boolean;
  baseMapa: BaseMapa;
  modoDibujo: ModoDibujo;
  modoEdicion: boolean;
  ahora: number;
  onSectorDibujado: (geom: GeoJSON.Polygon) => void;
  onPuntoDibujado: (geom: GeoJSON.Point) => void;
  onLineaDibujada: (geom: GeoJSON.LineString) => void;
  onSeleccionarSector: (id: string) => void;
  onSeleccionarPunto: (id: string) => void;
  onSeleccionarLinea: (id: string) => void;
  onMoverPunto: (id: string, coords: [number, number]) => void;
  onEditarSectorGeom: (id: string, geom: GeoJSON.Polygon) => void;
  onEditarLineaGeom: (id: string, geom: GeoJSON.LineString) => void;
  onVistaCambio?: (zoom: number) => void;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MapViewHandle {
  setZoom: (z: number) => void;
  volverAlParque: () => void;
}

function centroide(poligono: GeoJSON.Polygon | undefined): [number, number] {
  if (!poligono?.coordinates) return PARQUE_CENTRO;
  const anillo = poligono.coordinates[0] ?? [];
  const pts = anillo.slice(0, -1); // quitar cierre duplicado
  if (pts.length === 0) return PARQUE_CENTRO;
  const sum = pts.reduce(
    (a, p) => [a[0] + p[0], a[1] + p[1]],
    [0, 0] as [number, number],
  );
  return [sum[0] / pts.length, sum[1] / pts.length];
}

const estadoColor = (estado: string): string =>
  ESTADOS_PUNTO.find((e) => e.valor === estado)?.color ?? "#94a3b8";

/** Número visible en el marcador (capacidad). */
function numeroPunto(p: PuntoServicio): string {
  return p.capacidad > 0 ? String(p.capacidad) : "";
}

/** Título corto para el marcador del punto. */
function tituloPunto(p: PuntoServicio): string {
  const meta = META_POR_TIPO[p.tipo];
  const n = p.nombre?.trim();
  if (n && n !== meta.label) return n;
  if (p.tipo === "seguridad" && p.organismo?.trim()) return p.organismo.trim();
  return meta.label.split(" / ")[0];
}

/** Segunda línea: cantidad + unidad (+ organismo/movilidad en seguridad). */
function detallePunto(p: PuntoServicio): string {
  const meta = META_POR_TIPO[p.tipo];
  const parts: string[] = [];
  if (p.capacidad > 0) {
    parts.push(`${p.capacidad}${meta.unidadCapacidad ? " " + meta.unidadCapacidad : ""}`);
  }
  if (p.tipo === "seguridad") {
    const org = p.organismo?.trim();
    if (org && tituloPunto(p) !== org) parts.push(org);
    if (p.movilidad) {
      parts.push(
        `${MOVILIDAD_ICONO[p.movilidad] ?? ""} ${MOVILIDAD_LABEL[p.movilidad] ?? ""}`.trim(),
      );
    }
  }
  if (p.tipo === "sanitarios" || p.tipo === "duchas") {
    if (p.genero) {
      parts.push(`${GENERO_ICONO[p.genero] ?? ""} ${GENERO_LABEL[p.genero] ?? ""}`.trim());
    }
    if (p.condicion === "improvisada") parts.push("⚠️ Improvisada");
    else if (p.condicion === "estandar") parts.push("✓ Estándar");
  }
  return parts.join(" · ");
}

export const MapView = forwardRef<MapViewHandle, Props>(function MapView(props, ref) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const listoRef = useRef(false);
  const marcadoresSector = useRef<Map<string, maplibregl.Marker>>(new Map());
  const marcadoresPunto = useRef<Map<string, maplibregl.Marker>>(new Map());
  const rootsSector = useRef<Map<string, Root>>(new Map());
  const rootsPunto = useRef<Map<string, Root>>(new Map());
  const zoomRef = useRef(cargarVista().zoom);
  const compactoRef = useRef(esVistaCompacta(cargarVista().zoom));
  const popupSectorRef = useRef<maplibregl.Popup | null>(null);
  const popupSectorRootRef = useRef<Root | null>(null);
  const popupSectorIdRef = useRef<string | null>(null);

  // Refs a callbacks para no re-registrar listeners.
  const cbRef = useRef(props);
  cbRef.current = props;

  function aplicarEscalaVista(zoom: number) {
    zoomRef.current = zoom;
    const escala = escalaMarcadorPorZoom(zoom);
    const compacto = esVistaCompacta(zoom);
    const compactoCambio = compacto !== compactoRef.current;
    compactoRef.current = compacto;
    const ocultarSectores = ocultarNombreSector(zoom);

    for (const [id, m] of marcadoresPunto.current) {
      const escalaEl = m.getElement().querySelector<HTMLElement>(MK_ESCALA_SELECTOR);
      if (escalaEl) aplicarTransformEscala(escalaEl, escala);
      if (compactoCambio) {
        const p = cbRef.current.puntos.find((x) => x.id === id);
        if (p) rootsPunto.current.get(id)?.render(renderMarcadorPunto(p, compacto));
      }
    }

    for (const [id, m] of marcadoresSector.current) {
      const anchor = m.getElement();
      const escalaEl = anchor.querySelector<HTMLElement>(MK_ESCALA_SELECTOR);
      if (escalaEl) aplicarTransformEscala(escalaEl, escala);
      const s = cbRef.current.sectores.find((x) => x.id === id);
      if (!s) continue;
      const visible =
        cbRef.current.mostrarSectores &&
        !cbRef.current.modoEdicion &&
        !ocultarSectores;
      anchor.style.display = visible ? "block" : "none";
    }
  }

  function crearAnchorMarcador(): HTMLDivElement {
    const anchor = document.createElement("div");
    anchor.className = "map-mk-anchor";
    const escala = document.createElement("div");
    escala.className = "map-mk-scale";
    anchor.appendChild(escala);
    return anchor;
  }

  function mountMarcador(anchor: HTMLDivElement): HTMLDivElement {
    const escala = anchor.querySelector(MK_ESCALA_SELECTOR);
    if (!escala) throw new Error("map-mk-scale ausente");
    const mount = document.createElement("div");
    escala.appendChild(mount);
    return mount;
  }

  function renderMarcadorPunto(p: PuntoServicio, compacto = esVistaCompacta(zoomRef.current)) {
    const meta = META_POR_TIPO[p.tipo];
    let ringColor = estadoColor(p.estado);
    if (p.estado !== "fuera_servicio") {
      const li = infoLimpieza(p, cbRef.current.ahora);
      if (li && li.estado !== "sin_programar") ringColor = li.color;
    }
    return (
      <MarcadorPunto
        icono={meta.icono}
        color={meta.color}
        ringColor={ringColor}
        numero={numeroPunto(p)}
        titulo={tituloPunto(p)}
        detalle={detallePunto(p)}
        limpieza={textoLimpieza(p, cbRef.current.ahora) ?? ""}
        fueraServicio={p.estado === "fuera_servicio"}
        compacto={compacto}
        cursor={cbRef.current.modoEdicion ? "move" : "pointer"}
        onClick={() => {
          if (cbRef.current.modoDibujo !== "none" || cbRef.current.modoEdicion) return;
          cbRef.current.onSeleccionarPunto(p.id);
        }}
      />
    );
  }

  function renderMarcadorSector(s: Sector) {
    const colorSector = s.color || "#2dd4bf";
    const estado = estadoSector(s, cbRef.current.puntos);
    const colorEstado = ESTADO_SECTOR_COLOR[estado];
    return (
      <MarcadorSector
        sector={s}
        colorSector={colorSector}
        colorEstado={colorEstado}
        estado={estado}
      />
    );
  }

  function puedePrevisualizarSector(): boolean {
    return (
      cbRef.current.mostrarSectores &&
      !cbRef.current.modoEdicion &&
      cbRef.current.modoDibujo === "none"
    );
  }

  function ocultarPreviewPoligono(): void {
    popupSectorRef.current?.remove();
    popupSectorRootRef.current?.unmount();
    popupSectorRootRef.current = null;
    popupSectorIdRef.current = null;
  }

  function mostrarPreviewPoligono(sector: Sector): void {
    const map = mapRef.current;
    if (!map) return;
    if (popupSectorIdRef.current === sector.id) return;

    ocultarPreviewPoligono();

    const mount = document.createElement("div");
    const root = createRoot(mount);
    popupSectorRootRef.current = root;
    popupSectorIdRef.current = sector.id;

    const estado = estadoSector(sector, cbRef.current.puntos);
    root.render(
      <PreviewSectorDatos
        sector={sector}
        colorEstado={ESTADO_SECTOR_COLOR[estado]}
        estado={estado}
        mostrarAccion
      />,
    );

    if (!popupSectorRef.current) {
      popupSectorRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        className: "sector-preview-popup",
        maxWidth: "260px",
      });
    }

    popupSectorRef.current
      .setDOMContent(mount)
      .setLngLat(centroide(sector.geom))
      .addTo(map);
  }

  function desmontarRoot(roots: Map<string, Root>, id: string) {
    const root = roots.get(id);
    if (root) {
      root.unmount();
      roots.delete(id);
    }
  }

  // --- Inicialización única del mapa ---
  useEffect(() => {
    if (!contenedorRef.current || mapRef.current) return;
    const vista = cargarVista();
    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: construirEstilo(),
      center: vista.center,
      zoom: vista.zoom,
      maxZoom: 20,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // Persistir la vista (centro + zoom) en localStorage al mover/hacer zoom.
    map.on("moveend", () => {
      const c = map.getCenter();
      const zoom = map.getZoom();
      guardarVista({ center: [c.lng, c.lat], zoom });
      cbRef.current.onVistaCambio?.(zoom);
    });

    map.on("zoom", () => aplicarEscalaVista(map.getZoom()));

    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      // Líneas de referencia (debajo de sectores; sin relleno).
      map.addSource("lineas-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "lineas-solido",
        type: "line",
        source: "lineas-src",
        filter: ["==", ["get", "estilo"], "solido"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "ancho"],
        },
      });
      map.addLayer({
        id: "lineas-punteado",
        type: "line",
        source: "lineas-src",
        filter: ["==", ["get", "estilo"], "punteado"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "ancho"],
          "line-dasharray": [2, 3],
        },
      });
      map.addLayer({
        id: "lineas-guiones",
        type: "line",
        source: "lineas-src",
        filter: ["==", ["get", "estilo"], "guiones"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": ["get", "ancho"],
          "line-dasharray": [6, 4],
        },
      });
      for (const capa of CAPAS_LINEA) {
        map.on("click", capa, (e) => {
          if (cbRef.current.modoDibujo !== "none" || cbRef.current.modoEdicion) return;
          const f = e.features?.[0];
          const id = f?.properties?.id as string | undefined;
          if (id) cbRef.current.onSeleccionarLinea(id);
        });
        map.on("mouseenter", capa, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", capa, () => (map.getCanvas().style.cursor = ""));
      }

      // Fuentes de datos.
      map.addSource("sectores-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "sectores-fill",
        type: "fill",
        source: "sectores-src",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.18,
        },
      });
      map.addLayer({
        id: "sectores-line",
        type: "line",
        source: "sectores-src",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2.5,
        },
      });
      // Interacción (los puntos son marcadores HTML con su propio click).
      map.on("click", "sectores-fill", (e) => {
        // No abrir editor al dibujar ni al editar vértices (lo maneja Terra Draw).
        if (cbRef.current.modoDibujo !== "none" || cbRef.current.modoEdicion) return;
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        if (id) cbRef.current.onSeleccionarSector(id);
      });
      map.on("mouseenter", "sectores-fill", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "sectores-fill", () => {
        map.getCanvas().style.cursor = "";
        ocultarPreviewPoligono();
      });

      // Preview al pasar el mouse sobre el polígono (solo escritorio).
      if (!window.matchMedia("(pointer: coarse)").matches) {
        map.on("mousemove", "sectores-fill", (e) => {
          if (!puedePrevisualizarSector()) {
            ocultarPreviewPoligono();
            return;
          }
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (!id) return;
          const sector = cbRef.current.sectores.find((x) => x.id === id);
          if (sector) mostrarPreviewPoligono(sector);
        });
      }

      // Terra Draw para crear geometrías nuevas.
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPointMode({
            styles: {
              pointColor: "#14b8a6",
              pointWidth: 7,
              pointOutlineColor: "#ffffff",
              pointOutlineWidth: 2,
            },
          }),
          // Rectángulo: 2 clics (esquina y esquina). Fácil para cuadrantes.
          new TerraDrawRectangleMode({
            styles: {
              fillColor: "#14b8a6",
              fillOpacity: 0.12,
              outlineColor: "#2dd4bf",
              outlineWidth: 3,
            },
          }),
          // Polígono irregular: clic por vértice; doble clic o Enter para cerrar.
          new TerraDrawPolygonMode({
            styles: {
              fillColor: "#14b8a6",
              fillOpacity: 0.12,
              outlineColor: "#2dd4bf",
              outlineWidth: 3,
              closingPointColor: "#f59e0b",
              closingPointWidth: 7,
              closingPointOutlineColor: "#ffffff",
              closingPointOutlineWidth: 2,
            },
          }),
          // Línea: clic por vértice; doble clic o Enter para terminar.
          new TerraDrawLineStringMode({
            styles: {
              lineStringColor: "#2dd4bf",
              lineStringWidth: 3,
              closingPointColor: "#f59e0b",
              closingPointWidth: 7,
              closingPointOutlineColor: "#ffffff",
              closingPointOutlineWidth: 2,
            },
          }),
          // Selección/edición de vértices de sectores y líneas existentes.
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, midpoints: true, deletable: true },
                },
              },
              linestring: {
                feature: {
                  draggable: true,
                  coordinates: { draggable: true, midpoints: true, deletable: true },
                },
              },
            },
          }),
        ],
      });
      draw.start();
      draw.on("finish", (id) => {
        // En modo edición, los cambios se guardan por el evento "change".
        // "finish" también se dispara al editar vértices en select: ignorarlo.
        if (cbRef.current.modoEdicion) return;
        const feature = draw
          .getSnapshot()
          .find((f) => f.id === id);
        if (feature) {
          const geom = feature.geometry;
          if (geom.type === "Polygon") {
            cbRef.current.onSectorDibujado(geom as GeoJSON.Polygon);
          } else if (geom.type === "Point") {
            cbRef.current.onPuntoDibujado(geom as GeoJSON.Point);
          } else if (geom.type === "LineString") {
            cbRef.current.onLineaDibujada(geom as GeoJSON.LineString);
          }
        }
        draw.clear();
        draw.setMode("static");
      });
      // Al editar vértices en modo edición, guardar la nueva geometría.
      draw.on("change", (ids, type) => {
        if (!cbRef.current.modoEdicion || type !== "update") return;
        const snap = draw.getSnapshot();
        for (const id of ids) {
          const f = snap.find((x) => x.id === id);
          if (f && f.geometry.type === "Polygon") {
            cbRef.current.onEditarSectorGeom(String(id), f.geometry as GeoJSON.Polygon);
          } else if (f && f.geometry.type === "LineString") {
            cbRef.current.onEditarLineaGeom(String(id), f.geometry as GeoJSON.LineString);
          }
        }
      });
      drawRef.current = draw;

      listoRef.current = true;
      sincronizarLineas();
      sincronizarSectores();
      sincronizarPuntos();
      aplicarFiltros();
      aplicarEscalaVista(map.getZoom());
    });

    return () => {
      ocultarPreviewPoligono();
      popupSectorRef.current = null;
      for (const [, root] of rootsSector.current) root.unmount();
      rootsSector.current.clear();
      for (const [, root] of rootsPunto.current) root.unmount();
      rootsPunto.current.clear();
      marcadoresSector.current.forEach((m) => m.remove());
      marcadoresSector.current.clear();
      marcadoresPunto.current.forEach((m) => m.remove());
      marcadoresPunto.current.clear();
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
      listoRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Sincronización de datos ---
  function sincronizarLineas() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const src = map.getSource("lineas-src") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = [];
    for (const l of cbRef.current.lineas) {
      if (!l.geom?.coordinates?.length) {
        console.warn(`[mapa] Línea ${l.id}: geometría ausente — se omite`);
        continue;
      }
      features.push({
        type: "Feature",
        geometry: l.geom,
        properties: {
          id: l.id,
          tipo: l.tipo,
          color: l.color,
          estilo: l.estilo,
          ancho: l.ancho,
        },
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }

  function sincronizarSectores() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const src = map.getSource("sectores-src") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features: GeoJSON.Feature[] = [];
    for (const s of cbRef.current.sectores) {
      if (!s.geom?.coordinates) {
        console.warn(`[mapa] Sector ${s.id}: geometría ausente — se omite`);
        continue;
      }
      features.push({
        type: "Feature",
        geometry: s.geom,
        properties: {
          id: s.id,
          color: s.color || "#2dd4bf",
        },
      });
    }
    src.setData({ type: "FeatureCollection", features });

    // Marcadores HTML con el nombre del sector (Badge shadcn) y semáforo de cobertura.
    const vistos = new Set<string>();
    const ocultarSectores = ocultarNombreSector(zoomRef.current);
    for (const s of cbRef.current.sectores) {
      if (!s.geom?.coordinates) continue;
      vistos.add(s.id);
      let marcador = marcadoresSector.current.get(s.id);
      if (!marcador) {
        const anchor = crearAnchorMarcador();
        const root = createRoot(mountMarcador(anchor));
        rootsSector.current.set(s.id, root);
        marcador = new maplibregl.Marker({ element: anchor }).setLngLat(
          centroide(s.geom),
        );
        marcador.addTo(map);
        marcadoresSector.current.set(s.id, marcador);
      }
      const anchor = marcador.getElement();
      anchor.style.display =
        cbRef.current.mostrarSectores &&
        !cbRef.current.modoEdicion &&
        !ocultarSectores
          ? "block"
          : "none";
      rootsSector.current.get(s.id)?.render(renderMarcadorSector(s));
      marcador.setLngLat(centroide(s.geom));
    }
    if (popupSectorIdRef.current) {
      const activo = cbRef.current.sectores.find((x) => x.id === popupSectorIdRef.current);
      if (activo && popupSectorRootRef.current) {
        const estado = estadoSector(activo, cbRef.current.puntos);
        popupSectorRootRef.current.render(
          <PreviewSectorDatos
            sector={activo}
            colorEstado={ESTADO_SECTOR_COLOR[estado]}
            estado={estado}
            mostrarAccion
          />,
        );
      } else {
        ocultarPreviewPoligono();
      }
    }
    for (const [id, m] of marcadoresSector.current) {
      if (!vistos.has(id)) {
        desmontarRoot(rootsSector.current, id);
        m.remove();
        marcadoresSector.current.delete(id);
      }
    }
  }

  function sincronizarPuntos() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const vistos = new Set<string>();
    for (const p of cbRef.current.puntos) {
      const meta = META_POR_TIPO[p.tipo];
      if (!meta) {
        // Un punto con tipo desconocido (dato corrupto o de una versión previa)
        // NO debe tumbar todo el mapa. Lo omitimos y avisamos en consola para
        // poder ubicarlo y corregirlo.
        console.warn(`[mapa] Punto ${p.id}: tipo desconocido "${p.tipo}" — se omite`);
        continue;
      }
      if (!p.geom?.coordinates) {
        // Mismo caso que el tipo desconocido: geometría corrupta o ausente
        // (dato de sync parcial) no debe tumbar el mapa.
        console.warn(`[mapa] Punto ${p.id}: geometría ausente — se omite`);
        continue;
      }
      vistos.add(p.id);
      const coords = p.geom.coordinates as [number, number];

      let marcador = marcadoresPunto.current.get(p.id);
      if (!marcador) {
        const anchor = crearAnchorMarcador();
        const root = createRoot(mountMarcador(anchor));
        rootsPunto.current.set(p.id, root);
        marcador = new maplibregl.Marker({ element: anchor }).setLngLat(coords);
        marcador.on("dragend", () => {
          const ll = marcador!.getLngLat();
          cbRef.current.onMoverPunto(p.id, [ll.lng, ll.lat]);
        });
        marcador.addTo(map);
        marcadoresPunto.current.set(p.id, marcador);
      }
      marcador.setDraggable(cbRef.current.modoEdicion);
      rootsPunto.current
        .get(p.id)
        ?.render(renderMarcadorPunto(p, esVistaCompacta(zoomRef.current)));
      marcador.getElement().style.display = cbRef.current.capasVisibles.has(p.tipo)
        ? "block"
        : "none";
      marcador.setLngLat(coords);
    }
    for (const [id, m] of marcadoresPunto.current) {
      if (!vistos.has(id)) {
        desmontarRoot(rootsPunto.current, id);
        m.remove();
        marcadoresPunto.current.delete(id);
      }
    }
  }

  function aplicarFiltros() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    // Visibilidad de puntos por capa.
    for (const [id, m] of marcadoresPunto.current) {
      const p = cbRef.current.puntos.find((x) => x.id === id);
      if (!p) continue;
      m.getElement().style.display = cbRef.current.capasVisibles.has(p.tipo)
        ? "block"
        : "none";
    }
    // Durante la edición, Terra Draw dibuja sectores y líneas (ocultamos los propios).
    const visSectores =
      cbRef.current.mostrarSectores && !cbRef.current.modoEdicion ? "visible" : "none";
    map.setLayoutProperty("sectores-fill", "visibility", visSectores);
    map.setLayoutProperty("sectores-line", "visibility", visSectores);

    const visLineas =
      cbRef.current.mostrarLineas && !cbRef.current.modoEdicion ? "visible" : "none";
    for (const capa of CAPAS_LINEA) {
      map.setLayoutProperty(capa, "visibility", visLineas);
    }

    const tipos = [...cbRef.current.lineasVisibles];
    const filtroTipo: maplibregl.FilterSpecification =
      tipos.length > 0
        ? ["in", ["get", "tipo"], ["literal", tipos]]
        : ["==", ["get", "tipo"], ""];

    const estiloPorCapa: Record<(typeof CAPAS_LINEA)[number], string> = {
      "lineas-solido": "solido",
      "lineas-punteado": "punteado",
      "lineas-guiones": "guiones",
    };
    for (const capa of CAPAS_LINEA) {
      map.setFilter(capa, ["all", ["==", ["get", "estilo"], estiloPorCapa[capa]], filtroTipo]);
    }
    if (!puedePrevisualizarSector()) ocultarPreviewPoligono();
  }

  useEffect(() => {
    sincronizarLineas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.lineas, props.mostrarLineas]);

  useEffect(() => {
    sincronizarSectores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sectores, props.puntos, props.mostrarSectores]);

  useEffect(() => {
    sincronizarPuntos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.puntos, props.ahora]);

  useEffect(() => {
    aplicarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.capasVisibles, props.mostrarSectores, props.mostrarLineas, props.lineasVisibles]);

  // --- Modo edición de ubicaciones (arrastrar puntos y vértices de sectores) ---
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw || !listoRef.current) return;

    if (props.modoEdicion) {
      draw.clear();
      const poligonos = cbRef.current.sectores
        .filter((s) => UUID_RE.test(s.id) && s.geom?.coordinates)
        .map((s) => ({
          id: s.id,
          type: "Feature" as const,
          geometry: s.geom,
          properties: { mode: "polygon" },
        }));
      const trazos = cbRef.current.lineas
        .filter((l) => UUID_RE.test(l.id) && l.geom?.coordinates?.length)
        .map((l) => ({
          id: l.id,
          type: "Feature" as const,
          geometry: l.geom,
          properties: { mode: "linestring" },
        }));
      const features = [...poligonos, ...trazos];
      try {
        if (features.length) draw.addFeatures(features);
      } catch {
        // ids no válidos para Terra Draw; se ignora.
      }
      draw.setMode("select");
    } else {
      draw.clear();
      draw.setMode("static");
    }

    // Puntos arrastrables solo en modo edición.
    for (const [, m] of marcadoresPunto.current) {
      m.setDraggable(props.modoEdicion);
    }

    sincronizarLineas();
    sincronizarPuntos();
    sincronizarSectores();
    aplicarFiltros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.modoEdicion]);

  // --- Base del mapa (satélite / híbrido / calles / topo / HD) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const visibles = new Set(VISIBILIDAD_BASE[props.baseMapa] ?? []);
    for (const capa of CAPAS_BASE) {
      if (!map.getLayer(capa)) continue;
      map.setLayoutProperty(
        capa,
        "visibility",
        visibles.has(capa) ? "visible" : "none",
      );
    }
  }, [props.baseMapa]);

  // --- Modo de dibujo ---
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    if (props.modoDibujo === "poligono") draw.setMode("polygon");
    else if (props.modoDibujo === "rectangulo") draw.setMode("rectangle");
    else if (props.modoDibujo === "punto") draw.setMode("point");
    else if (
      props.modoDibujo === "linea_limite" ||
      props.modoDibujo === "linea_calle" ||
      props.modoDibujo === "linea_camineria"
    )
      draw.setMode("linestring");
    else draw.setMode("static");
  }, [props.modoDibujo]);

  // API imperativa para el control de zoom desde la UI.
  useImperativeHandle(ref, () => ({
    setZoom: (z: number) => {
      mapRef.current?.easeTo({ zoom: z, duration: 200 });
    },
    volverAlParque: () => {
      mapRef.current?.flyTo({
        center: VISTA_DEFECTO.center,
        zoom: VISTA_DEFECTO.zoom,
        duration: 600,
      });
    },
  }));

  return <div ref={contenedorRef} className="h-full w-full" />;
});
