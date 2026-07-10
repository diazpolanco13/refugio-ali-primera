// Mapa satélite híbrido para fijar la coordenada del campamento en terreno.
// Misma base MapLibre que MapaResidencia, sin el diálogo de expansión ni el
// acercamiento por parroquia: el flujo es GPS → revisar pin → guardar.

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { LocateFixed, Loader2 } from "lucide-react";
import { CARACAS_CENTRO, CARACAS_ZOOM } from "@/domain/centrosTransitorios";
import { CAPAS_BASE, VISIBILIDAD_BASE, construirEstilo } from "@/map/estiloMapa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE_HIBRIDO = "hibrido" as const;

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  altura?: string;
}

export function MapaGeolocalizacionCentro({
  lat,
  lng,
  onChange,
  className,
  altura = "h-64 min-h-[16rem]",
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadorRef = useRef<maplibregl.Marker | null>(null);
  const [mapListo, setMapListo] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [errorGps, setErrorGps] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const colocarMarcador = useCallback((map: maplibregl.Map, lngVal: number, latVal: number) => {
    marcadorRef.current?.remove();
    const el = document.createElement("div");
    el.className =
      "size-5 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.35)] cursor-grab active:cursor-grabbing";
    el.setAttribute("aria-hidden", "true");
    const marcador = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([lngVal, latVal])
      .addTo(map);
    marcador.on("dragend", () => {
      const pos = marcador.getLngLat();
      onChangeRef.current(pos.lat, pos.lng);
    });
    marcadorRef.current = marcador;
  }, []);

  const aplicarCapaHibrida = useCallback((map: maplibregl.Map) => {
    const visibles = new Set(VISIBILIDAD_BASE[BASE_HIBRIDO] ?? []);
    for (const capa of CAPAS_BASE) {
      if (!map.getLayer(capa)) continue;
      map.setLayoutProperty(capa, "visibility", visibles.has(capa) ? "visible" : "none");
    }
  }, []);

  useEffect(() => {
    if (!contenedorRef.current) return;

    setMapListo(false);
    let cancelado = false;
    let marcadoListo = false;

    const center: [number, number] =
      lng != null && lat != null ? [lng, lat] : CARACAS_CENTRO;
    const zoom = lng != null && lat != null ? 17 : CARACAS_ZOOM;

    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: construirEstilo(),
      center,
      zoom,
      maxZoom: 19,
      minZoom: 3,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    function marcarMapaListo() {
      if (cancelado || marcadoListo) return;
      marcadoListo = true;
      aplicarCapaHibrida(map);
      map.resize();
      setMapListo(true);
    }

    if (lng != null && lat != null) {
      colocarMarcador(map, lng, lat);
    }

    map.once("load", marcarMapaListo);
    map.once("styledata", marcarMapaListo);
    map.once("render", marcarMapaListo);
    const fallbackListo = window.setTimeout(marcarMapaListo, 900);

    map.on("click", (e) => {
      const { lng: clickLng, lat: clickLat } = e.lngLat;
      colocarMarcador(map, clickLng, clickLat);
      onChangeRef.current(clickLat, clickLng);
    });

    let resizeObserver: ResizeObserver | null = null;
    const onResize = () => map.resize();
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(contenedorRef.current);
    } else {
      window.addEventListener("resize", onResize);
    }

    return () => {
      cancelado = true;
      window.clearTimeout(fallbackListo);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      marcadorRef.current?.remove();
      marcadorRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapListo || lng == null || lat == null) return;
    if (marcadorRef.current) {
      marcadorRef.current.setLngLat([lng, lat]);
    } else {
      colocarMarcador(map, lng, lat);
    }
    map.flyTo({ center: [lng, lat], zoom: 17, duration: 500 });
  }, [lat, lng, mapListo, colocarMarcador]);

  function usarGps() {
    if (!navigator.geolocation) {
      setErrorGps("Este dispositivo no soporta geolocalización (GPS).");
      return;
    }
    setErrorGps("");
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latVal = pos.coords.latitude;
        const lngVal = pos.coords.longitude;
        onChange(latVal, lngVal);
        setBuscandoGps(false);
      },
      () => {
        setErrorGps("No se pudo obtener la ubicación. Revise el permiso de ubicación del navegador.");
        setBuscandoGps(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  // Primera captura automática al montar si aún no hay pin.
  useEffect(() => {
    if (lat != null && lng != null) return;
    usarGps();
    // Solo al montar / cuando aún no hay coords.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("relative overflow-hidden rounded-lg border border-border", altura)}>
        <div ref={contenedorRef} className="h-full w-full min-h-[14rem]" />
        {!mapListo && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-muted/30">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Toque el mapa o arrastre el pin verde para ajustar. Debe coincidir con el campamento.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 w-full gap-2 border border-border text-sm font-semibold shadow-sm active:scale-[0.98]"
          onClick={usarGps}
          disabled={buscandoGps}
        >
          {buscandoGps ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          {buscandoGps ? "Obteniendo GPS…" : "Usar mi GPS"}
        </Button>
        {lat != null && lng != null && (
          <p className="text-center font-mono text-[11px] text-muted-foreground">
            {lat.toFixed(6)}, {lng.toFixed(6)}
          </p>
        )}
      </div>
      {errorGps && <p className="text-xs text-destructive">{errorGps}</p>}
    </div>
  );
}
