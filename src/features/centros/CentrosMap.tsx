import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl from "maplibre-gl";
import { toPng } from "html-to-image";
import { CAPAS_BASE, VISIBILIDAD_BASE, construirEstilo, type BaseMapa } from "@/map/estiloMapa";
import {
  CARACAS_CENTRO,
  CARACAS_ZOOM,
  metaCuerpoDe,
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  cargarVistaCentros,
  guardarVistaCentros,
  VISTA_DEFECTO_CENTROS,
} from "@/data/preferenciasMapa";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { MarcadorCentro } from "./MarcadorCentro";
import { InfoCentro } from "./InfoCentro";
import { ControlesMapaCentros } from "./ControlesMapaCentros";

interface Props {
  centros: CentroTransitorio[];
  baseMapa: BaseMapa;
  onCambiarBase: (base: BaseMapa) => void;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  /** Abrir el detalle completo del centro seleccionado (botón "Ver detalle" de la nube). */
  onAbrirDetalle?: () => void;
  onExportar?: () => void;
  exportando?: boolean;
}

export interface CentrosMapHandle {
  exportarImagen: (nombreArchivo: string) => Promise<void>;
  centrarCaracas: () => void;
  activarGps: () => void;
}

export const CentrosMap = forwardRef<CentrosMapHandle, Props>(function CentrosMap(
  { centros, baseMapa, onCambiarBase, seleccionado, onSeleccionar, onAbrirDetalle, onExportar, exportando },
  ref,
) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const listoRef = useRef(false);
  const marcadores = useRef<Map<string, maplibregl.Marker>>(new Map());
  const roots = useRef<Map<string, Root>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const popupRootRef = useRef<Root | null>(null);
  const marcadorUsuarioRef = useRef<maplibregl.Marker | null>(null);
  const watchGpsRef = useRef<number | null>(null);
  const guardarVistaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gpsActivo, setGpsActivo] = useState(false);

  const cbRef = useRef({ centros, seleccionado, onSeleccionar, onAbrirDetalle });
  cbRef.current = { centros, seleccionado, onSeleccionar, onAbrirDetalle };

  function persistirVista() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const c = map.getCenter();
    guardarVistaCentros({
      center: [c.lng, c.lat],
      zoom: map.getZoom(),
    });
  }

  function programarPersistirVista() {
    if (guardarVistaTimer.current) clearTimeout(guardarVistaTimer.current);
    guardarVistaTimer.current = setTimeout(persistirVista, 400);
  }

  function detenerGps() {
    if (watchGpsRef.current != null) {
      navigator.geolocation.clearWatch(watchGpsRef.current);
      watchGpsRef.current = null;
    }
    marcadorUsuarioRef.current?.remove();
    marcadorUsuarioRef.current = null;
    setGpsActivo(false);
  }

  function crearMarcadorUsuario(map: maplibregl.Map, lngLat: [number, number]) {
    const el = document.createElement("div");
    el.className =
      "size-4 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_0_4px_rgba(14,165,233,0.35)]";
    el.setAttribute("aria-hidden", "true");
    const marcador = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
    marcadorUsuarioRef.current = marcador;
  }

  function alternarGps() {
    if (watchGpsRef.current != null) {
      detenerGps();
      return;
    }
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización (GPS).");
      return;
    }
    watchGpsRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        if (!marcadorUsuarioRef.current) {
          crearMarcadorUsuario(map, lngLat);
          map.flyTo({
            center: lngLat,
            zoom: Math.max(map.getZoom(), 14),
            duration: 600,
          });
        } else {
          marcadorUsuarioRef.current.setLngLat(lngLat);
        }
        setGpsActivo(true);
      },
      () => {
        detenerGps();
        alert("No se pudo obtener tu ubicación. Revisa los permisos del navegador.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  function centrarCaracas() {
    mapRef.current?.flyTo({
      center: CARACAS_CENTRO,
      zoom: CARACAS_ZOOM,
      duration: 800,
    });
  }

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
    root.render(<InfoCentro centro={centro} onAbrirDetalle={cbRef.current.onAbrirDetalle} />);

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
    const vistaInicial = cargarVistaCentros() ?? VISTA_DEFECTO_CENTROS;
    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: construirEstilo(),
      center: vistaInicial.center,
      zoom: vistaInicial.zoom,
      maxZoom: 19,
      minZoom: 3,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.on("moveend", programarPersistirVista);

    map.on("load", () => {
      listoRef.current = true;
      sincronizarMarcadores();
      aplicarBase();
    });

    return () => {
      if (guardarVistaTimer.current) clearTimeout(guardarVistaTimer.current);
      detenerGps();
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
      const refugiados = poblacionCentro(c);
      const funcionarios = normalizarCentro(c).personal.funcionarios;
      roots.current.get(c.id)?.render(
        <MarcadorCentro
          icono={meta.icono}
          logo={meta.logo}
          color={meta.color}
          seleccionado={cbRef.current.seleccionado === c.id}
          refugiados={refugiados}
          funcionarios={funcionarios}
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
        map.flyTo({
          center: centro.geom.coordinates as [number, number],
          zoom: Math.max(map.getZoom(), 13),
          duration: 500,
        });
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

  async function exportarImagen(nombreArchivo: string) {
    const contenedor = contenedorRef.current?.parentElement;
    const map = mapRef.current;
    if (!contenedor || !map) throw new Error("El mapa no está listo.");

    map.triggerRepaint();
    await new Promise<void>((resolve) => map.once("idle", () => resolve()));

    const chrome = contenedor.querySelectorAll<HTMLElement>(
      ".maplibregl-control-container, .maplibregl-popup, .map-controls-overlay",
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

  useImperativeHandle(ref, () => ({
    exportarImagen,
    centrarCaracas,
    activarGps: alternarGps,
  }));

  return (
    <div className="relative h-full w-full">
      <div ref={contenedorRef} className="h-full w-full" />
      <ControlesMapaCentros
        gpsActivo={gpsActivo}
        exportando={exportando}
        baseMapa={baseMapa}
        onCambiarBase={onCambiarBase}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 250 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 250 })}
        onGps={alternarGps}
        onCentrarCaracas={centrarCaracas}
        onExportar={onExportar}
      />
    </div>
  );
});
