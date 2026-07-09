// Mapa de la sala situacional: reutiliza CentrosMap (mismos marcadores SEBIN,
// leyenda y base) que /centros/mapa. Clic en un campamento → ficha.

import { useCallback, useState } from "react";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { cargarBaseMapaCentros, type ModoMarcadorCentros } from "@/data/preferenciasMapa";
import type { BaseMapa } from "@/map/estiloMapa";
import type { ClaveUnidadSebin } from "@/domain/centrosTransitorios";
import { CentrosMap } from "@/features/centros/CentrosMap";

interface Props {
  centros: CentroTransitorio[];
  /** Navegar a la ficha del campamento al seleccionar un punto. */
  onAbrirCentro?: (id: string) => void;
}

export function MapaRedSala({ centros, onAbrirCentro }: Props) {
  const [baseMapa, setBaseMapa] = useState<BaseMapa>(
    () => cargarBaseMapaCentros() ?? "calles",
  );
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [modoMarcador, setModoMarcador] = useState<ModoMarcadorCentros>("color");
  const [mostrarParteMarcador, setMostrarParteMarcador] = useState(true);
  const [mostrarLeyenda, setMostrarLeyenda] = useState(true);
  const [mostrarCintaTotales, setMostrarCintaTotales] = useState(false);
  const [unidadFiltro, setUnidadFiltro] = useState<ClaveUnidadSebin | null>(null);

  const onSeleccionar = useCallback(
    (id: string | null) => {
      setSeleccionado(id);
      if (id) onAbrirCentro?.(id);
    },
    [onAbrirCentro],
  );

  return (
    <div className="relative h-full min-h-[280px] w-full overflow-hidden rounded-xl border border-border">
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
        unidadFiltro={unidadFiltro}
        onCambiarUnidadFiltro={setUnidadFiltro}
        detalleAbierto={false}
      />
    </div>
  );
}
