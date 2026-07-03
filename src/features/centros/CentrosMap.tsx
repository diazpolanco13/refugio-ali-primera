import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl from "maplibre-gl";
import { toPng } from "html-to-image";
import { CAPAS_BASE, VISIBILIDAD_BASE, construirEstilo, type BaseMapa } from "@/map/estiloMapa";
import { CARACAS_CENTRO, CARACAS_ZOOM, metaCuerpoDe, type CentroTransitorio } from "@/domain/centrosTransitorios";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { MarcadorCentro } from "./MarcadorCentro";
import { InfoCentro } from "./InfoCentro";

interface Props {
  centros: CentroTransitorio[];
  baseMapa: BaseMapa;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
}

export interface CentrosMapHandle {
  /** Exporta la vista actual del mapa (con todos los íconos) como PNG y la descarga. */
  exportarImagen: (nombreArchivo: string) => Promise<void>;
}

export const CentrosMap = forwardRef<CentrosMapHandle, Props>(function CentrosMap(
  { centros, baseMapa, seleccionado, onSeleccionar },
  ref,
) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const listoRef = useRef(false);
  const marcadores = useRef<Map<string, maplibregl.Marker>>(new Map());
  const roots = useRef<Map<string, Root>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);

  const cbRef = useRef({ centros, seleccionado, onSeleccionar });
  cbRef.current = { centros, seleccionado, onSeleccionar };

  function ocultarPopup() {
    popupRef.current?.remove();
    popupRootRef.current?.unmount();
    popupRootRef.current = null;
  }

  function mostrarPopup(map: maplibregl.Map, centro: CentroTransitorio) {
    if (!centro.geom) return;
    ocultarPopup();
    const mount = document.createElement("div");
    const root = createRoot(mount);
    popupRootRef.current = root;
    root.render(<InfoCentro centro={centro} />);

    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      offset: 14,
      maxWidth: "300px",
    })
      .setDOMContent(mount)
      .setLngLat(centro.geom.coordinates as [number, number])
      .addTo(map);

    popupRef.current.on("close", () => cbRef.current.onSeleccionar(null));
  }

  useEffect(() => {
    if (!contenedorRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: construirEstilo(),
      center: CARACAS_CENTRO,
      zoom: CARACAS_ZOOM,
      maxZoom: 19,
      attributionControl: { compact: true },
      // Necesario para poder leer el canvas WebGL al exportar la vista como imagen.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      listoRef.current = true;
      sincronizarMarcadores();
      aplicarBase();
    });

    return () => {
      ocultarPopup();
      for (const [, root] of roots.current) root.unmount();
      roots.current.clear();
      marcadores.current.forEach((m) => m.remove());
      marcadores.current.clear();
      map.remove();
      mapRef.current = null;
      listoRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sincronizarMarcadores() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const vistos = new Set<string>();
    for (const c of cbRef.current.centros) {
      if (!c.geom) continue;
      vistos.add(c.id);
      const meta = metaCuerpoDe(c.cuerpo);
      let marcador = marcadores.current.get(c.id);
      if (!marcador) {
        const anchor = document.createElement("div");
        const root = createRoot(anchor);
        roots.current.set(c.id, root);
        marcador = new maplibregl.Marker({ element: anchor }).setLngLat(
          c.geom.coordinates as [number, number],
        );
        marcador.addTo(map);
        marcadores.current.set(c.id, marcador);
      }
      const analisis = analisisCentro(c);
      roots.current.get(c.id)?.render(
        <MarcadorCentro
          icono={meta.icono}
          logo={meta.logo}
          color={meta.color}
          seleccionado={cbRef.current.seleccionado === c.id}
          semaforoColor={
            analisis.semaforo === "sin_datos" ? null : COLOR_SEMAFORO[analisis.semaforo]
          }
          onClick={() => cbRef.current.onSeleccionar(c.id)}
        />,
      );
    }
    for (const [id, m] of marcadores.current) {
      if (!vistos.has(id)) {
        roots.current.get(id)?.unmount();
        roots.current.delete(id);
        m.remove();
        marcadores.current.delete(id);
      }
    }
  }

  useEffect(() => {
    sincronizarMarcadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centros, seleccionado]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    if (seleccionado) {
      const centro = cbRef.current.centros.find((c) => c.id === seleccionado);
      if (centro?.geom) {
        mostrarPopup(map, centro);
        map.flyTo({ center: centro.geom.coordinates as [number, number], zoom: Math.max(map.getZoom(), 13), duration: 500 });
      }
    } else {
      ocultarPopup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado]);

  function aplicarBase() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const visibles = new Set(VISIBILIDAD_BASE[baseMapa] ?? []);
    for (const capa of CAPAS_BASE) {
      if (!map.getLayer(capa)) continue;
      map.setLayoutProperty(capa, "visibility", visibles.has(capa) ? "visible" : "none");
    }
  }

  useEffect(() => {
    aplicarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMapa]);

  /** Exporta la vista actual (canvas del mapa + marcadores HTML) como PNG descargable. */
  async function exportarImagen(nombreArchivo: string) {
    const contenedor = contenedorRef.current;
    const map = mapRef.current;
    if (!contenedor || !map) throw new Error("El mapa no está listo.");

    map.triggerRepaint();
    await new Promise<void>((resolve) => map.once("idle", () => resolve()));

    // Oculta controles propios de MapLibre (zoom, escala, atribución) y
    // cualquier popup abierto: no aportan al plano impreso.
    const chrome = contenedor.querySelectorAll<HTMLElement>(
      ".maplibregl-control-container, .maplibregl-popup",
    );
    const previos = Array.from(chrome).map((el) => el.style.display);
    chrome.forEach((el) => (el.style.display = "none"));

    try {
      const dataUrl = await toPng(contenedor, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#0b1220",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = nombreArchivo;
      a.click();
    } finally {
      chrome.forEach((el, i) => (el.style.display = previos[i]));
    }
  }

  useImperativeHandle(ref, () => ({ exportarImagen }));

  return <div ref={contenedorRef} className="h-full w-full" />;
});
