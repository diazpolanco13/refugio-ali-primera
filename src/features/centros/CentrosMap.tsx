import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl from "maplibre-gl";
import { toPng } from "html-to-image";
import {
  calcularReglaEscala,
  debeMostrarEtiquetaNombre,
  zoomParaAnchoMetros,
  type ReglaEscala,
} from "@/map/escalaVista";
import {
  CAPAS_BASE,
  VISIBILIDAD_BASE,
  aplicarEdificios3d,
  esBaseEstiloExterno,
  estiloMapaParaBase,
  type BaseMapa,
} from "@/map/estiloMapa";
import {
  esCentroDePrueba,
  CARACAS_CENTRO,
  CARACAS_ZOOM,
  CARACAS_ZOOM_MAX_ENCUDRE,
  LOGO_SEBIN,
  metaUnidadSebinCentro,
  normalizarCentro,
  poblacionCentro,
  totalPersonalOperativo,
  unidadSebinDe,
  type CentroTransitorio,
  type ClaveUnidadSebin,
} from "@/domain/centrosTransitorios";
import {
  cargarModo3dCentros,
  cargarModoGloboCentros,
  cargarVistaCentros,
  guardarModo3dCentros,
  guardarModoGloboCentros,
  guardarVistaCentros,
  VISTA_DEFECTO_CENTROS,
  type ModoMarcadorCentros,
} from "@/data/preferenciasMapa";
import {
  ANCHO_INTRO_DESTINO_METROS,
  DURACION_INTRO_MAPA_MS,
  TIMEOUT_INTRO_FALLBACK_MS,
  ZOOM_INTRO_ORBITA,
  avisarMapaOrbitaLista,
  marcarIntroMapaLanzada,
  onInicioSalidaOverlay,
  reservarIntroMapa,
} from "@/lib/introMapa";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { boundsRedCentros } from "@/domain/redCentros";
import { MarcadorCentro } from "./MarcadorCentro";
import { InfoCentro } from "./InfoCentro";
import { ControlesMapaCentros } from "./ControlesMapaCentros";
import { SelectoresVistaMapa } from "./SelectoresVistaMapa";
import { LeyendaUnidadesSebin } from "./LeyendaUnidadesSebin";
import { LogoMini } from "@/components/LogoMini";

interface Props {
  centros: CentroTransitorio[];
  baseMapa: BaseMapa;
  onCambiarBase: (base: BaseMapa) => void;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  modoMarcador: ModoMarcadorCentros;
  onCambiarModoMarcador: (modo: ModoMarcadorCentros) => void;
  mostrarParteMarcador: boolean;
  onCambiarMostrarParteMarcador: (mostrar: boolean) => void;
  mostrarLeyenda: boolean;
  onCambiarMostrarLeyenda: (mostrar: boolean) => void;
  mostrarCintaTotales: boolean;
  onCambiarMostrarCintaTotales: (mostrar: boolean) => void;
  /** Direcciones SEBIN activas (vacío = ver todas). */
  unidadesFiltro: ReadonlySet<ClaveUnidadSebin>;
  onAlternarUnidadFiltro: (clave: ClaveUnidadSebin) => void;
  onLimpiarUnidadesFiltro: () => void;
  /**
   * IDs resaltados por ámbito del usuario (supervisor/operador).
   * `null`/`undefined` = sin atenuación por asignación.
   * Con set: el resto se opaca igual que el filtro por unidad SEBIN.
   */
  idsResaltadosAmbito?: ReadonlySet<string> | null;
  /** Indica si el panel DetalleCentro está abierto (estado "presionado" del botón "detalles"). */
  detalleAbierto: boolean;
  /** Alternar (abrir/cerrar) el panel de detalle completo del centro seleccionado. */
  onToggleDetalle?: () => void;
  onExportar?: () => void;
  exportando?: boolean;
}

export interface CentrosMapHandle {
  exportarImagen: (nombreArchivo: string) => Promise<void>;
  centrarCaracas: () => void;
  activarGps: () => void;
}

export const CentrosMap = forwardRef<CentrosMapHandle, Props>(function CentrosMap(
  {
    centros,
    baseMapa,
    onCambiarBase,
    seleccionado,
    onSeleccionar,
    modoMarcador,
    onCambiarModoMarcador,
    mostrarParteMarcador,
    onCambiarMostrarParteMarcador,
    mostrarLeyenda,
    onCambiarMostrarLeyenda,
    mostrarCintaTotales,
    onCambiarMostrarCintaTotales,
    unidadesFiltro,
    onAlternarUnidadFiltro,
    onLimpiarUnidadesFiltro,
    idsResaltadosAmbito = null,
    detalleAbierto,
    onToggleDetalle,
    onExportar,
    exportando,
  },
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
  const vistaDefectoAplicadaRef = useRef(false);
  const usaVistaGuardadaRef = useRef(cargarVistaCentros() != null);
  /** Modo de estilo activo en el mapa (`raster` = estilo compuesto; externo = URL). */
  const modoEstiloRef = useRef<"raster" | "dark-matter">(
    esBaseEstiloExterno(baseMapa) ? "dark-matter" : "raster",
  );
  const generacionEstiloRef = useRef(0);
  const [gpsActivo, setGpsActivo] = useState(false);
  const [reglaEscala, setReglaEscala] = useState<ReglaEscala | undefined>();
  const [mostrarEtiquetaNombre, setMostrarEtiquetaNombre] = useState(false);
  const [modo3d, setModo3d] = useState(() => cargarModo3dCentros() ?? true);
  const modo3dRef = useRef(modo3d);
  modo3dRef.current = modo3d;
  const [modoGlobo, setModoGlobo] = useState(() => cargarModoGloboCentros() ?? false);
  const modoGloboRef = useRef(modoGlobo);
  modoGloboRef.current = modoGlobo;
  /** Intro Google Earth: una vez por carga de página, sync con fade splash/login. */
  const hacerIntroRef = useRef(reservarIntroMapa());
  const introEnCursoRef = useRef(hacerIntroRef.current);

  useEffect(() => {
    guardarModo3dCentros(modo3d);
  }, [modo3d]);

  useEffect(() => {
    guardarModoGloboCentros(modoGlobo);
  }, [modoGlobo]);

  function actualizarEscalaVista() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    setReglaEscala(calcularReglaEscala(map.getZoom(), map.getCenter().lat));
    const mostrarNombre = debeMostrarEtiquetaNombre(map);
    if (mostrarNombre !== cbRef.current.mostrarEtiquetaNombre) {
      cbRef.current.mostrarEtiquetaNombre = mostrarNombre;
      setMostrarEtiquetaNombre(mostrarNombre);
    }
  }

  const cbRef = useRef({
    centros,
    seleccionado,
    detalleAbierto,
    modoMarcador,
    mostrarParteMarcador,
    mostrarEtiquetaNombre,
    unidadesFiltro,
    idsResaltadosAmbito,
    onSeleccionar,
    onToggleDetalle,
  });
  cbRef.current = {
    centros,
    seleccionado,
    detalleAbierto,
    modoMarcador,
    mostrarParteMarcador,
    mostrarEtiquetaNombre,
    unidadesFiltro,
    idsResaltadosAmbito,
    onSeleccionar,
    onToggleDetalle,
  };

  const unidadesPresentes = useMemo(() => {
    const s = new Set<ClaveUnidadSebin>();
    for (const c of centros) s.add(unidadSebinDe(c));
    return s;
  }, [centros]);

  function persistirVista() {
    const map = mapRef.current;
    if (!map || !listoRef.current || introEnCursoRef.current) return;
    const c = map.getCenter();
    guardarVistaCentros({
      center: [c.lng, c.lat],
      zoom: map.getZoom(),
    });
  }

  function programarPersistirVista() {
    if (introEnCursoRef.current) return;
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

  function encuadrarRed(opciones: { animar?: boolean } = {}) {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;

    const bounds = boundsRedCentros(cbRef.current.centros);
    if (!bounds) {
      map.flyTo({
        center: CARACAS_CENTRO,
        zoom: CARACAS_ZOOM,
        duration: opciones.animar ? 800 : 0,
      });
      return;
    }

    map.fitBounds(bounds, {
      padding: { top: 56, bottom: 56, left: 56, right: 56 },
      maxZoom: CARACAS_ZOOM_MAX_ENCUDRE,
      duration: opciones.animar ? 800 : 0,
    });
  }

  function aplicarVistaDefectoSiCorresponde() {
    if (usaVistaGuardadaRef.current || vistaDefectoAplicadaRef.current) return;
    if (!boundsRedCentros(cbRef.current.centros)) return;
    encuadrarRed({ animar: false });
    vistaDefectoAplicadaRef.current = true;
  }

  function centrarCaracas() {
    encuadrarRed({ animar: true });
  }

  /**
   * Espera el fade del splash/login y lanza flyTo órbita → Caracas ~30 km.
   * Devuelve cancelador para StrictMode / unmount.
   */
  function programarIntroFly(map: maplibregl.Map): () => void {
    let lanzado = false;
    let fallbackId = 0;

    const finalizarIntro = () => {
      introEnCursoRef.current = false;
      // Restaura preferencia de globo del usuario (puede ser off).
      if (mapRef.current) {
        aplicarProyeccionGlobo(mapRef.current, modoGloboRef.current);
      }
      vistaDefectoAplicadaRef.current = true;
      actualizarEscalaVista();
      persistirVista();
    };

    const lanzar = () => {
      if (lanzado || !mapRef.current || mapRef.current !== map) return;
      lanzado = true;
      marcarIntroMapaLanzada();
      window.clearTimeout(fallbackId);

      const m = mapRef.current;
      const anchoPx = m.getContainer().clientWidth || 1200;
      const zoomDestino = zoomParaAnchoMetros(
        ANCHO_INTRO_DESTINO_METROS,
        CARACAS_CENTRO[1],
        anchoPx,
      );
      const pitchFinal =
        modoEstiloRef.current === "dark-matter" && modo3dRef.current ? 45 : 0;

      introEnCursoRef.current = true;
      m.setMinZoom(0);
      m.flyTo({
        center: CARACAS_CENTRO,
        zoom: zoomDestino,
        pitch: pitchFinal,
        bearing: 0,
        duration: DURACION_INTRO_MAPA_MS,
        essential: true,
        // Ease-out: rápido al salir de órbita, frena al aterrizar.
        easing: (t) => 1 - (1 - t) * (1 - t),
      });
      m.once("moveend", finalizarIntro);
    };

    // Ya en órbita: el login puede empezar a disolverse encima.
    avisarMapaOrbitaLista();

    const unsub = onInicioSalidaOverlay(lanzar);
    fallbackId = window.setTimeout(lanzar, TIMEOUT_INTRO_FALLBACK_MS);

    return () => {
      unsub();
      window.clearTimeout(fallbackId);
      if (!lanzado) {
        // Remount StrictMode: no marcar hecha; el siguiente montaje reintenta.
        introEnCursoRef.current = hacerIntroRef.current;
      }
    };
  }

  function ocultarPopup() {
    popupRef.current?.remove();
    popupRootRef.current?.unmount();
    popupRootRef.current = null;
  }

  function renderPopupContent(centro: CentroTransitorio) {
    if (!popupRootRef.current) return;
    popupRootRef.current.render(
      <InfoCentro
        centro={centro}
        detalleAbierto={cbRef.current.detalleAbierto}
        onToggleDetalle={cbRef.current.onToggleDetalle}
      />,
    );
  }

  function mostrarPopup(map: maplibregl.Map, centro: CentroTransitorio) {
    if (!centro.geom) return;
    ocultarPopup();
    const mount = document.createElement("div");
    const root = createRoot(mount);
    popupRootRef.current = root;
    renderPopupContent(centro);

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
    const hacerIntro = hacerIntroRef.current;
    const vistaGuardada = cargarVistaCentros();
    // Intro: parte desde órbita sobre Caracas. Si no, vista guardada / default.
    const vistaInicial = hacerIntro
      ? { center: CARACAS_CENTRO, zoom: ZOOM_INTRO_ORBITA }
      : (vistaGuardada ?? VISTA_DEFECTO_CENTROS);
    const baseInicial = baseMapa;
    modoEstiloRef.current = esBaseEstiloExterno(baseInicial) ? "dark-matter" : "raster";
    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: estiloMapaParaBase(baseInicial),
      center: vistaInicial.center,
      zoom: vistaInicial.zoom,
      pitch:
        hacerIntro
          ? 0
          : esBaseEstiloExterno(baseInicial) && modo3dRef.current
            ? 45
            : 0,
      maxZoom: 19,
      // Intro / globo: minZoom 0 para ver el planeta.
      minZoom: hacerIntro || modoGloboRef.current ? 0 : 3,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.on("moveend", programarPersistirVista);
    map.on("move", actualizarEscalaVista);
    map.on("zoom", actualizarEscalaVista);
    map.on("resize", actualizarEscalaVista);

    let cancelarIntro: (() => void) | null = null;
    let timeoutArmarIntro = 0;
    let introArmada = false;

    map.on("load", () => {
      listoRef.current = true;
      sincronizarMarcadores();
      aplicarBase();
      if (hacerIntro) {
        // Esfera durante el vuelo (aunque el usuario no tenga globo permanente).
        aplicarProyeccionGlobo(map, true);
        map.resize();
        map.triggerRepaint();
        // Pintar órbita debajo del splash opaco; solo entonces avisar.
        // El splash ESPERA este aviso antes de disolverse.
        const armarIntro = () => {
          if (introArmada || !mapRef.current) return;
          introArmada = true;
          window.clearTimeout(timeoutArmarIntro);
          cancelarIntro = programarIntroFly(map);
        };
        requestAnimationFrame(() => {
          requestAnimationFrame(armarIntro);
        });
        map.once("idle", armarIntro);
        timeoutArmarIntro = window.setTimeout(armarIntro, 1200);
      } else {
        aplicarProyeccionGlobo(map, modoGloboRef.current);
        aplicarVistaDefectoSiCorresponde();
        // Sin intro: desbloquear igual el fade del login (no esperar timeout).
        avisarMapaOrbitaLista();
      }
      actualizarEscalaVista();
      map.resize();
    });

    const contenedor = contenedorRef.current;
    const ro = new ResizeObserver(() => {
      const mapActual = mapRef.current;
      if (!mapActual || !listoRef.current) return;
      if (contenedor.clientWidth === 0 || contenedor.clientHeight === 0) return;
      mapActual.resize();
    });
    ro.observe(contenedor);
    requestAnimationFrame(() => {
      if (mapRef.current && listoRef.current) mapRef.current.resize();
    });

    return () => {
      introArmada = true;
      window.clearTimeout(timeoutArmarIntro);
      cancelarIntro?.();
      ro.disconnect();
      if (guardarVistaTimer.current) clearTimeout(guardarVistaTimer.current);
      detenerGps();
      ocultarPopup();
      // Diferir unmount: React 19 no permite desmontar un root síncrono
      // mientras otro render está en curso (Strict Mode / remount).
      const rootsADesmontar = [...roots.current.values()];
      roots.current.clear();
      marcadores.current.forEach((m) => m.remove());
      marcadores.current.clear();
      map.remove();
      mapRef.current = null;
      listoRef.current = false;
      queueMicrotask(() => {
        for (const root of rootsADesmontar) {
          try {
            root.unmount();
          } catch {
            /* root ya desmontado */
          }
        }
      });
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
      const metaUnidad = metaUnidadSebinCentro(c);
      const claveUnidad = unidadSebinDe(c);
      const filtro = cbRef.current.unidadesFiltro;
      const hayFiltroUnidad = filtro.size > 0;
      const ambito = cbRef.current.idsResaltadosAmbito;
      const resaltadoAmbito = ambito == null || ambito.has(c.id);
      const resaltadoUnidad = !hayFiltroUnidad || filtro.has(claveUnidad);
      const resaltado = resaltadoAmbito && resaltadoUnidad;
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
      // Los atenuados van detrás para que la dirección / ámbito filtrado quede al frente.
      const el = marcador.getElement();
      el.style.zIndex = resaltado ? "2" : "1";
      el.style.pointerEvents = resaltado ? "auto" : "none";
      const analisis = analisisCentro(c);
      const refugiados = poblacionCentro(c);
      const personalTotal = totalPersonalOperativo(normalizarCentro(c).personal);
      roots.current.get(c.id)?.render(
        <MarcadorCentro
          modo={cbRef.current.modoMarcador}
          nro={c.nro}
          nombre={c.nombre}
          icono="🛡️"
          logo={LOGO_SEBIN}
          color={metaUnidad.color}
          seleccionado={cbRef.current.seleccionado === c.id}
          resaltado={resaltado}
          mostrarParte={cbRef.current.mostrarParteMarcador}
          mostrarNombre={cbRef.current.mostrarEtiquetaNombre}
          refugiados={refugiados}
          personalTotal={personalTotal}
          semaforoColor={
            analisis.semaforo === "rojo" ? COLOR_SEMAFORO.rojo : null
          }
          esPrueba={esCentroDePrueba(c)}
          onClick={() => cbRef.current.onSeleccionar(c.id)}
        />,
      );
    }
    for (const [id, m] of marcadores.current) {
      if (!vistos.has(id)) {
        const root = roots.current.get(id);
        roots.current.delete(id);
        m.remove();
        marcadores.current.delete(id);
        if (root) {
          queueMicrotask(() => {
            try {
              root.unmount();
            } catch {
              /* root ya desmontado */
            }
          });
        }
      }
    }
  }

  useEffect(() => {
    sincronizarMarcadores();
    aplicarVistaDefectoSiCorresponde();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centros, seleccionado, modoMarcador, mostrarParteMarcador, mostrarEtiquetaNombre, unidadesFiltro, idsResaltadosAmbito]);

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

  // Refresca el contenido del popup cuando cambia el estado del panel, para que
  // el botón "detalles" refleje el estado "presionado" sin reabrir la nube.
  useEffect(() => {
    if (!seleccionado || !popupRootRef.current) return;
    const centro = cbRef.current.centros.find((c) => c.id === seleccionado);
    if (centro) renderPopupContent(centro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalleAbierto]);

  function aplicarVisibilidadRaster(map: maplibregl.Map, base: BaseMapa) {
    const visibles = new Set(VISIBILIDAD_BASE[base] ?? []);
    for (const capa of CAPAS_BASE) {
      if (!map.getLayer(capa)) continue;
      map.setLayoutProperty(capa, "visibility", visibles.has(capa) ? "visible" : "none");
    }
  }

  function aplicarBase() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    const base = baseMapa;
    const con3d = modo3dRef.current;

    if (esBaseEstiloExterno(base)) {
      if (modoEstiloRef.current === "dark-matter") {
        aplicarEdificios3d(map, con3d);
        sincronizarPitch3d(map, con3d);
        aplicarProyeccionGlobo(map, modoGloboRef.current);
        return;
      }
      const gen = ++generacionEstiloRef.current;
      modoEstiloRef.current = "dark-matter";
      map.setStyle(estiloMapaParaBase(base));
      map.once("style.load", () => {
        if (generacionEstiloRef.current !== gen || !mapRef.current) return;
        aplicarEdificios3d(mapRef.current, modo3dRef.current);
        sincronizarPitch3d(mapRef.current, modo3dRef.current);
        // setStyle resetea la proyección: hay que reponer el globo.
        aplicarProyeccionGlobo(mapRef.current, modoGloboRef.current);
      });
      return;
    }

    if (modoEstiloRef.current === "dark-matter") {
      const gen = ++generacionEstiloRef.current;
      const baseObjetivo = base;
      modoEstiloRef.current = "raster";
      map.setStyle(estiloMapaParaBase(baseObjetivo));
      map.once("style.load", () => {
        if (generacionEstiloRef.current !== gen || !mapRef.current) return;
        // Refuerzo: por si el estilo llegó sin la visibilidad esperada.
        aplicarVisibilidadRaster(mapRef.current, baseObjetivo);
        if (mapRef.current.getPitch() > 0 || mapRef.current.getBearing() !== 0) {
          mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 600 });
        }
        aplicarProyeccionGlobo(mapRef.current, modoGloboRef.current);
      });
      return;
    }

    aplicarVisibilidadRaster(map, base);
    aplicarProyeccionGlobo(map, modoGloboRef.current);
  }

  /** Proyección esfera de MapLibre (funciona con Carto Dark y con raster/sat). */
  function aplicarProyeccionGlobo(map: maplibregl.Map, activo: boolean) {
    // Mientras dura la intro (órbita → Caracas), no dejar que un setStyle quite el globo.
    const usarGlobo = introEnCursoRef.current ? true : activo;
    map.setMinZoom(usarGlobo ? 0 : 3);
    const tipoActual = map.getProjection()?.type;
    const tipoObjetivo = usarGlobo ? "globe" : "mercator";
    if (tipoActual === tipoObjetivo) return;
    map.setProjection({ type: tipoObjetivo });
  }

  function sincronizarPitch3d(map: maplibregl.Map, con3d: boolean) {
    // El flyTo de intro lleva el pitch final; no pelear con easeTo aquí.
    if (introEnCursoRef.current) return;
    if (con3d) {
      if (map.getPitch() < 30) {
        map.easeTo({ pitch: 45, duration: 800 });
      }
      return;
    }
    if (map.getPitch() > 0 || map.getBearing() !== 0) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
    }
  }

  useEffect(() => {
    aplicarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMapa, modo3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    aplicarProyeccionGlobo(map, modoGlobo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoGlobo]);

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
      <SelectoresVistaMapa
        baseMapa={baseMapa}
        modo3d={modo3d}
        onCambiarBase={onCambiarBase}
        onCambiarModo3d={setModo3d}
        reglaEscala={reglaEscala}
      />
      <ControlesMapaCentros
        gpsActivo={gpsActivo}
        exportando={exportando}
        baseMapa={baseMapa}
        onCambiarBase={onCambiarBase}
        onGps={alternarGps}
        onCentrarCaracas={centrarCaracas}
        onExportar={onExportar}
        vistaMarcadores={{
          modoMarcador,
          onCambiarModo: onCambiarModoMarcador,
          mostrarParte: mostrarParteMarcador,
          onCambiarMostrarParte: onCambiarMostrarParteMarcador,
          mostrarLeyenda,
          onCambiarMostrarLeyenda,
          mostrarCintaTotales,
          onCambiarMostrarCintaTotales,
          modoGlobo,
          onCambiarModoGlobo: setModoGlobo,
        }}
      />
      <LogoMini
        variant="minimo"
        position="bottom-left"
        onClick={centrarCaracas}
        className="hidden md:flex"
      />
      {modoMarcador === "color" && mostrarLeyenda && (
        <LeyendaUnidadesSebin
          unidadesPresentes={unidadesPresentes}
          unidadesFiltro={unidadesFiltro}
          onAlternarUnidad={onAlternarUnidadFiltro}
          onLimpiarFiltro={onLimpiarUnidadesFiltro}
          onMinimizar={() => onCambiarMostrarLeyenda(false)}
        />
      )}
    </div>
  );
});
