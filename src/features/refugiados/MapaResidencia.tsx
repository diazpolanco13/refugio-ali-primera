// Mapa interactivo para ubicar la residencia afectada (satélite híbrido + pin).

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Expand, LocateFixed, Loader2 } from "lucide-react";
import { CARACAS_CENTRO, CARACAS_ZOOM } from "@/domain/centrosTransitorios";
import type { ObjetivoGeografico } from "@/domain/geografiaResidencia";
import { CAPAS_BASE, VISIBILIDAD_BASE, construirEstilo } from "@/map/estiloMapa";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Vista fija: satélite con calles superpuestas. */
const BASE_HIBRIDO = "hibrido" as const;

interface Props {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  soloLectura?: boolean;
  className?: string;
  objetivo?: ObjetivoGeografico | null;
  altura?: string;
}

function MapaResidenciaInterno({
  lat,
  lng,
  onChange,
  soloLectura = false,
  className,
  objetivo,
  altura = "h-56 sm:h-72",
  activo = true,
  mostrarExpandir,
  onExpandir,
}: Props & {
  activo?: boolean;
  mostrarExpandir?: boolean;
  onExpandir?: () => void;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadorRef = useRef<maplibregl.Marker | null>(null);
  const [mapListo, setMapListo] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const objetivoRef = useRef(objetivo);
  objetivoRef.current = objetivo;

  const colocarMarcador = useCallback(
    (map: maplibregl.Map, lngVal: number, latVal: number, readonly: boolean) => {
      marcadorRef.current?.remove();
      const el = document.createElement("div");
      el.className =
        "size-5 rounded-full border-2 border-white bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.35)] cursor-grab active:cursor-grabbing";
      el.setAttribute("aria-hidden", "true");
      const marcador = new maplibregl.Marker({
        element: el,
        draggable: !readonly,
      })
        .setLngLat([lngVal, latVal])
        .addTo(map);
      if (!readonly) {
        marcador.on("dragend", () => {
          const pos = marcador.getLngLat();
          onChangeRef.current(pos.lat, pos.lng);
        });
      }
      marcadorRef.current = marcador;
    },
    [],
  );

  const volarAObjetivo = useCallback((map: maplibregl.Map, obj: ObjetivoGeografico) => {
    if (obj.bounds) {
      map.fitBounds(obj.bounds, {
        padding: 40,
        duration: 800,
        maxZoom: obj.zoom + 2,
      });
    } else {
      map.flyTo({
        center: obj.center,
        zoom: obj.zoom,
        duration: 800,
        essential: true,
      });
    }
  }, []);

  const aplicarCapaHibrida = useCallback((map: maplibregl.Map) => {
    const visibles = new Set(VISIBILIDAD_BASE[BASE_HIBRIDO] ?? []);
    for (const capa of CAPAS_BASE) {
      if (!map.getLayer(capa)) continue;
      map.setLayoutProperty(capa, "visibility", visibles.has(capa) ? "visible" : "none");
    }
  }, []);

  useEffect(() => {
    if (!activo || !contenedorRef.current) return;

    setMapListo(false);
    let cancelado = false;
    let marcadoListo = false;

    const center: [number, number] =
      lng != null && lat != null ? [lng, lat] : (objetivo?.center ?? CARACAS_CENTRO);
    const zoom = lng != null && lat != null ? 16 : (objetivo?.zoom ?? CARACAS_ZOOM);

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
      colocarMarcador(map, lng, lat, soloLectura);
    } else if (objetivo && !soloLectura) {
      window.setTimeout(() => {
        if (!cancelado) volarAObjetivo(map, objetivo);
      }, 100);
    }

    map.once("load", marcarMapaListo);
    map.once("styledata", marcarMapaListo);
    map.once("render", marcarMapaListo);
    const fallbackListo = window.setTimeout(marcarMapaListo, 900);

    if (!soloLectura) {
      map.on("click", (e) => {
        const { lng: clickLng, lat: clickLat } = e.lngLat;
        colocarMarcador(map, clickLng, clickLat, false);
        onChangeRef.current(clickLat, clickLng);
      });
    }

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
  }, [activo, soloLectura]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapListo || lng == null || lat == null) return;
    if (marcadorRef.current) {
      marcadorRef.current.setLngLat([lng, lat]);
    } else {
      colocarMarcador(map, lng, lat, soloLectura);
    }
  }, [lat, lng, soloLectura, mapListo, colocarMarcador]);

  useEffect(() => {
    const map = mapRef.current;
    const obj = objetivo;
    if (!map || !mapListo || !obj || soloLectura) return;
    if (lat != null && lng != null) return;
    volarAObjetivo(map, obj);
  }, [objetivo, soloLectura, lat, lng, mapListo, volarAObjetivo]);

  function usarGps() {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización (GPS).");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latVal = pos.coords.latitude;
        const lngVal = pos.coords.longitude;
        const map = mapRef.current;
        if (map && mapListo) {
          colocarMarcador(map, lngVal, latVal, false);
          map.flyTo({ center: [lngVal, latVal], zoom: 17, duration: 600 });
        }
        onChange(latVal, lngVal);
      },
      () => alert("No se pudo obtener tu ubicación. Revisa los permisos del navegador."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("relative overflow-hidden rounded-lg border border-border", altura)}>
        <div ref={contenedorRef} className="h-full w-full min-h-[14rem]" />
        {!mapListo && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-muted/30">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 right-2 z-10">
          {mostrarExpandir && onExpandir && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 border-border/60 bg-card/95 shadow-sm backdrop-blur-sm"
              onClick={onExpandir}
              aria-label="Expandir mapa"
            >
              <Expand className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {!soloLectura && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Seleccione estado, municipio y parroquia para acercar el mapa. Luego haga clic para
            colocar el pin exacto de la vivienda o arrástrelo para ajustar.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={usarGps}>
              <LocateFixed className="size-3.5" />
              Usar mi GPS
            </Button>
            {objetivo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => {
                  const map = mapRef.current;
                  if (map && mapListo && objetivoRef.current) {
                    volarAObjetivo(map, objetivoRef.current);
                  }
                }}
              >
                Centrar en {objetivo.etiqueta}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function MapaResidencia(props: Props) {
  const [expandido, setExpandido] = useState(false);

  return (
    <>
      <MapaResidenciaInterno
        {...props}
        mostrarExpandir={!props.soloLectura}
        onExpandir={() => setExpandido(true)}
      />

      <Dialog open={expandido} onOpenChange={setExpandido}>
        <DialogContent
          className="flex h-[92dvh] max-h-[92dvh] w-[96vw] max-w-[96vw] flex-col gap-0 p-0 sm:max-w-[96vw]"
          overlayClassName="bg-black/70"
        >
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle>Marcar ubicación exacta</DialogTitle>
            <DialogDescription>
              Vista satélite híbrida para ubicar la vivienda con precisión.
              {props.objetivo ? ` Zona: ${props.objetivo.etiqueta}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 p-3">
            {expandido && (
              <MapaResidenciaInterno
                {...props}
                soloLectura={false}
                activo
                altura="h-full min-h-[60dvh]"
                className="h-full"
              />
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3">
            <p className="font-mono text-xs text-muted-foreground">
              {props.lat != null && props.lng != null
                ? `${props.lat.toFixed(6)}, ${props.lng.toFixed(6)}`
                : "Sin pin — haga clic en el mapa"}
            </p>
            <Button type="button" size="sm" onClick={() => setExpandido(false)}>
              Confirmar ubicación
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
