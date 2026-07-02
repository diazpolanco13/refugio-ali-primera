import { useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./data/db";
import { eliminarLinea, eliminarPunto, eliminarSector, guardarLinea, guardarPunto, guardarSector } from "./data/repos";
import { vaciarMapaCompleto } from "./data/seed";
import {
  CATALOGO_LINEAS,
  CATALOGO_TIPOS,
  SECTOR_COLORES,
  type LineaReferencia,
  type PuntoServicio,
  type Sector,
  type TipoLinea,
  type TipoPunto,
} from "./domain/tipos";
import { MapView, type BaseMapa, type MapViewHandle, type ModoDibujo } from "./map/MapView";
import { ControlesMapa } from "./map/ControlesMapa";
import { cargarVista } from "./data/preferencias";
import { SectorForm } from "./features/sectores/SectorForm";
import { PuntoForm } from "./features/puntos/PuntoForm";
import { LineaForm } from "./features/lineas/LineaForm";
import { Tablero } from "./features/tablero/Tablero";
import { DashboardView } from "./features/dashboard/DashboardView";
import { Login } from "./features/auth/Login";
import { GestionUsuarios } from "./features/usuarios/GestionUsuarios";
import { PanelDistribucion } from "./features/distribucion/PanelDistribucion";
import { useSesion, type Sesion } from "./data/auth";
import { puedeEditarMapa, puedeGestionarUsuarios, permisosDeRol } from "./domain/permisos";
import { detenerSync, iniciarSync, useEstadoSync } from "./data/sync";
import { useEsMovil } from "./ui/useEsMovil";
import { Navbar } from "./components/Navbar";
import { PanelFlotante } from "./components/PanelFlotante";
import { PantallaCarga } from "./components/PantallaCarga";
import { BarChart3 } from "lucide-react";

type Pendiente =
  | { clase: "sector"; geom: GeoJSON.Polygon }
  | { clase: "punto"; geom: GeoJSON.Point }
  | { clase: "linea"; geom: GeoJSON.LineString; tipo: TipoLinea }
  | null;

type Editando =
  | { clase: "sector"; item: Sector }
  | { clase: "punto"; item: PuntoServicio }
  | { clase: "linea"; item: LineaReferencia }
  | null;

function AppInterna({ sesion }: { sesion: Sesion }) {
  const permisos = permisosDeRol(sesion.user.rol);
  const puedeEditar = puedeEditarMapa(sesion.user.rol);
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const esMovil = useEsMovil();
  const estadoSync = useEstadoSync();
  const sectores = useLiveQuery(() => db.sectores.toArray(), [], [] as Sector[]);
  const puntos = useLiveQuery(() => db.puntos.toArray(), [], [] as PuntoServicio[]);
  const lineas = useLiveQuery(() => db.lineas.toArray(), [], [] as LineaReferencia[]);

  const [capasVisibles, setCapasVisibles] = useState<Set<TipoPunto>>(
    () => new Set(CATALOGO_TIPOS.map((m) => m.tipo)),
  );
  const [lineasVisibles, setLineasVisibles] = useState<Set<TipoLinea>>(
    () => new Set(CATALOGO_LINEAS.map((m) => m.tipo)),
  );
  const [mostrarSectores, setMostrarSectores] = useState(true);
  const [mostrarLineas, setMostrarLineas] = useState(true);
  const [baseMapa, setBaseMapa] = useState<BaseMapa>("satelite");
  const [modoDibujo, setModoDibujo] = useState<ModoDibujo>("none");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente>(null);
  const [editando, setEditando] = useState<Editando>(null);
  const [tableroAbierto, setTableroAbierto] = useState(false);
  const [distribucionAbierto, setDistribucionAbierto] = useState(false);
  const [usuariosAbierto, setUsuariosAbierto] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [zoom, setZoom] = useState(() => cargarVista().zoom);
  const [ahora, setAhora] = useState(() => Date.now());
  const mapaRef = useRef<MapViewHandle>(null);

  function abrirTablero(v: boolean) {
    setTableroAbierto(v);
  }

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Reloj para refrescar los cronómetros de limpieza (cada 30 s).
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  async function marcarLimpio(id: string) {
    const p = puntos.find((x) => x.id === id);
    if (p) await guardarPunto({ ...p, ultimaLimpieza: Date.now() });
  }

  const conteos = useMemo(() => {
    const m = new Map<TipoPunto, number>();
    for (const p of puntos) m.set(p.tipo, (m.get(p.tipo) ?? 0) + 1);
    return m;
  }, [puntos]);

  function elegirDibujo(modo: ModoDibujo) {
    setModoEdicion(false);
    setModoDibujo((m) => (m === modo ? "none" : modo));
    // En móvil, cerrar los paneles para dejar el mapa despejado al dibujar.
    if (esMovil) setTableroAbierto(false);
  }

  function toggleCapa(tipo: TipoPunto) {
    setCapasVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(tipo)) s.delete(tipo);
      else s.add(tipo);
      return s;
    });
  }

  function toggleLinea(tipo: TipoLinea) {
    setLineasVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(tipo)) s.delete(tipo);
      else s.add(tipo);
      return s;
    });
  }

  const conteosLineas = useMemo(() => {
    const m = new Map<TipoLinea, number>();
    for (const l of lineas) m.set(l.tipo, (m.get(l.tipo) ?? 0) + 1);
    return m;
  }, [lineas]);

  const dibujando = modoDibujo !== "none";

  return (
    <div className="flex h-screen flex-col">
      <Navbar
        sesion={sesion}
        permisos={permisos}
        puedeEditar={puedeEditar}
        esAdmin={esAdmin}
        online={online}
        estadoSync={estadoSync}
        tableroAbierto={tableroAbierto}
        onToggleTablero={() => abrirTablero(!tableroAbierto)}
        onAbrirDistribucion={() => setDistribucionAbierto(true)}
        onAbrirUsuarios={() => setUsuariosAbierto(true)}
        onLimpiarDatos={async () => {
          const { online } = await vaciarMapaCompleto();
          if (!online) {
            alert(
              "Mapa vaciado en este dispositivo. Conéctate y repite la acción para borrarlo también del servidor.",
            );
          }
        }}
      />

      <main className="relative flex-1">
        <MapView
          ref={mapaRef}
          sectores={sectores}
          puntos={puntos}
          lineas={lineas}
          capasVisibles={capasVisibles}
          lineasVisibles={lineasVisibles}
          mostrarSectores={mostrarSectores}
          mostrarLineas={mostrarLineas}
          baseMapa={baseMapa}
          modoDibujo={modoDibujo}
          modoEdicion={modoEdicion}
          ahora={ahora}
          onVistaCambio={(z) => setZoom(z)}
          onSectorDibujado={(geom) => {
            setModoDibujo("none");
            setPendiente({ clase: "sector", geom });
          }}
          onPuntoDibujado={(geom) => {
            setModoDibujo("none");
            setPendiente({ clase: "punto", geom });
          }}
          onLineaDibujada={(geom) => {
            const tipo: TipoLinea =
              modoDibujo === "linea_calle"
                ? "calle"
                : modoDibujo === "linea_camineria"
                  ? "camineria"
                  : "limite_parque";
            setModoDibujo("none");
            setPendiente({ clase: "linea", geom, tipo });
          }}
          onSeleccionarSector={(id) => {
            const s = sectores.find((x) => x.id === id);
            if (s) setEditando({ clase: "sector", item: s });
          }}
          onSeleccionarPunto={(id) => {
            const p = puntos.find((x) => x.id === id);
            if (p) setEditando({ clase: "punto", item: p });
          }}
          onSeleccionarLinea={(id) => {
            const l = lineas.find((x) => x.id === id);
            if (l) setEditando({ clase: "linea", item: l });
          }}
          onMoverPunto={async (id, coords) => {
            const p = puntos.find((x) => x.id === id);
            if (p) await guardarPunto({ ...p, geom: { type: "Point", coordinates: coords } });
          }}
          onEditarSectorGeom={async (id, geom) => {
            const s = sectores.find((x) => x.id === id);
            if (s) await guardarSector({ ...s, geom });
          }}
          onEditarLineaGeom={async (id, geom) => {
            const l = lineas.find((x) => x.id === id);
            if (l) await guardarLinea({ ...l, geom });
          }}
        />

        <ControlesMapa
          baseMapa={baseMapa}
          onBaseMapa={setBaseMapa}
          zoom={zoom}
          mapaRef={mapaRef}
          capasVisibles={capasVisibles}
          onToggleCapa={toggleCapa}
          lineasVisibles={lineasVisibles}
          onToggleLinea={toggleLinea}
          mostrarSectores={mostrarSectores}
          onToggleSectores={() => setMostrarSectores((v) => !v)}
          mostrarLineas={mostrarLineas}
          onToggleMostrarLineas={() => setMostrarLineas((v) => !v)}
          conteos={conteos}
          conteosLineas={conteosLineas}
          oculto={esMovil && tableroAbierto}
          puedeEditar={puedeEditar}
          modoDibujo={modoDibujo}
          modoEdicion={modoEdicion}
          onDibujar={elegirDibujo}
          onEditar={() => {
            setModoDibujo("none");
            setModoEdicion((v) => !v);
            if (esMovil) setTableroAbierto(false);
          }}
        />

        {/* Banner de dibujo */}
        {dibujando && (
          <div className="absolute left-1/2 top-3 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-white shadow-lg">
            <span className="flex-1 text-xs font-medium leading-snug sm:text-sm">
              {modoDibujo === "poligono"
                ? "Toca cada vértice del sector; toca el primer punto (naranja) para cerrar"
                : modoDibujo === "rectangulo"
                  ? "Toca dos esquinas opuestas para dibujar el sector"
                  : modoDibujo === "linea_limite" ||
                      modoDibujo === "linea_calle" ||
                      modoDibujo === "linea_camineria"
                    ? "Toca cada vértice del trazo; doble toque o Enter para terminar"
                    : "Toca el mapa para ubicar el punto"}
            </span>
            <button
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 active:bg-white/40"
              onClick={() => setModoDibujo("none")}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Banner de edición */}
        {modoEdicion && (
          <div className="absolute left-1/2 top-3 z-30 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-white shadow-lg">
            <span className="flex-1 text-xs font-medium leading-snug sm:text-sm">
              Modo edición: arrastra íconos; mueve vértices de sectores y líneas
            </span>
            <button
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 active:bg-white/40"
              onClick={() => setModoEdicion(false)}
            >
              Salir
            </button>
          </div>
        )}

        {/* Tablero. Pantalla completa en móvil, tarjeta flotante en escritorio. */}
        {tableroAbierto && (
          <PanelFlotante
            titulo="Sala situacional"
            descripcion="Demografía, alertas y cobertura por sector"
            icono={<BarChart3 className="size-4 text-primary" />}
            onCerrar={() => setTableroAbierto(false)}
          >
            <Tablero
              sectores={sectores}
              puntos={puntos}
              ahora={ahora}
              puedeEditar={puedeEditar}
              onMarcarLimpio={marcarLimpio}
              onIrASector={(id) => {
                const s = sectores.find((x) => x.id === id);
                if (s) setEditando({ clase: "sector", item: s });
              }}
            />
          </PanelFlotante>
        )}

        {/* Distribución de comida e hidratación */}
        {distribucionAbierto && (
          <PanelDistribucion
            sesion={sesion}
            onCerrar={() => setDistribucionAbierto(false)}
          />
        )}

        {/* Gestión de usuarios (solo admin) */}
        {usuariosAbierto && (
          <GestionUsuarios
            usuarioActualId={sesion.user.sub}
            onCerrar={() => setUsuariosAbierto(false)}
          />
        )}

        {/* Formularios */}
        {pendiente?.clase === "sector" && (
          <SectorForm
            geom={pendiente.geom}
            soloLectura={!puedeEditar}
            colorSugerido={SECTOR_COLORES[sectores.length % SECTOR_COLORES.length]}
            onGuardar={(d) => guardarSector(d)}
            onCerrar={() => setPendiente(null)}
          />
        )}
        {pendiente?.clase === "punto" && (
          <PuntoForm
            geom={pendiente.geom}
            soloLectura={!puedeEditar}
            onGuardar={async (d) => {
              await guardarPunto(d);
              setPendiente(null);
            }}
            onCerrar={() => setPendiente(null)}
          />
        )}
        {editando?.clase === "sector" && (
          <SectorForm
            geom={editando.item.geom}
            inicial={editando.item}
            soloLectura={!puedeEditar}
            colorSugerido={editando.item.color}
            onGuardar={(d) => guardarSector(d)}
            onEliminar={async () => {
              await eliminarSector(editando.item.id);
              setEditando(null);
            }}
            onCerrar={() => setEditando(null)}
          />
        )}
        {editando?.clase === "punto" && (
          <PuntoForm
            geom={editando.item.geom}
            inicial={editando.item}
            soloLectura={!puedeEditar}
            onGuardar={async (d) => {
              await guardarPunto(d);
              setEditando(null);
            }}
            onEliminar={async () => {
              await eliminarPunto(editando.item.id);
              setEditando(null);
            }}
            onCerrar={() => setEditando(null)}
          />
        )}
        {pendiente?.clase === "linea" && (
          <LineaForm
            geom={pendiente.geom}
            tipoInicial={pendiente.tipo}
            soloLectura={!puedeEditar}
            onGuardar={async (d) => {
              await guardarLinea(d);
              setPendiente(null);
            }}
            onCerrar={() => setPendiente(null)}
          />
        )}
        {editando?.clase === "linea" && (
          <LineaForm
            geom={editando.item.geom}
            inicial={editando.item}
            soloLectura={!puedeEditar}
            onGuardar={async (d) => {
              await guardarLinea(d);
              setEditando(null);
            }}
            onEliminar={async () => {
              await eliminarLinea(editando.item.id);
              setEditando(null);
            }}
            onCerrar={() => setEditando(null)}
          />
        )}
      </main>
    </div>
  );
}

export function App() {
  const sesion = useSesion();
  const [arrancando, setArrancando] = useState(true);

  useEffect(() => {
    setArrancando(false);
  }, []);

  useEffect(() => {
    if (sesion) iniciarSync();
    else detenerSync();
  }, [sesion?.token]);

  if (arrancando) return <PantallaCarga />;
  if (!sesion) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<AppInterna sesion={sesion} />} />
      <Route path="/dashboard" element={<DashboardView sesion={sesion} />} />
      <Route path="*" element={<AppInterna sesion={sesion} />} />
    </Routes>
  );
}
