import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  PawPrint,
  Phone,
  Plus,
  Tent,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { nuevoId } from "@/data/db";
import {
  CATEGORIAS_RESPONSABLE,
  FUNCIONES_COMUNES,
  SECTOR_COLORES,
  normalizarVulnerables,
  totalHombres,
  totalMujeres,
  totalPoblacion,
  totalVulnerables,
  type Responsable,
  type Sector,
  type Vulnerables,
} from "@/domain/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PasoCenso = 1 | 2 | 3;
type EstadoSync = "idle" | "pendiente" | "guardado" | "error";

const AUTO_GUARDADO_MS = 2800;

interface BorradorSector {
  nombre: string;
  color: string;
  carpas: number;
  familias: number;
  responsables: Responsable[];
  vulnerables: Vulnerables;
  notas: string;
  paso: PasoCenso;
}

interface Props {
  geom: GeoJSON.Polygon;
  inicial?: Sector;
  colorSugerido: string;
  soloLectura?: boolean;
  onGuardar: (
    datos: Omit<Sector, "id" | "updated_at" | "updated_by"> & { id?: string },
  ) => Promise<string | void>;
  onEliminar?: () => void;
  onCerrar: () => void;
}

const PASOS: { paso: PasoCenso; titulo: string; icono: typeof Tent }[] = [
  { paso: 1, titulo: "Carpas", icono: Tent },
  { paso: 2, titulo: "Familias", icono: Users },
  { paso: 3, titulo: "Personas", icono: Users },
];

function claveBorrador(geom: GeoJSON.Polygon): string {
  const c = geom.coordinates[0]?.[0];
  return c ? `refugio.sector-borrador.${c[0].toFixed(5)}_${c[1].toFixed(5)}` : "refugio.sector-borrador.nuevo";
}

function cargarBorrador(key: string): Partial<BorradorSector> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<BorradorSector>) : null;
  } catch {
    return null;
  }
}

function guardarBorrador(key: string, datos: BorradorSector): void {
  try {
    localStorage.setItem(key, JSON.stringify(datos));
  } catch {
    // ignore
  }
}

function borrarBorrador(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function SectorForm({
  geom,
  inicial,
  colorSugerido,
  soloLectura = false,
  onGuardar,
  onEliminar,
  onCerrar,
}: Props) {
  const borradorKey = claveBorrador(geom);
  const borrador = !inicial ? cargarBorrador(borradorKey) : null;
  const sectorIdRef = useRef(inicial?.id);

  const [nombre, setNombre] = useState(borrador?.nombre ?? inicial?.nombre ?? "");
  const [color, setColor] = useState(borrador?.color ?? inicial?.color ?? colorSugerido);
  const [carpas, setCarpas] = useState(borrador?.carpas ?? inicial?.carpas ?? 0);
  const [familias, setFamilias] = useState(borrador?.familias ?? inicial?.familias ?? 0);
  const [responsables, setResponsables] = useState<Responsable[]>(
    borrador?.responsables ?? inicial?.responsables ?? [],
  );
  const [vulnerables, setVulnerables] = useState<Vulnerables>(
    normalizarVulnerables(borrador?.vulnerables ?? inicial?.vulnerables),
  );
  const [notas, setNotas] = useState(borrador?.notas ?? inicial?.notas ?? "");
  const [paso, setPaso] = useState<PasoCenso>(borrador?.paso ?? 1);
  const [mostrarExtras, setMostrarExtras] = useState(false);

  const [estadoSync, setEstadoSync] = useState<EstadoSync>(inicial ? "guardado" : "idle");
  const [guardandoExplicito, setGuardandoExplicito] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const ultimoSnapshotRef = useRef<string | null>(null);
  const timerAutoGuardadoRef = useRef<number | null>(null);
  const montadoRef = useRef(false);

  const setV = (campo: keyof Vulnerables) => (n: number) =>
    setVulnerables((prev) => ({ ...prev, [campo]: n }));

  const hombres = totalHombres(vulnerables);
  const mujeres = totalMujeres(vulnerables);
  const poblacionCalculada = totalPoblacion(vulnerables);
  const vulnerablesCount = totalVulnerables(vulnerables);
  const deshabilitado = soloLectura;

  const tieneDatos =
    nombre.trim().length > 0 ||
    carpas > 0 ||
    familias > 0 ||
    poblacionCalculada > 0 ||
    responsables.some((r) => r.nombre.trim() || r.telefono.trim()) ||
    notas.trim().length > 0;

  const datosActuales = useCallback((): Omit<Sector, "id" | "updated_at" | "updated_by"> & {
    id?: string;
  } => {
    return {
      id: sectorIdRef.current,
      nombre: nombre.trim() || "Sector",
      geom,
      color,
      carpas,
      familias,
      poblacion_estimada: poblacionCalculada,
      responsables: responsables
        .filter((r) => r.nombre.trim() || r.telefono.trim())
        .map((r) => ({
          ...r,
          nombre: r.nombre.trim(),
          telefono: r.telefono.trim(),
          funcion: r.funcion.trim(),
        })),
      vulnerables,
      notas: notas.trim(),
    };
  }, [
    nombre,
    geom,
    color,
    carpas,
    familias,
    poblacionCalculada,
    responsables,
    vulnerables,
    notas,
  ]);

  const persistir = useCallback(
    async (opts?: { explicito?: boolean }) => {
      if (deshabilitado) return false;
      if (!sectorIdRef.current && !tieneDatos) return false;

      const payload = datosActuales();
      const snapshot = JSON.stringify(payload);
      if (snapshot === ultimoSnapshotRef.current) return true;

      if (opts?.explicito) setGuardandoExplicito(true);

      try {
        const id = await onGuardar(payload);
        if (typeof id === "string") sectorIdRef.current = id;
        ultimoSnapshotRef.current = snapshot;
        setEstadoSync("guardado");
        if (sectorIdRef.current) borrarBorrador(borradorKey);
        return true;
      } catch {
        setEstadoSync("error");
        return false;
      } finally {
        setGuardandoExplicito(false);
      }
    },
    [borradorKey, datosActuales, deshabilitado, onGuardar, tieneDatos],
  );

  useEffect(() => {
    ultimoSnapshotRef.current = JSON.stringify(datosActuales());
    montadoRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marca cambios pendientes sin parpadear el encabezado en cada tecla.
  useEffect(() => {
    if (!montadoRef.current || deshabilitado) return;
    const snapshot = JSON.stringify(datosActuales());
    if (snapshot !== ultimoSnapshotRef.current) {
      setEstadoSync((prev) => (prev === "error" ? "error" : "pendiente"));
    }
  }, [
    deshabilitado,
    datosActuales,
    nombre,
    color,
    carpas,
    familias,
    responsables,
    vulnerables,
    notas,
  ]);

  // Auto-guardado silencioso: sin spinner ni parpadeo en el encabezado.
  useEffect(() => {
    if (deshabilitado) return;
    if (timerAutoGuardadoRef.current) window.clearTimeout(timerAutoGuardadoRef.current);
    timerAutoGuardadoRef.current = window.setTimeout(() => {
      void persistir();
    }, AUTO_GUARDADO_MS);
    return () => {
      if (timerAutoGuardadoRef.current) window.clearTimeout(timerAutoGuardadoRef.current);
    };
  }, [
    deshabilitado,
    persistir,
    nombre,
    color,
    carpas,
    familias,
    responsables,
    vulnerables,
    notas,
    paso,
  ]);

  // Borrador local mientras el sector aún no tiene id en servidor/DB.
  useEffect(() => {
    if (deshabilitado || sectorIdRef.current) return;
    guardarBorrador(borradorKey, {
      nombre,
      color,
      carpas,
      familias,
      responsables,
      vulnerables,
      notas,
      paso,
    });
  }, [
    borradorKey,
    carpas,
    color,
    deshabilitado,
    familias,
    nombre,
    notas,
    paso,
    responsables,
    vulnerables,
  ]);

  function intentarCerrar() {
    if (deshabilitado) {
      onCerrar();
      return;
    }
    if (!sectorIdRef.current && tieneDatos && estadoSync !== "guardado") {
      setConfirmCerrar(true);
      return;
    }
    onCerrar();
  }

  async function guardarYCerrar() {
    const ok = await persistir({ explicito: true });
    if (ok) onCerrar();
  }

  function agregarResponsable() {
    setResponsables((prev) => [
      ...prev,
      { id: nuevoId(), nombre: "", telefono: "", categoria: "funcionario", funcion: "" },
    ]);
  }
  function actualizarResponsable(id: string, patch: Partial<Responsable>) {
    setResponsables((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function eliminarResponsable(id: string) {
    setResponsables((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(abierto) => {
          if (!abierto) intentarCerrar();
        }}
      >
        <DialogContent
          className="flex max-h-[96dvh] flex-col gap-0 p-0 sm:max-w-md"
          showCloseButton={false}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 py-3 sm:pr-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <DialogTitle>{inicial ? "Editar sector" : "Nuevo sector"}</DialogTitle>
                <DialogDescription>
                  {soloLectura
                    ? "Consulta de datos del sector"
                    : "Recorre el sector: primero carpas, luego familias, después personas"}
                </DialogDescription>
              </div>
              {!soloLectura && (
                <EstadoGuardado estado={estadoSync} guardandoExplicito={guardandoExplicito} />
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <div className="space-y-4">
              {/* Identificación rápida — siempre visible */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="sector-nombre">Nombre / código</Label>
                  <Input
                    id="sector-nombre"
                    className="mt-1.5"
                    value={nombre}
                    disabled={deshabilitado}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej: A-4, Sector Norte…"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Población estimada</Label>
                  <div className="mt-1.5 flex h-8 items-center rounded-lg border border-input bg-muted/30 px-3 text-sm font-semibold tabular-nums">
                    {poblacionCalculada.toLocaleString("es")}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (suma del desglose)
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <Label>Color del sector</Label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {SECTOR_COLORES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={deshabilitado}
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-7 rounded-full border-2 transition-transform active:scale-95",
                        color === c ? "border-foreground ring-2 ring-ring/40" : "border-transparent",
                      )}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  {!deshabilitado && (
                    <label className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-border text-xs text-muted-foreground hover:bg-muted">
                      +
                      <input
                        type="color"
                        className="sr-only"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              </div>

              {!soloLectura && (
                <nav
                  className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/20 p-1"
                  aria-label="Pasos del censo"
                >
                  {PASOS.map(({ paso: n, titulo, icono: Icono }) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPaso(n)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                        paso === n
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icono className="size-3.5" />
                      <span>{n}. {titulo}</span>
                    </button>
                  ))}
                </nav>
              )}

              {/* Paso 1 — Carpas */}
              {(soloLectura || paso === 1) && (
                <Card size="sm">
                  <CardHeader className="px-3 pb-1">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Tent className="size-4 text-primary" />
                      Paso 1 · Conteo de carpas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-3 pb-3">
                    <p className="text-xs text-muted-foreground">
                      Recorre el sector contando cada carpa o espacio familiar antes de entrar al
                      detalle.
                    </p>
                    <div>
                      <Label htmlFor="sector-carpas">Nº de carpas</Label>
                      <NumInput
                        id="sector-carpas"
                        className="mt-1.5"
                        value={carpas}
                        disabled={deshabilitado}
                        onChange={setCarpas}
                      />
                    </div>
                    {!soloLectura && paso === 1 && (
                      <Button type="button" size="sm" className="w-full" onClick={() => setPaso(2)}>
                        Siguiente: familias
                        <ChevronRight className="size-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Paso 2 — Familias */}
              {(soloLectura || paso === 2) && (
                <Card size="sm">
                  <CardHeader className="px-3 pb-1">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Users className="size-4 text-primary" />
                      Paso 2 · Familias
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-3 pb-3">
                    <p className="text-xs text-muted-foreground">
                      Carpa por carpa: registra cuántas familias hay.{" "}
                      {carpas > 0 && (
                        <span className="text-foreground">
                          Referencia: {carpas} carpas contadas.
                        </span>
                      )}
                    </p>
                    <div>
                      <Label htmlFor="sector-familias">Nº de familias</Label>
                      <NumInput
                        id="sector-familias"
                        className="mt-1.5"
                        value={familias}
                        disabled={deshabilitado}
                        onChange={setFamilias}
                      />
                    </div>
                    {carpas > 0 && familias > carpas && (
                      <p className="text-xs text-amber-400">
                        Hay más familias ({familias}) que carpas ({carpas}). Verifica si comparten
                        carpa o hubo error de conteo.
                      </p>
                    )}
                    {!soloLectura && paso === 2 && (
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPaso(1)}>
                          <ChevronLeft className="size-4" />
                          Carpas
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1"
                          onClick={() => setPaso(3)}
                        >
                          Siguiente: personas
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Paso 3 — Demografía */}
              {(soloLectura || paso === 3) && (
                <div>
                  <Label>Desglose demográfico (por edad y sexo)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Entrevista carpa por carpa: recién nacidos, niñez, adolescentes, adultos,
                    adultos mayores, discapacidad/patologías, embarazadas y mascotas.
                  </p>
                  <div className="mt-2 space-y-2">
                    <GrupoSexo
                      titulo="Recién nacidos (0-2)"
                      etiquetaH="Niños"
                      etiquetaM="Niñas"
                      valorH={vulnerables.recien_nacidos_h}
                      valorM={vulnerables.recien_nacidos_m}
                      onH={setV("recien_nacidos_h")}
                      onM={setV("recien_nacidos_m")}
                      deshabilitado={deshabilitado}
                    />
                    <GrupoSexo
                      titulo="Niñez (3-11)"
                      etiquetaH="Niños"
                      etiquetaM="Niñas"
                      valorH={vulnerables.ninos}
                      valorM={vulnerables.ninas}
                      onH={setV("ninos")}
                      onM={setV("ninas")}
                      deshabilitado={deshabilitado}
                    />
                    <GrupoSexo
                      titulo="Adolescentes (12-17)"
                      valorH={vulnerables.adolescentes_h}
                      valorM={vulnerables.adolescentes_m}
                      onH={setV("adolescentes_h")}
                      onM={setV("adolescentes_m")}
                      deshabilitado={deshabilitado}
                    />
                    <GrupoSexo
                      titulo="Adultos (18-59)"
                      valorH={vulnerables.adultos_h}
                      valorM={vulnerables.adultos_m}
                      onH={setV("adultos_h")}
                      onM={setV("adultos_m")}
                      deshabilitado={deshabilitado}
                    />
                    <GrupoSexo
                      titulo="Adultos mayores (60+)"
                      valorH={vulnerables.adultos_mayores_h}
                      valorM={vulnerables.adultos_mayores_m}
                      onH={setV("adultos_mayores_h")}
                      onM={setV("adultos_mayores_m")}
                      deshabilitado={deshabilitado}
                    />
                    <GrupoSexo
                      titulo="Discapacidad / patologías"
                      valorH={vulnerables.discapacidad_h}
                      valorM={vulnerables.discapacidad_m}
                      onH={setV("discapacidad_h")}
                      onM={setV("discapacidad_m")}
                      deshabilitado={deshabilitado}
                    />
                    <Card size="sm" className="py-2">
                      <CardContent className="flex items-center justify-between gap-3 px-3">
                        <span className="text-xs text-muted-foreground">Embarazadas</span>
                        <NumInput
                          className="w-24"
                          value={vulnerables.embarazadas}
                          disabled={deshabilitado}
                          onChange={setV("embarazadas")}
                        />
                      </CardContent>
                    </Card>
                    <Card size="sm" className="py-2">
                      <CardContent className="flex items-center justify-between gap-3 px-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <PawPrint className="size-3.5" />
                          Mascotas
                          <span className="text-[10px] text-muted-foreground/70">
                            (no cuenta como población)
                          </span>
                        </span>
                        <NumInput
                          className="w-24"
                          value={vulnerables.mascotas}
                          disabled={deshabilitado}
                          onChange={setV("mascotas")}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <TotalBadge etiqueta="♂ Hombres" valor={hombres} clase="text-sky-300" />
                    <TotalBadge etiqueta="♀ Mujeres" valor={mujeres} clase="text-pink-300" />
                    <TotalBadge etiqueta="Total" valor={poblacionCalculada} />
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Grupos vulnerables prioritarios:{" "}
                    <span className="font-medium text-foreground">{vulnerablesCount}</span>
                  </p>
                  {!soloLectura && paso === 3 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      onClick={() => setPaso(2)}
                    >
                      <ChevronLeft className="size-4" />
                      Volver a familias
                    </Button>
                  )}
                </div>
              )}

              {/* Extras colapsables — no interrumpen el censo */}
              {!soloLectura && (
                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40"
                    onClick={() => setMostrarExtras((v) => !v)}
                  >
                    Responsables y notas
                    <ChevronRight
                      className={cn("size-4 transition-transform", mostrarExtras && "rotate-90")}
                    />
                  </button>
                  {mostrarExtras && (
                    <div className="mt-3 space-y-4">
                      <SeccionResponsables
                        responsables={responsables}
                        deshabilitado={deshabilitado}
                        onAgregar={agregarResponsable}
                        onActualizar={actualizarResponsable}
                        onEliminar={eliminarResponsable}
                      />
                      <div>
                        <Label htmlFor="sector-notas">Notas</Label>
                        <Textarea
                          id="sector-notas"
                          className="mt-1.5"
                          rows={2}
                          value={notas}
                          disabled={deshabilitado}
                          onChange={(e) => setNotas(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {soloLectura && (
                <>
                  <Separator />
                  <SeccionResponsables
                    responsables={responsables}
                    deshabilitado
                    onAgregar={() => {}}
                    onActualizar={() => {}}
                    onEliminar={() => {}}
                  />
                  {notas && (
                    <div>
                      <Label>Notas</Label>
                      <p className="mt-1 text-sm text-muted-foreground">{notas}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            {soloLectura ? (
              <Button variant="outline" onClick={onCerrar}>
                Cerrar
              </Button>
            ) : (
              <>
              {onEliminar ? (
                <Button variant="destructive" className="w-full sm:w-auto" onClick={onEliminar}>
                  Eliminar
                </Button>
              ) : (
                <span />
              )}
                <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={intentarCerrar}>
                    Cerrar
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => void guardarYCerrar()}
                    disabled={guardandoExplicito}
                  >
                    {guardandoExplicito ? <Loader2 className="size-4 animate-spin" /> : null}
                    Listo
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCerrar} onOpenChange={setConfirmCerrar}>
        <DialogContent className="max-w-none sm:max-w-sm" onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>¿Descartar borrador?</DialogTitle>
            <DialogDescription>
              Aún no se guardó este sector. Si cierras ahora, perderás lo registrado en este
              dispositivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCerrar(false)}>
              Seguir registrando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                borrarBorrador(borradorKey);
                setConfirmCerrar(false);
                onCerrar();
              }}
            >
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EstadoGuardado({
  estado,
  guardandoExplicito,
}: {
  estado: EstadoSync;
  guardandoExplicito: boolean;
}) {
  const texto =
    guardandoExplicito
      ? "Guardando…"
      : estado === "error"
        ? "Sin guardar"
        : estado === "pendiente"
          ? "Cambios pendientes"
          : estado === "guardado"
            ? "Guardado"
            : "";

  return (
    <div
      className="flex h-5 min-w-[7.5rem] shrink-0 items-center justify-end"
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        className={cn(
          "text-[10px] font-medium transition-colors duration-500",
          guardandoExplicito && "text-muted-foreground",
          !guardandoExplicito && estado === "guardado" && "text-emerald-400/90",
          !guardandoExplicito && estado === "pendiente" && "text-muted-foreground/70",
          !guardandoExplicito && estado === "error" && "text-destructive",
          !texto && "opacity-0",
        )}
      >
        {guardandoExplicito ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" />
            {texto}
          </span>
        ) : estado === "guardado" ? (
          <span className="inline-flex items-center gap-1">
            <Check className="size-3" />
            {texto}
          </span>
        ) : (
          texto
        )}
      </span>
    </div>
  );
}

function SeccionResponsables({
  responsables,
  deshabilitado,
  onAgregar,
  onActualizar,
  onEliminar,
}: {
  responsables: Responsable[];
  deshabilitado?: boolean;
  onAgregar: () => void;
  onActualizar: (id: string, patch: Partial<Responsable>) => void;
  onEliminar: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <UserPlus className="size-3.5" />
          Responsables ({responsables.length})
        </Label>
        {!deshabilitado && (
          <Button type="button" size="xs" variant="secondary" onClick={onAgregar}>
            <Plus className="size-3" />
            Agregar
          </Button>
        )}
      </div>

      {responsables.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Sin responsables. Agrega encargados por función (censo, basura, baños…).
        </p>
      )}

      <div className="space-y-2">
        {responsables.map((r) => {
          const cat = CATEGORIAS_RESPONSABLE.find((c) => c.valor === r.categoria);
          return (
            <Card key={r.id} size="sm" className="py-2">
              <CardContent className="space-y-2 px-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={r.nombre}
                    disabled={deshabilitado}
                    onChange={(e) => onActualizar(r.id, { nombre: e.target.value })}
                    placeholder="Nombre y apellido"
                  />
                  {r.telefono.trim() && (
                    <div className="flex shrink-0 gap-1">
                      <Button asChild size="icon-sm" variant="outline">
                        <a href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`} title="Llamar">
                          <Phone className="size-3.5" />
                        </a>
                      </Button>
                      <Button
                        asChild
                        size="icon-sm"
                        variant="outline"
                        className="border-emerald-500/30 text-emerald-400"
                      >
                        <a
                          href={`https://wa.me/${r.telefono.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          title="WhatsApp"
                        >
                          <MessageCircle className="size-3.5" />
                        </a>
                      </Button>
                    </div>
                  )}
                  {!deshabilitado && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onEliminar(r.id)}
                      title="Quitar"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={r.telefono}
                    disabled={deshabilitado}
                    onChange={(e) => onActualizar(r.id, { telefono: e.target.value })}
                    placeholder="Teléfono"
                    inputMode="tel"
                  />
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
                    value={r.categoria}
                    disabled={deshabilitado}
                    onChange={(e) =>
                      onActualizar(r.id, {
                        categoria: e.target.value as Responsable["categoria"],
                      })
                    }
                  >
                    {CATEGORIAS_RESPONSABLE.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  list="funciones-comunes"
                  value={r.funcion}
                  disabled={deshabilitado}
                  onChange={(e) => onActualizar(r.id, { funcion: e.target.value })}
                  placeholder="Función (ej: Recolección de basura)"
                />
                {cat && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{ borderColor: `${cat.color}66`, color: cat.color }}
                  >
                    {cat.label}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <datalist id="funciones-comunes">
        {FUNCIONES_COMUNES.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
}

function GrupoSexo({
  titulo,
  etiquetaH = "Hombres",
  etiquetaM = "Mujeres",
  valorH,
  valorM,
  onH,
  onM,
  deshabilitado,
}: {
  titulo: string;
  etiquetaH?: string;
  etiquetaM?: string;
  valorH: number;
  valorM: number;
  onH: (n: number) => void;
  onM: (n: number) => void;
  deshabilitado?: boolean;
}) {
  return (
    <Card size="sm" className="py-2">
      <CardHeader className="px-3 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 px-3 pt-0">
        <div>
          <Label className="text-[11px] text-muted-foreground">{etiquetaH}</Label>
          <NumInput className="mt-1" value={valorH} disabled={deshabilitado} onChange={onH} />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">{etiquetaM}</Label>
          <NumInput className="mt-1" value={valorM} disabled={deshabilitado} onChange={onM} />
        </div>
      </CardContent>
    </Card>
  );
}

function TotalBadge({
  etiqueta,
  valor,
  clase,
}: {
  etiqueta: string;
  valor: number;
  clase?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2 py-1.5 text-center">
      <div className={cn("text-base font-bold text-foreground", clase)}>
        {valor.toLocaleString("es")}
      </div>
      <div className="text-[10px] text-muted-foreground">{etiqueta}</div>
    </div>
  );
}
