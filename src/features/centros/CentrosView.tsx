import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { PanelFlotante } from "@/components/PanelFlotante";
import { preloadLogosCuerpos } from "@/data/preloadLogosCuerpos";
import { cargarBaseMapaCentros, guardarBaseMapaCentros } from "@/data/preferenciasMapa";
import {
  cargarModoMarcadorCentros,
  cargarMostrarParteMarcador,
  cargarMostrarLeyendaMarcador,
  cargarMostrarCintaTotales,
  guardarModoMarcadorCentros,
  guardarMostrarParteMarcador,
  guardarMostrarLeyendaMarcador,
  guardarMostrarCintaTotales,
  type ModoMarcadorCentros,
} from "@/data/preferenciasMapa";
import type { BaseMapa } from "@/map/estiloMapa";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { aplicarPartesActualesACentros } from "@/domain/parteActualCentros";
import {
  type CentroTransitorio,
  type ClaveUnidadSebin,
  unidadSebinDe,
} from "@/domain/centrosTransitorios";
import type { Sesion } from "@/data/authSupabase";
import { puedeEscribir, puedeCrearCentros } from "@/domain/permisos";
import { useMapaCentros } from "@/contexts/MapaCentrosContext";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { CentrosMap, type CentrosMapHandle } from "./CentrosMap";
import { DetalleCentro } from "./DetalleCentro";
import { CentroForm } from "./CentroForm";
import { TableroCentros } from "./TableroCentros";
import { PanelCentros, calcularEstadosFilas } from "./PanelCentros";
import { ControlesMapaFlotantes } from "./ControlesMapaFlotantes";
import { TotalesMapaCentros } from "./TotalesMapaCentros";

interface OutletContext {
  sesion: Sesion;
}

/** Vista de conjunto: mapa o tablero de la red de Centros Transitorios. */
export function CentrosView() {
  const { sesion } = useOutletContext<OutletContext>();
  const location = useLocation();
  const vista = location.pathname.includes("/tablero") ? "tablero" : "mapa";
  const puedeEditar = puedeEscribir(sesion.user.rol);
  const puedeEliminar = puedeCrearCentros(sesion.user.rol);
  const navigate = useNavigate();
  const {
    panelCentrosAbierto,
    setPanelCentrosAbierto,
  } = useMapaCentros();

  const [baseMapa, setBaseMapa] = useState<BaseMapa>(
    () => cargarBaseMapaCentros() ?? "calles",
  );
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [editando, setEditando] = useState<CentroTransitorio | null>(null);
  const [modoMarcador, setModoMarcador] = useState<ModoMarcadorCentros>(
    () => cargarModoMarcadorCentros() ?? "color",
  );
  const [mostrarParteMarcador, setMostrarParteMarcador] = useState(
    () => cargarMostrarParteMarcador() ?? false,
  );
  const [mostrarLeyendaMarcador, setMostrarLeyendaMarcador] = useState(
    () => cargarMostrarLeyendaMarcador() ?? true,
  );
  const [mostrarCintaTotales, setMostrarCintaTotales] = useState(
    () => cargarMostrarCintaTotales() ?? true,
  );
  const [unidadFiltroMapa, setUnidadFiltroMapa] = useState<ClaveUnidadSebin | null>(null);
  const [expandidos, setExpandidos] = useState<Set<ClaveUnidadSebin>>(() => new Set());
  const [exportando, setExportando] = useState(false);
  const mapaRef = useRef<CentrosMapHandle>(null);

  useEffect(() => {
    guardarBaseMapaCentros(baseMapa);
  }, [baseMapa]);

  useEffect(() => {
    guardarModoMarcadorCentros(modoMarcador);
  }, [modoMarcador]);

  useEffect(() => {
    guardarMostrarParteMarcador(mostrarParteMarcador);
  }, [mostrarParteMarcador]);

  useEffect(() => {
    guardarMostrarLeyendaMarcador(mostrarLeyendaMarcador);
  }, [mostrarLeyendaMarcador]);

  useEffect(() => {
    guardarMostrarCintaTotales(mostrarCintaTotales);
  }, [mostrarCintaTotales]);

  useEffect(() => {
    if (modoMarcador !== "color") setUnidadFiltroMapa(null);
  }, [modoMarcador]);

  useEffect(() => {
    preloadLogosCuerpos();
  }, []);

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const snapshotsOcupacion = useOcupacionesCentros();
  const centrosBase = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const centros = useMemo(
    () => aplicarPartesActualesACentros(centrosBase, snapshotsOcupacion),
    [centrosBase, snapshotsOcupacion],
  );

  const estadosFilas = useMemo(() => calcularEstadosFilas(centros), [centros]);

  useEffect(() => {
    if (vista !== "mapa") return;
    if (sessionStorage.getItem("abrirListaCentros") === "1") {
      sessionStorage.removeItem("abrirListaCentros");
      setPanelCentrosAbierto(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, setPanelCentrosAbierto]);

  async function exportarVista() {
    setExportando(true);
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      await mapaRef.current?.exportarImagen(`centros-transitorios-caracas-${fecha}.png`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar la imagen del mapa.");
    } finally {
      setExportando(false);
    }
  }

  const centroSel = useMemo(
    () => centros.find((c) => c.id === seleccionado) ?? null,
    [centros, seleccionado],
  );

  function setExpandido(clave: ClaveUnidadSebin, abierto: boolean) {
    setExpandidos((prev) => {
      const s = new Set(prev);
      if (abierto) s.add(clave);
      else s.delete(clave);
      return s;
    });
  }

  function seleccionarDesdeLista(centro: CentroTransitorio) {
    if (!centro.geom) return;
    setSeleccionado(centro.id);
    setDetalleAbierto(false);
  }

  function seleccionarDesdeMapa(id: string | null) {
    if (id == null) {
      cerrarSeleccion();
      return;
    }
    setSeleccionado(id);
  }

  function cerrarSeleccion() {
    setSeleccionado(null);
    setDetalleAbierto(false);
  }

  function toggleDetalle() {
    if (!seleccionado) return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      navigate(`/centro/${seleccionado}`);
      return;
    }
    setDetalleAbierto((prev) => !prev);
  }

  function cerrarFormulario() {
    setEditando(null);
  }

  useEffect(() => {
    if (!seleccionado) return;
    const centro = centros.find((c) => c.id === seleccionado);
    if (centro) setExpandido(unidadSebinDe(centro), true);
  }, [seleccionado, centros]);

  return (
    <>
      <div className="relative h-full min-h-0">
        {vista === "mapa" ? (
          <>
            <CentrosMap
              ref={mapaRef}
              centros={centros}
              baseMapa={baseMapa}
              onCambiarBase={setBaseMapa}
              seleccionado={seleccionado}
              onSeleccionar={seleccionarDesdeMapa}
              modoMarcador={modoMarcador}
              onCambiarModoMarcador={setModoMarcador}
              mostrarParteMarcador={mostrarParteMarcador}
              onCambiarMostrarParteMarcador={setMostrarParteMarcador}
              mostrarLeyenda={mostrarLeyendaMarcador}
              onCambiarMostrarLeyenda={setMostrarLeyendaMarcador}
              mostrarCintaTotales={mostrarCintaTotales}
              onCambiarMostrarCintaTotales={setMostrarCintaTotales}
              unidadFiltro={unidadFiltroMapa}
              onCambiarUnidadFiltro={setUnidadFiltroMapa}
              detalleAbierto={detalleAbierto}
              onToggleDetalle={toggleDetalle}
              onExportar={() => void exportarVista()}
              exportando={exportando}
            />

            <ControlesMapaFlotantes
              centros={centros}
              estados={estadosFilas}
              seleccionado={seleccionado}
              onSeleccionarCentro={seleccionarDesdeLista}
              panelAbierto={panelCentrosAbierto}
              onAbrirPanel={() => setPanelCentrosAbierto(true)}
            />

            {mostrarCintaTotales && (
              <div className="map-controls-overlay pointer-events-none absolute inset-x-3 bottom-8 z-10 md:bottom-auto md:left-1/2 md:top-3 md:w-[calc(100%-29rem)] md:-translate-x-1/2">
                <TotalesMapaCentros centros={centros} />
              </div>
            )}

            <PanelCentros
              centros={centros}
              unidadFiltro={unidadFiltroMapa}
              onSeleccionarUnidad={setUnidadFiltroMapa}
              expandidos={expandidos}
              onSetExpandido={setExpandido}
              seleccionado={seleccionado}
              onSeleccionarCentro={seleccionarDesdeLista}
              abierto={panelCentrosAbierto}
              onCambiarAbierto={setPanelCentrosAbierto}
            />
          </>
        ) : (
          <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
            <TableroCentros
              centros={centros}
              onSeleccionar={(id) => navigate(`/centro/${id}`)}
              puedeCrearCentro={puedeEliminar}
            />
          </MarcoVista>
        )}

        {vista === "mapa" && centroSel && detalleAbierto && (
          <PanelFlotante
            titulo={`${centroSel.nro != null ? `N.° ${centroSel.nro} · ` : ""}${centroSel.nombre}`}
            descripcion={centroSel.parroquia}
            onCerrar={() => setDetalleAbierto(false)}
          >
            <DetalleCentro
              centro={centroSel}
              puedeEditar={puedeEditar}
              onEditar={() => setEditando(centroSel)}
            />
          </PanelFlotante>
        )}
      </div>

      {editando && (
        <CentroForm
          centro={editando}
          soloLectura={!puedeEditar}
          puedeEliminar={puedeEliminar}
          onCerrar={cerrarFormulario}
        />
      )}
    </>
  );
}
