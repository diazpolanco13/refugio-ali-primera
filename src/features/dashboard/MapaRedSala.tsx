// Mapa ambiental de la sala situacional: toda la red de campamentos como
// puntos coloreados por nivel de urgencia (prioridadCentros), con tamaño
// proporcional a la población alojada. Sin controles de edición ni selección
// persistente: pensado para proyectarse 24/7. Clic en un punto → ficha del
// campamento (/centro/:id).

import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { construirEstilo } from "@/map/estiloMapa";
import {
  CARACAS_CENTRO,
  CARACAS_ZOOM,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { boundsRedCentros } from "@/domain/redCentros";
import {
  COLOR_NIVEL,
  ETIQUETA_NIVEL,
  ORDEN_NIVELES,
  prioridadCentro,
  type NivelPrioridad,
} from "@/domain/prioridadCentros";

interface Props {
  centros: CentroTransitorio[];
  /** Navegar a la ficha del campamento al hacer clic en un punto. */
  onAbrirCentro?: (id: string) => void;
}

/** Diámetro del punto (px) según la población alojada. */
function diametroPunto(refugiados: number): number {
  if (refugiados <= 0) return 10;
  return Math.min(30, Math.max(12, Math.round(8 + Math.sqrt(refugiados) * 1.3)));
}

export function MapaRedSala({ centros, onAbrirCentro }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const listoRef = useRef(false);
  const encuadradoRef = useRef(false);
  const marcadoresRef = useRef<maplibregl.Marker[]>([]);
  const cbRef = useRef({ centros, onAbrirCentro });
  cbRef.current = { centros, onAbrirCentro };

  const conteoNivel = useMemo(() => {
    const conteo: Record<NivelPrioridad, number> = {
      critico: 0,
      alto: 0,
      medio: 0,
      estable: 0,
      sin_datos: 0,
    };
    for (const c of centros) conteo[prioridadCentro(c).nivel] += 1;
    return conteo;
  }, [centros]);

  useEffect(() => {
    if (!contenedorRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: contenedorRef.current,
      style: construirEstilo(),
      center: CARACAS_CENTRO,
      zoom: CARACAS_ZOOM,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on("load", () => {
      listoRef.current = true;
      pintarMarcadores();
      encuadrarRed();
    });
    return () => {
      for (const m of marcadoresRef.current) m.remove();
      marcadoresRef.current = [];
      listoRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function encuadrarRed() {
    const map = mapRef.current;
    if (!map || encuadradoRef.current) return;
    const bounds = boundsRedCentros(cbRef.current.centros);
    if (!bounds) return;
    encuadradoRef.current = true;
    map.fitBounds(bounds, { padding: 36, maxZoom: 13, animate: false });
  }

  function pintarMarcadores() {
    const map = mapRef.current;
    if (!map || !listoRef.current) return;
    for (const m of marcadoresRef.current) m.remove();
    marcadoresRef.current = [];

    for (const centro of cbRef.current.centros) {
      if (!centro.geom) continue;
      const nivel = prioridadCentro(centro).nivel;
      const refugiados = poblacionCentro(centro);
      const d = diametroPunto(refugiados);
      const color = COLOR_NIVEL[nivel];

      const el = document.createElement("div");
      el.className = "relative cursor-pointer";
      el.style.width = `${d}px`;
      el.style.height = `${d}px`;
      el.title = `N.° ${centro.nro ?? "?"} · ${centro.nombre} · ${refugiados.toLocaleString(
        "es",
      )} damnificados · ${ETIQUETA_NIVEL[nivel]}`;

      if (nivel === "critico") {
        const pulso = document.createElement("span");
        pulso.className = "absolute inset-0 animate-ping rounded-full";
        pulso.style.background = color;
        pulso.style.opacity = "0.5";
        el.appendChild(pulso);
      }
      const punto = document.createElement("span");
      punto.className = "absolute inset-0 rounded-full border border-white/70";
      punto.style.background = color;
      punto.style.boxShadow = `0 0 ${Math.round(d * 0.6)}px ${color}66`;
      el.appendChild(punto);

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cbRef.current.onAbrirCentro?.(centro.id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(centro.geom.coordinates as [number, number])
        .addTo(map);
      marcadoresRef.current.push(marker);
    }
  }

  useEffect(() => {
    pintarMarcadores();
    encuadrarRed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centros]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border">
      <div ref={contenedorRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-[11px] text-white/90">
        {ORDEN_NIVELES.map((nivel) => {
          const n = conteoNivel[nivel];
          if (n === 0) return null;
          return (
            <span key={nivel} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: COLOR_NIVEL[nivel] }}
              />
              {ETIQUETA_NIVEL[nivel]}
              <span className="font-semibold tabular-nums">{n}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
