import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { btnSecundario } from "./ui/clases";

type Pendiente =
  | { clase: "sector"; geom: GeoJSON.Polygon }
  | { clase: "punto"; geom: GeoJSON.Point }
  | null;

type Editando =
  | { clase: "sector"; item: Sector }
  | { clase: "punto"; item: PuntoServicio }
  | null;

export function App() {
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
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [tableroAbierto, setTableroAbierto] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [zoom, setZoom] = useState(() => cargarVista().zoom);
  const [ahora, setAhora] = useState(() => Date.now());
  const mapaRef = useRef<MapViewHandle>(null);

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
      <header className="z-20 flex h-12 items-center justify-between border-b border-slate-800 bg-slate-900 px-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800"
            onClick={() => setPanelAbierto((v) => !v)}
            aria-label="Alternar panel"
          >
            ☰
          </button>
          <h1 className="truncate text-sm font-semibold text-slate-100">
            Sala Situacional — Refugio Parque del Oeste
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] sm:flex ${
              online ? "bg-green-900/60 text-green-300" : "bg-amber-900/60 text-amber-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${online ? "bg-green-400" : "bg-amber-400"}`}
            />
            {online ? "En línea" : "Sin conexión"}
          </span>
          <button
            className={btnSecundario}
            onClick={() => setTableroAbierto((v) => !v)}
          >
            📊 Tablero
          </button>
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
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
            {modoDibujo === "poligono"
              ? "Clic en cada vértice del sector; doble clic (o Enter) para cerrar"
              : modoDibujo === "rectangulo"
                ? "Haz clic en dos esquinas opuestas para dibujar el sector"
                : "Haz clic en el mapa para ubicar el punto"}
            <button
              className="pointer-events-auto ml-3 underline"
              onClick={() => setModoDibujo("none")}
            >
              cancelar
            </button>
          </div>
        )}

        {/* Banner de edición */}
        {modoEdicion && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-amber-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
            Modo edición: arrastra los íconos; toca un sector y mueve sus vértices
            <button
              className="pointer-events-auto ml-3 underline"
              onClick={() => setModoEdicion(false)}
            >
              salir
            </button>
          </div>
        )}

        {/* Panel de control (capas y herramientas) */}
        {panelAbierto && (
          <div className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-72 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur">
            <div className="overflow-y-auto p-3">
              {/* Herramientas de dibujo */}
              <div className="mb-3 space-y-2">
                <BotonHerramienta
                  activo={modoDibujo === "poligono"}
                  onClick={() => elegirDibujo("poligono")}
                >
                  ⬠ Dibujar sector
                </BotonHerramienta>
                <div className="grid grid-cols-2 gap-2">
                  <BotonHerramienta
                    activo={modoDibujo === "rectangulo"}
                    onClick={() => elegirDibujo("rectangulo")}
                  >
                    ▭ Rectángulo
                  </BotonHerramienta>
                  <BotonHerramienta
                    activo={modoDibujo === "punto"}
                    onClick={() => elegirDibujo("punto")}
                  >
                    📍 Punto
                  </BotonHerramienta>
                </div>
                <BotonHerramienta
                  activo={modoEdicion}
                  onClick={() => {
                    setModoDibujo("none");
                    setModoEdicion((v) => !v);
                  }}
                >
                  ✏️ {modoEdicion ? "Salir de edición" : "Editar ubicaciones"}
                </BotonHerramienta>
              </div>

              {/* Base del mapa */}
              <div className="mb-3">
                <div className="mb-1 text-xs font-medium text-slate-400">Base del mapa</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {BASES_DISPONIBLES.map((b) => (
                    <button
                      key={b.valor}
                      className={`rounded-md py-1.5 text-sm ${
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
                    className="h-1 flex-1 cursor-pointer accent-teal-500"
                  />
                  <button
                    title="Centrar en el parque"
                    className="rounded-md border border-slate-600 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
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
              <label className="mb-1 flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-800">
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  ▱ Sectores
                </span>
                <input
                  type="checkbox"
                  checked={mostrarSectores}
                  onChange={() => setMostrarSectores((v) => !v)}
                />
              </label>
              {CATALOGO_TIPOS.map((m) => (
                <label
                  key={m.tipo}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-slate-800"
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
                    checked={capasVisibles.has(m.tipo)}
                    onChange={() => toggleCapa(m.tipo)}
                  />
                </label>
              ))}

              {/* Datos de ejemplo / limpiar */}
              <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                {sectores.length === 0 && puntos.length === 0 ? (
                  <button
                    className="flex-1 rounded-md border border-slate-600 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    onClick={() => cargarEjemplo()}
                  >
                    Cargar ejemplo
                  </button>
                ) : (
                  <button
                    className="flex-1 rounded-md border border-red-900 py-1.5 text-xs text-red-300 hover:bg-red-950"
                    onClick={() => {
                      if (confirm("¿Borrar todos los datos locales?")) limpiarTodo();
                    }}
                  >
                    Limpiar datos
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tablero */}
        {tableroAbierto && (
          <div className="absolute right-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-80 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <span className="text-sm font-semibold text-slate-100">Sala situacional</span>
              <button
                className="rounded px-2 text-slate-400 hover:bg-slate-800"
                onClick={() => setTableroAbierto(false)}
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              <Tablero
                sectores={sectores}
                puntos={puntos}
                ahora={ahora}
                onMarcarLimpio={marcarLimpio}
                onIrASector={(id) => {
                  const s = sectores.find((x) => x.id === id);
                  if (s) setEditando({ clase: "sector", item: s });
                }}
              />
            </div>
          </div>
        )}

        {/* Formularios */}
        {pendiente?.clase === "sector" && (
          <SectorForm
            geom={pendiente.geom}
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

function BotonHerramienta({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`w-full rounded-md px-3 py-2 text-sm font-semibold transition ${
        activo
          ? "bg-teal-600 text-white ring-2 ring-teal-400"
          : "border border-slate-600 text-slate-200 hover:bg-slate-800"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
