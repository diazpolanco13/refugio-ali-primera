import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./data/db";
import { eliminarPunto, eliminarSector, guardarPunto, guardarSector } from "./data/repos";
import { cargarEjemplo, limpiarTodo } from "./data/seed";
import {
  CATALOGO_TIPOS,
  SECTOR_COLORES,
  type PuntoServicio,
  type Sector,
  type TipoPunto,
} from "./domain/tipos";
import { MapView, type BaseMapa, type MapViewHandle, type ModoDibujo } from "./map/MapView";
import { BASES_DISPONIBLES } from "./map/estiloMapa";
import { cargarVista } from "./data/preferencias";
import { SectorForm } from "./features/sectores/SectorForm";
import { PuntoForm } from "./features/puntos/PuntoForm";
import { Tablero } from "./features/tablero/Tablero";
import { Login } from "./features/auth/Login";
import { cerrarSesion, useSesion, type Sesion } from "./data/auth";
import { detenerSync, iniciarSync, useEstadoSync, type EstadoSync } from "./data/sync";
import { useEsMovil } from "./ui/useEsMovil";

type Pendiente =
  | { clase: "sector"; geom: GeoJSON.Polygon }
  | { clase: "punto"; geom: GeoJSON.Point }
  | null;

type Editando =
  | { clase: "sector"; item: Sector }
  | { clase: "punto"; item: PuntoServicio }
  | null;

function AppInterna({ sesion }: { sesion: Sesion }) {
  const puedeEditar = sesion.user.rol !== "visor";
  const esMovil = useEsMovil();
  const estadoSync = useEstadoSync();
  const sectores = useLiveQuery(() => db.sectores.toArray(), [], [] as Sector[]);
  const puntos = useLiveQuery(() => db.puntos.toArray(), [], [] as PuntoServicio[]);

  const [capasVisibles, setCapasVisibles] = useState<Set<TipoPunto>>(
    () => new Set(CATALOGO_TIPOS.map((m) => m.tipo)),
  );
  const [mostrarSectores, setMostrarSectores] = useState(true);
  const [baseMapa, setBaseMapa] = useState<BaseMapa>("satelite");
  const [modoDibujo, setModoDibujo] = useState<ModoDibujo>("none");
  const [modoEdicion, setModoEdicion] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente>(null);
  const [editando, setEditando] = useState<Editando>(null);
  // En móvil el panel arranca cerrado (no debe tapar el mapa).
  const [panelAbierto, setPanelAbierto] = useState(
    () => !(typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches),
  );
  const [tableroAbierto, setTableroAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [zoom, setZoom] = useState(() => cargarVista().zoom);
  const [ahora, setAhora] = useState(() => Date.now());
  const mapaRef = useRef<MapViewHandle>(null);

  // En móvil, abrir panel y tablero es excluyente (ambos ocupan pantalla).
  function abrirPanel(v: boolean) {
    setPanelAbierto(v);
    if (v && esMovil) setTableroAbierto(false);
  }
  function abrirTablero(v: boolean) {
    setTableroAbierto(v);
    if (v && esMovil) setPanelAbierto(false);
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
    if (esMovil) {
      setPanelAbierto(false);
      setTableroAbierto(false);
    }
  }

  function toggleCapa(tipo: TipoPunto) {
    setCapasVisibles((prev) => {
      const s = new Set(prev);
      if (s.has(tipo)) s.delete(tipo);
      else s.add(tipo);
      return s;
    });
  }

  const dibujando = modoDibujo !== "none";

  return (
    <div className="flex h-screen flex-col">
      {/* Cabecera */}
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-2 sm:px-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-slate-300 hover:bg-slate-800 active:bg-slate-700"
            onClick={() => abrirPanel(!panelAbierto)}
            aria-label="Alternar panel"
          >
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight text-slate-100">
              <span className="sm:hidden">Sala Situacional</span>
              <span className="hidden sm:inline">
                Sala Situacional — Refugio Parque del Oeste
              </span>
            </h1>
            <IndicadorSync online={online} estado={estadoSync} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="flex h-10 items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800 active:bg-slate-700"
            onClick={() => abrirTablero(!tableroAbierto)}
          >
            📊<span className="hidden xs:inline sm:inline">Tablero</span>
          </button>
          {/* Menú de usuario (accesible también en móvil) */}
          <div className="relative">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 active:bg-slate-700"
              onClick={() => setMenuUsuario((v) => !v)}
              aria-label="Usuario"
            >
              👤
            </button>
            {menuUsuario && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuUsuario(false)}
                />
                <div className="absolute right-0 top-12 z-40 w-52 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="truncate text-sm font-medium text-slate-100">
                      {sesion.user.nombre || sesion.user.username}
                    </div>
                    <div className="mt-0.5">
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-300">
                        {sesion.user.rol}
                      </span>
                    </div>
                  </div>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-300 hover:bg-red-950/60"
                    onClick={() => cerrarSesion()}
                  >
                    🚪 Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <MapView
          ref={mapaRef}
          sectores={sectores}
          puntos={puntos}
          capasVisibles={capasVisibles}
          mostrarSectores={mostrarSectores}
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
          onSeleccionarSector={(id) => {
            const s = sectores.find((x) => x.id === id);
            if (s) setEditando({ clase: "sector", item: s });
          }}
          onSeleccionarPunto={(id) => {
            const p = puntos.find((x) => x.id === id);
            if (p) setEditando({ clase: "punto", item: p });
          }}
          onMoverPunto={async (id, coords) => {
            const p = puntos.find((x) => x.id === id);
            if (p) await guardarPunto({ ...p, geom: { type: "Point", coordinates: coords } });
          }}
          onEditarSectorGeom={async (id, geom) => {
            const s = sectores.find((x) => x.id === id);
            if (s) await guardarSector({ ...s, geom });
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
              Modo edición: arrastra los íconos; toca un sector y mueve sus vértices
            </span>
            <button
              className="shrink-0 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 active:bg-white/40"
              onClick={() => setModoEdicion(false)}
            >
              Salir
            </button>
          </div>
        )}

        {/* Backdrop (solo móvil) al abrir el panel */}
        {panelAbierto && (
          <div
            className="absolute inset-0 z-10 bg-black/50 md:hidden"
            onClick={() => setPanelAbierto(false)}
          />
        )}

        {/* Panel de control (capas y ajustes). Drawer en móvil, tarjeta flotante en escritorio. */}
        <div
          className={`absolute z-20 flex flex-col overflow-hidden border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur transition-transform duration-200 ${
            panelAbierto ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } inset-y-0 left-0 w-[85%] max-w-xs border-r md:inset-y-auto md:left-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-72 md:rounded-xl md:border ${
            panelAbierto ? "" : "md:hidden"
          }`}
        >
          {/* Cabecera del drawer (visible en móvil) */}
          <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3 md:hidden">
            <span className="text-sm font-semibold text-slate-100">Controles</span>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
              onClick={() => setPanelAbierto(false)}
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto p-3">
            {/* Base del mapa */}
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-slate-400">Base del mapa</div>
              <div className="grid grid-cols-2 gap-1.5">
                {BASES_DISPONIBLES.map((b) => (
                  <button
                    key={b.valor}
                    className={`rounded-md py-2 text-sm ${
                      baseMapa === b.valor
                        ? "bg-slate-700 text-white ring-1 ring-teal-500"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                    onClick={() => setBaseMapa(b.valor)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vista / zoom (se guarda en localStorage) */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-400">
                <span>Zoom</span>
                <span className="tabular-nums text-slate-300">{zoom.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={13}
                  max={20}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => {
                    const z = Number(e.target.value);
                    setZoom(z);
                    mapaRef.current?.setZoom(z);
                  }}
                  className="h-2 flex-1 cursor-pointer accent-teal-500"
                />
                <button
                  title="Centrar en el parque"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-600 text-sm text-slate-200 hover:bg-slate-800"
                  onClick={() => mapaRef.current?.volverAlParque()}
                >
                  🎯
                </button>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Tu vista (centro y zoom) se guarda automáticamente.
              </div>
            </div>

            {/* Capas */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Capas</span>
            </div>
            <label className="mb-1 flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-slate-800">
              <span className="flex items-center gap-2 text-sm text-slate-200">
                ▱ Sectores
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-teal-500"
                checked={mostrarSectores}
                onChange={() => setMostrarSectores((v) => !v)}
              />
            </label>
            {CATALOGO_TIPOS.map((m) => (
              <label
                key={m.tipo}
                className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-slate-800"
              >
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: m.color }}
                  />
                  {m.icono} {m.label}
                  <span className="text-xs text-slate-500">
                    {conteos.get(m.tipo) ?? 0}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-teal-500"
                  checked={capasVisibles.has(m.tipo)}
                  onChange={() => toggleCapa(m.tipo)}
                />
              </label>
            ))}

            {/* Datos de ejemplo / limpiar (solo admin) */}
            {sesion.user.rol === "admin" && (
              <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                {sectores.length === 0 && puntos.length === 0 ? (
                  <button
                    className="flex-1 rounded-md border border-slate-600 py-2 text-xs text-slate-300 hover:bg-slate-800"
                    onClick={() => cargarEjemplo()}
                  >
                    Cargar ejemplo
                  </button>
                ) : (
                  <button
                    className="flex-1 rounded-md border border-red-900 py-2 text-xs text-red-300 hover:bg-red-950"
                    onClick={() => {
                      if (confirm("¿Borrar todos los datos locales?")) limpiarTodo();
                    }}
                  >
                    Limpiar datos
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tablero. Pantalla completa en móvil, tarjeta flotante en escritorio. */}
        {tableroAbierto && (
          <div className="absolute inset-0 z-20 flex flex-col overflow-hidden border-slate-700 bg-slate-900 shadow-xl md:inset-y-auto md:left-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-80 md:rounded-xl md:border md:bg-slate-900/95 md:backdrop-blur">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-sm font-semibold text-slate-100">📊 Sala situacional</span>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800"
                onClick={() => setTableroAbierto(false)}
                aria-label="Cerrar tablero"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
            </div>
          </div>
        )}

        {/* Barra de herramientas de dibujo (flotante inferior, táctil). Se
            oculta para el visor, al abrir paneles en móvil, o al editar/dibujar. */}
        {puedeEditar && !(esMovil && (panelAbierto || tableroAbierto)) && (
          <BarraDibujo
            modoDibujo={modoDibujo}
            modoEdicion={modoEdicion}
            oculto={dibujando || modoEdicion}
            onDibujar={elegirDibujo}
            onEditar={() => {
              setModoDibujo("none");
              setModoEdicion((v) => !v);
              if (esMovil) {
                setPanelAbierto(false);
                setTableroAbierto(false);
              }
            }}
          />
        )}

        {/* Formularios */}
        {pendiente?.clase === "sector" && (
          <SectorForm
            geom={pendiente.geom}
            soloLectura={!puedeEditar}
            colorSugerido={SECTOR_COLORES[sectores.length % SECTOR_COLORES.length]}
            onGuardar={async (d) => {
              await guardarSector(d);
              setPendiente(null);
            }}
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
            onGuardar={async (d) => {
              await guardarSector(d);
              setEditando(null);
            }}
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
      </main>
    </div>
  );
}

/** Barra flotante inferior con las herramientas de dibujo (táctil). */
function BarraDibujo({
  modoDibujo,
  modoEdicion,
  oculto,
  onDibujar,
  onEditar,
}: {
  modoDibujo: ModoDibujo;
  modoEdicion: boolean;
  oculto: boolean;
  onDibujar: (modo: ModoDibujo) => void;
  onEditar: () => void;
}) {
  // Cuando se está dibujando/editando, el banner superior ya guía al usuario;
  // ocultamos la barra para dejar el mapa despejado.
  if (oculto) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-stretch gap-1.5 rounded-2xl border border-slate-700 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur">
        <BotonBarra
          activo={modoDibujo === "rectangulo"}
          icono="▭"
          label="Sector"
          onClick={() => onDibujar("rectangulo")}
        />
        <BotonBarra
          activo={modoDibujo === "poligono"}
          icono="⬠"
          label="Libre"
          onClick={() => onDibujar("poligono")}
        />
        <BotonBarra
          activo={modoDibujo === "punto"}
          icono="📍"
          label="Punto"
          onClick={() => onDibujar("punto")}
        />
        <BotonBarra
          activo={modoEdicion}
          icono="✏️"
          label="Editar"
          onClick={onEditar}
        />
      </div>
    </div>
  );
}

function BotonBarra({
  activo,
  icono,
  label,
  onClick,
}: {
  activo: boolean;
  icono: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-[11px] font-semibold transition active:scale-95 ${
        activo
          ? "bg-teal-600 text-white ring-2 ring-teal-400"
          : "text-slate-200 hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      <span className="text-lg leading-none">{icono}</span>
      {label}
    </button>
  );
}

function IndicadorSync({ online, estado }: { online: boolean; estado: EstadoSync }) {
  const { texto, dot, cls } = !online
    ? { texto: "Sin conexión", dot: "bg-amber-400", cls: "text-amber-300" }
    : estado === "sincronizando"
      ? { texto: "Sincronizando…", dot: "bg-sky-400 animate-pulse", cls: "text-sky-300" }
      : estado === "error"
        ? { texto: "Sin sync", dot: "bg-red-400", cls: "text-red-300" }
        : { texto: "En línea", dot: "bg-green-400", cls: "text-green-300" };
  return (
    <span className={`flex items-center gap-1 text-[11px] leading-tight ${cls}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {texto}
    </span>
  );
}

export function App() {
  const sesion = useSesion();

  useEffect(() => {
    if (sesion) iniciarSync();
    else detenerSync();
  }, [sesion?.token]);

  if (!sesion) return <Login />;
  return <AppInterna sesion={sesion} />;
}
