// Mapa de la sala situacional: reutiliza CentrosMap. Clic → ficha.
// Botón "Vista completa" abre Dialog a casi 100dvh sin salir de /dashboard.

import { useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { cargarBaseMapaCentros, type ModoMarcadorCentros } from "@/data/preferenciasMapa";
import type { BaseMapa } from "@/map/estiloMapa";
import { BASE_MAPA_DEFECTO } from "@/map/estiloMapa";
import type { ClaveUnidadSebin } from "@/domain/centrosTransitorios";
import { CentrosMap } from "@/features/centros/CentrosMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  centros: CentroTransitorio[];
  /** Navegar a la ficha del campamento al seleccionar un punto. */
  onAbrirCentro?: (id: string) => void;
  /**
   * IDs resaltados por ámbito (supervisor/operador).
   * `null` = sin atenuación por asignación.
   */
  idsResaltadosAmbito?: ReadonlySet<string> | null;
}

function MapaInterno({
  centros,
  onAbrirCentro,
  seleccionado,
  setSeleccionado,
  baseMapa,
  setBaseMapa,
  modoMarcador,
  setModoMarcador,
  mostrarParteMarcador,
  setMostrarParteMarcador,
  mostrarLeyenda,
  setMostrarLeyenda,
  mostrarCintaTotales,
  setMostrarCintaTotales,
  colorearPorUnidad,
  setColorearPorUnidad,
  unidadesFiltro,
  alternarUnidadFiltro,
  setUnidadesFiltro,
  idsResaltadosAmbito,
}: {
  centros: CentroTransitorio[];
  onAbrirCentro?: (id: string) => void;
  seleccionado: string | null;
  setSeleccionado: (id: string | null) => void;
  baseMapa: BaseMapa;
  setBaseMapa: (b: BaseMapa) => void;
  modoMarcador: ModoMarcadorCentros;
  setModoMarcador: (m: ModoMarcadorCentros) => void;
  mostrarParteMarcador: boolean;
  setMostrarParteMarcador: (v: boolean) => void;
  mostrarLeyenda: boolean;
  setMostrarLeyenda: (v: boolean) => void;
  mostrarCintaTotales: boolean;
  setMostrarCintaTotales: (v: boolean) => void;
  colorearPorUnidad: boolean;
  setColorearPorUnidad: (v: boolean) => void;
  unidadesFiltro: Set<ClaveUnidadSebin>;
  alternarUnidadFiltro: (clave: ClaveUnidadSebin) => void;
  setUnidadesFiltro: (s: Set<ClaveUnidadSebin>) => void;
  idsResaltadosAmbito?: ReadonlySet<string> | null;
}) {
  const onSeleccionar = useCallback(
    (id: string | null) => {
      if (id && idsResaltadosAmbito && !idsResaltadosAmbito.has(id)) return;
      setSeleccionado(id);
      if (id) onAbrirCentro?.(id);
    },
    [idsResaltadosAmbito, onAbrirCentro, setSeleccionado],
  );

  return (
    <CentrosMap
      centros={centros}
      baseMapa={baseMapa}
      onCambiarBase={setBaseMapa}
      seleccionado={seleccionado}
      onSeleccionar={onSeleccionar}
      modoMarcador={modoMarcador}
      onCambiarModoMarcador={setModoMarcador}
      mostrarParteMarcador={mostrarParteMarcador}
      onCambiarMostrarParteMarcador={setMostrarParteMarcador}
      mostrarLeyenda={mostrarLeyenda}
      onCambiarMostrarLeyenda={setMostrarLeyenda}
      mostrarCintaTotales={mostrarCintaTotales}
      onCambiarMostrarCintaTotales={setMostrarCintaTotales}
      colorearPorUnidad={colorearPorUnidad}
      onCambiarColorearPorUnidad={setColorearPorUnidad}
      unidadesFiltro={unidadesFiltro}
      onAlternarUnidadFiltro={alternarUnidadFiltro}
      onLimpiarUnidadesFiltro={() => setUnidadesFiltro(new Set())}
      idsResaltadosAmbito={idsResaltadosAmbito}
      detalleAbierto={false}
    />
  );
}

export function MapaRedSala({
  centros,
  onAbrirCentro,
  idsResaltadosAmbito = null,
}: Props) {
  const [baseMapa, setBaseMapa] = useState<BaseMapa>(
    () => cargarBaseMapaCentros() ?? BASE_MAPA_DEFECTO,
  );
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [modoMarcador, setModoMarcador] = useState<ModoMarcadorCentros>("color");
  const [mostrarParteMarcador, setMostrarParteMarcador] = useState(true);
  const [mostrarLeyenda, setMostrarLeyenda] = useState(true);
  const [mostrarCintaTotales, setMostrarCintaTotales] = useState(false);
  const [colorearPorUnidad, setColorearPorUnidad] = useState(false);
  const [unidadesFiltro, setUnidadesFiltro] = useState<Set<ClaveUnidadSebin>>(
    () => new Set(),
  );
  const [fullscreen, setFullscreen] = useState(false);

  function alternarUnidadFiltro(clave: ClaveUnidadSebin) {
    setUnidadesFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  // Forzar resize del mapa MapLibre al abrir/cerrar el dialog.
  useEffect(() => {
    if (!fullscreen) return;
    const t = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 120);
    return () => window.clearTimeout(t);
  }, [fullscreen]);

  const propsMapa = {
    centros,
    onAbrirCentro,
    seleccionado,
    setSeleccionado,
    baseMapa,
    setBaseMapa,
    modoMarcador,
    setModoMarcador,
    mostrarParteMarcador,
    setMostrarParteMarcador,
    mostrarLeyenda,
    setMostrarLeyenda,
    mostrarCintaTotales,
    setMostrarCintaTotales,
    colorearPorUnidad,
    setColorearPorUnidad,
    unidadesFiltro,
    alternarUnidadFiltro,
    setUnidadesFiltro,
    idsResaltadosAmbito,
  };

  return (
    <>
      <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-xl border border-border">
        <div className="absolute right-2 top-2 z-20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 bg-background/90 shadow-sm backdrop-blur"
            onClick={() => setFullscreen(true)}
          >
            <Maximize2 className="size-4" />
            <span className="hidden sm:inline">Vista completa</span>
          </Button>
        </div>
        {!fullscreen && <MapaInterno {...propsMapa} />}
      </div>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent
          showCloseButton={false}
          className="h-[100dvh] max-h-[100dvh] w-screen max-w-none gap-0 rounded-none border-0 p-0 sm:top-0 sm:left-0 sm:h-[100dvh] sm:max-h-[100dvh] sm:w-screen sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none"
        >
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-2 sm:pr-4">
            <DialogTitle className="text-base">Mapa de la red · vista completa</DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setFullscreen(false)}
            >
              <Minimize2 className="size-4" />
              Cerrar
            </Button>
          </DialogHeader>
          <div className="relative min-h-0 flex-1">
            {fullscreen && <MapaInterno {...propsMapa} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
