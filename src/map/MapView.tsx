import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl from "maplibre-gl";
import {
  TerraDraw,
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
  type PuntoServicio,
  type Sector,
  type TipoPunto,
} from "../domain/tipos";
import { ESTADOS_PUNTO } from "../domain/tipos";
import { estadoSector } from "../domain/brechas";
import { infoLimpieza, textoLimpieza } from "../domain/limpieza";
import { cargarVista, guardarVista, VISTA_DEFECTO } from "../data/preferencias";

export type { BaseMapa } from "./estiloMapa";
import type { BaseMapa } from "./estiloMapa";
export type ModoDibujo = "none" | "poligono" | "rectangulo" | "punto";

interface Props {
  sectores: Sector[];
  puntos: PuntoServicio[];
  capasVisibles: Set<TipoPunto>;
  mostrarSectores: boolean;
  baseMapa: BaseMapa;
  modoDibujo: ModoDibujo;
  modoEdicion: boolean;
  ahora: number;
  onSectorDibujado: (geom: GeoJSON.Polygon) => void;
  onPuntoDibujado: (geom: GeoJSON.Point) => void;
  onSeleccionarSector: (id: string) => void;
  onSeleccionarPunto: (id: string) => void;
  onMoverPunto: (id: string, coords: [number, number]) => void;
  onEditarSectorGeom: (id: string, geom: GeoJSON.Polygon) => void;
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

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  // Refs a callbacks para no re-registrar listeners.
  const cbRef = useRef(props);
  cbRef.current = props;

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

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserLocation: true,
      }),
      "top-right",
    );
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
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
      map.on("mouseleave", "sectores-fill", () => (map.getCanvas().style.cursor = ""));

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
          // Selección/edición de vértices de sectores existentes.
          new TerraDrawSelectMode({
            flags: {
              polygon: {
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
          }
        }
      });
      drawRef.current = draw;

      listoRef.current = true;
      sincronizarSectores();
      sincronizarPuntos();
      aplicarFiltros();
    });

    return () => {
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

    // Marcadores HTML con el nombre del sector (color personalizado) y un
    // puntito con el estado (semáforo de cobertura).
    const vistos = new Set<string>();
    for (const s of cbRef.current.sectores) {
      if (!s.geom?.coordinates) continue;
      vistos.add(s.id);
      const colorSector = s.color || "#2dd4bf";
      const colorEstado = ESTADO_SECTOR_COLOR[estadoSector(s, cbRef.current.puntos)];
      let marcador = marcadoresSector.current.get(s.id);
      if (!marcador) {
        const el = document.createElement("div");
        el.className = "sector-label";
        marcador = new maplibregl.Marker({ element: el }).setLngLat(
          centroide(s.geom),
        );
        marcador.addTo(map);
        marcadoresSector.current.set(s.id, marcador);
      }
      const el = marcador.getElement();
      el.style.cssText = `display:flex;align-items:center;gap:5px;background:${colorSector}33;border:1.5px solid ${colorSector};color:#f1f5f9;font-weight:600;font-size:12px;padding:2px 8px;border-radius:6px;white-space:nowrap;pointer-events:none;`;
      const dot = document.createElement("span");
      dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:9999px;background:${colorEstado};box-shadow:0 0 0 1.5px #0f172a;`;
      el.replaceChildren(dot, document.createTextNode(s.nombre));
      el.style.display =
        cbRef.current.mostrarSectores && !cbRef.current.modoEdicion ? "flex" : "none";
      marcador.setLngLat(centroide(s.geom));
    }
    for (const [id, m] of marcadoresSector.current) {
      if (!vistos.has(id)) {
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
      const color = meta.color;
      // El anillo del ícono refleja el cronómetro de limpieza (si aplica);
      // si está fuera de servicio, siempre rojo.
      let eColor = estadoColor(p.estado);
      if (p.estado !== "fuera_servicio") {
        const li = infoLimpieza(p, cbRef.current.ahora);
        if (li && li.estado !== "sin_programar") eColor = li.color;
      }
      const coords = p.geom.coordinates as [number, number];

      let marcador = marcadoresPunto.current.get(p.id);
      if (!marcador) {
        const el = document.createElement("div");
        el.className = "punto-mk";
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (cbRef.current.modoDibujo !== "none" || cbRef.current.modoEdicion) return;
          cbRef.current.onSeleccionarPunto(p.id);
        });
        marcador = new maplibregl.Marker({ element: el }).setLngLat(coords);
        marcador.on("dragend", () => {
          const ll = marcador!.getLngLat();
          cbRef.current.onMoverPunto(p.id, [ll.lng, ll.lat]);
        });
        marcador.addTo(map);
        marcadoresPunto.current.set(p.id, marcador);
      }
      const el = marcador.getElement();
      el.style.borderColor = color;
      el.style.opacity = p.estado === "fuera_servicio" ? "0.6" : "1";
      el.style.cursor = cbRef.current.modoEdicion ? "move" : "pointer";
      marcador.setDraggable(cbRef.current.modoEdicion);

      const icon = document.createElement("span");
      icon.className = "ic";
      icon.style.background = `${color}33`;
      icon.style.boxShadow = `inset 0 0 0 2px ${eColor}`;
      icon.textContent = meta.icono;
      const hijos: HTMLElement[] = [icon];

      const num = numeroPunto(p);
      if (num) {
        const n = document.createElement("span");
        n.className = "num";
        n.textContent = num;
        hijos.push(n);
      }

      const etq = document.createElement("span");
      etq.className = "etq";
      const det = detallePunto(p);
      const limp = textoLimpieza(p, cbRef.current.ahora);
      etq.innerHTML =
        `<b>${escapar(tituloPunto(p))}</b>` +
        (det ? `<br>${escapar(det)}` : "") +
        (limp ? `<br>${escapar(limp)}` : "");
      hijos.push(etq);

      el.replaceChildren(...hijos);
      el.style.display = cbRef.current.capasVisibles.has(p.tipo) ? "flex" : "none";
      marcador.setLngLat(coords);
    }
    for (const [id, m] of marcadoresPunto.current) {
      if (!vistos.has(id)) {
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
        ? "flex"
        : "none";
    }
    // Durante la edición, Terra Draw dibuja los sectores (ocultamos los propios).
    const vis =
      cbRef.current.mostrarSectores && !cbRef.current.modoEdicion ? "visible" : "none";
    map.setLayoutProperty("sectores-fill", "visibility", vis);
    map.setLayoutProperty("sectores-line", "visibility", vis);
  }

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
  }, [props.capasVisibles, props.mostrarSectores]);

  // --- Modo edición de ubicaciones (arrastrar puntos y vértices de sectores) ---
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw || !listoRef.current) return;

    if (props.modoEdicion) {
      draw.clear();
      const features = cbRef.current.sectores
        .filter((s) => UUID_RE.test(s.id) && s.geom?.coordinates)
        .map((s) => ({
          id: s.id,
          type: "Feature" as const,
          geometry: s.geom,
          properties: { mode: "polygon" },
        }));
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
      m.getElement().style.cursor = props.modoEdicion ? "move" : "pointer";
    }

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
