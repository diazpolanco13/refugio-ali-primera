import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { PanelFlotante } from "@/components/PanelFlotante";
import { preloadLogosCuerpos } from "@/data/preloadLogosCuerpos";
import { cargarBaseMapaCentros, guardarBaseMapaCentros } from "@/data/preferenciasMapa";
import type { BaseMapa } from "@/map/estiloMapa";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import {
  CATALOGO_CUERPOS,
  normalizarCuerpo,
  type CentroTransitorio,
  type ClaveCuerpo,
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
  const [cuerposVisibles, setCuerposVisibles] = useState<Set<ClaveCuerpo>>(
    () => new Set(CATALOGO_CUERPOS.map((c) => c.clave)),
  );
  const [expandidos, setExpandidos] = useState<Set<ClaveCuerpo>>(() => new Set());
  const [exportando, setExportando] = useState(false);
  const mapaRef = useRef<CentrosMapHandle>(null);

  useEffect(() => {
    guardarBaseMapaCentros(baseMapa);
  }, [baseMapa]);

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
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
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

  const centrosVisibles = useMemo(
    () => centros.filter((c) => cuerposVisibles.has(normalizarCuerpo(c.cuerpo))),
    [centros, cuerposVisibles],
  );

  const centroSel = useMemo(
    () => centros.find((c) => c.id === seleccionado) ?? null,
    [centros, seleccionado],
  );

  function toggleCuerpo(clave: ClaveCuerpo) {
    setCuerposVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }

  function setExpandido(clave: ClaveCuerpo, abierto: boolean) {
    setExpandidos((prev) => {
      const s = new Set(prev);
      if (abierto) s.add(clave);
      else s.delete(clave);
      return s;
    });
  }

  function seleccionarDesdeLista(centro: CentroTransitorio) {
    if (!centro.geom) return;
    const clave = normalizarCuerpo(centro.cuerpo);
    setCuerposVisibles((prev) => (prev.has(clave) ? prev : new Set(prev).add(clave)));
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
    if (centro) setExpandido(normalizarCuerpo(centro.cuerpo), true);
  }, [seleccionado, centros]);

  return (
    <>
      <div className="relative h-full min-h-0">
        {vista === "mapa" ? (
          <>
            <CentrosMap
              ref={mapaRef}
              centros={centrosVisibles}
              baseMapa={baseMapa}
              onCambiarBase={setBaseMapa}
              seleccionado={seleccionado}
              onSeleccionar={seleccionarDesdeMapa}
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

            <PanelCentros
              centros={centros}
              cuerposVisibles={cuerposVisibles}
              onToggleCuerpo={toggleCuerpo}
              expandidos={expandidos}
              onSetExpandido={setExpandido}
              seleccionado={seleccionado}
              onSeleccionarCentro={seleccionarDesdeLista}
              abierto={panelCentrosAbierto}
              onCambiarAbierto={setPanelCentrosAbierto}
            />
          </>
        ) : (
          <MarcoVista
            ancho={ANCHO_VISTA_PRINCIPAL}
            className="overflow-hidden"
            marcoClassName="h-full min-h-0"
          >
            <TableroCentros
              centros={centros}
              onSeleccionar={(id) => navigate(`/centro/${id}`)}
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
