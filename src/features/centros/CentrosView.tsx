import { useEffect, useMemo, useRef, useState } from "react";
import { PanelFlotante } from "@/components/PanelFlotante";
import { cargarBaseMapaCentros, guardarBaseMapaCentros } from "@/data/preferenciasMapa";
import type { BaseMapa } from "@/map/estiloMapa";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { nuevoId } from "@/data/reposSupabase";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import {
  CATALOGO_CUERPOS,
  normalizarCuerpo,
  type CentroTransitorio,
  type ClaveCuerpo,
} from "@/domain/centrosTransitorios";
import type { Sesion } from "@/data/authSupabase";
import { puedeEditarMapa, permisosDeRol, puedeGestionarUsuarios } from "@/domain/permisos";
import { useSupabaseConectado } from "@/data/useSupabaseConectado";
import { Navbar } from "@/components/Navbar";
import { CentrosMap, type CentrosMapHandle } from "./CentrosMap";
import { DetalleCentro } from "./DetalleCentro";
import { CentroForm } from "./CentroForm";
import { TableroCentros } from "./TableroCentros";
import { PanelCentros } from "./PanelCentros";

interface Props {
  sesion: Sesion;
}

type Vista = "mapa" | "tablero";

/** Vista de conjunto: mapa/tablero de Caracas con los 50 Centros Transitorios. */
export function CentrosView({ sesion }: Props) {
  const permisos = permisosDeRol(sesion.user.rol);
  const puedeEditar = puedeEditarMapa(sesion.user.rol);
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const conectado = useSupabaseConectado();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [vista, setVista] = useState<Vista>("mapa");

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const [baseMapa, setBaseMapa] = useState<BaseMapa>(
    () => cargarBaseMapaCentros() ?? "calles",
  );
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [editando, setEditando] = useState<CentroTransitorio | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [cuerposVisibles, setCuerposVisibles] = useState<Set<ClaveCuerpo>>(
    () => new Set(CATALOGO_CUERPOS.map((c) => c.clave)),
  );
  const [expandidos, setExpandidos] = useState<Set<ClaveCuerpo>>(() => new Set());
  const [panelAbierto, setPanelAbierto] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 640,
  );
  const [exportando, setExportando] = useState(false);
  const mapaRef = useRef<CentrosMapHandle>(null);

  useEffect(() => {
    guardarBaseMapaCentros(baseMapa);
  }, [baseMapa]);

  // Los centros viven en Supabase (tabla blob+jsonb `centros`). El catálogo
  // base se carga en la migración de Fase 2; aquí solo leemos.
  //
  // Limitación: `nro` no es columna top-level (vive dentro de `data` jsonb),
  // así que no se puede ordenar server-side con `.order("nro")`. Lo hacemos en
  // cliente tras el select. Para ~50 filas es trivial.
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

  /** 
   * Seleccionar desde la LISTA (panel lateral o buscador): vuela al centro y abre
   * solo la nube informativa (popup) — sin abrir el detalle completo. Pensado para
   * navegar rápido entre centros sin perder el panel de browse.
   */
  function seleccionarDesdeLista(centro: CentroTransitorio) {
    if (!centro.geom) return;
    const clave = normalizarCuerpo(centro.cuerpo);
    setCuerposVisibles((prev) => (prev.has(clave) ? prev : new Set(prev).add(clave)));
    setSeleccionado(centro.id);
    setDetalleAbierto(false);
  }

  /** 
   * Seleccionar desde el MAPA (clic en el marcador): vuela y abre SOLO la nube
   * informativa (popup). El panel DetalleCentro NO se abre aquí — se abre (o
   * cierra) únicamente con el botón "detalles" de la nube. Si el panel ya estaba
   * abierto para otro centro, simplemente cambia al nuevo (la nube acompaña).
   */
  function seleccionarDesdeMapa(id: string | null) {
    if (id == null) {
      cerrarSeleccion();
      return;
    }
    setSeleccionado(id);
  }

  /** Cerrar la selección: limpia la nube y el detalle. */
  function cerrarSeleccion() {
    setSeleccionado(null);
    setDetalleAbierto(false);
  }

  /** Alternar (abrir/cerrar) el detalle completo del centro seleccionado (botón "detalles" de la nube). */
  function toggleDetalle() {
    if (!seleccionado) return;
    setDetalleAbierto((prev) => !prev);
  }

  /** Abre el formulario de alta con un centro en blanco (siguiente N.° libre). */
  function abrirNuevoCentro() {
    const nro = centros.reduce((max, c) => Math.max(max, c.nro ?? 0), 0) + 1;
    setEditando({
      id: nuevoId(),
      nro,
      nombre: "",
      grupo: "Área Metropolitana",
      cuerpo: "",
      parroquia: "",
      direccion: "",
      mapsUrl: "",
      geom: null,
      notas: "",
      estado: "preparacion",
    });
    setCreandoNuevo(true);
  }

  function cerrarFormulario() {
    setEditando(null);
    setCreandoNuevo(false);
  }

  useEffect(() => {
    if (!seleccionado) return;
    const centro = centros.find((c) => c.id === seleccionado);
    if (centro) setExpandido(normalizarCuerpo(centro.cuerpo), true);
  }, [seleccionado, centros]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <Navbar
        sesion={sesion}
        permisos={permisos}
        puedeEditar={puedeEditar}
        esAdmin={esAdmin}
        online={online}
        conectado={conectado}
        vista={vista}
        onCambiarVista={setVista}
      />

      <div className="relative min-h-0 flex-1">
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

            <PanelCentros
              centros={centros}
              cuerposVisibles={cuerposVisibles}
              onToggleCuerpo={toggleCuerpo}
              expandidos={expandidos}
              onSetExpandido={setExpandido}
              seleccionado={seleccionado}
              onSeleccionarCentro={seleccionarDesdeLista}
              abierto={panelAbierto}
              onCambiarAbierto={setPanelAbierto}
              onNuevoCentro={puedeEditar ? abrirNuevoCentro : undefined}
            />
          </>
        ) : (
          <TableroCentros
            centros={centros}
            seleccionado={seleccionado}
            onSeleccionar={(id) => {
              setSeleccionado(id);
              setDetalleAbierto(true);
            }}
          />
        )}

        {/* Panel de detalle del centro seleccionado (solo cuando se abre a fondo) */}
        {centroSel && detalleAbierto && (
          <PanelFlotante
            titulo={`N.° ${centroSel.nro} · ${centroSel.nombre}`}
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

      {/* Formulario de registro/edición (y alta de centros nuevos) */}
      {editando && (
        <CentroForm
          centro={editando}
          soloLectura={!puedeEditar}
          esNuevo={creandoNuevo}
          onCerrar={cerrarFormulario}
        />
      )}
    </div>
  );
}
