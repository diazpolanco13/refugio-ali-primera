// Sección de INFRAESTRUCTURA de un campamento: catálogo de áreas físicas,
// fotos iniciales (antes), panel antes/después e historial de reparaciones
// vinculadas. Persistencia inmediata (no espera al Guardar del CentroForm).

import { useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  Clock,
  HardHat,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { useAreasInfraestructura } from "@/data/useAreasInfraestructura";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import {
  actualizarArea,
  agregarFotoInicial,
  crearArea,
  eliminarArea,
  MAX_FOTOS_INICIALES,
} from "@/data/reposInfraestructura";
import { supabaseDisponible } from "@/data/supabase";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  contarPorEstado,
  diasTranscurridos,
  ESTADOS_INFRAESTRUCTURA,
  fotosDespuesArea,
  META_ESTADO,
  reparacionesDeArea,
  type AreaInfraestructura,
  type EstadoInfraestructura,
  type FotoInfraestructura,
} from "@/domain/infraestructura";
import {
  META_ESTATUS,
  type FotoReparacion,
  type Reparacion,
} from "@/domain/reparaciones";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PropsBase {
  centroId: string;
  puedeEditar?: boolean;
}

interface PropsCentro extends PropsBase {
  esNuevo?: boolean;
  /** Sin bloque introductorio duplicado (sub-pestaña Infraestructura en ficha). */
  ocultarCabecera?: boolean;
}

function BadgeEstado({ estado }: { estado: EstadoInfraestructura }) {
  const meta = META_ESTADO[estado];
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      {meta.label}
    </Badge>
  );
}

function GaleriaFotosIniciales({ fotos }: { fotos: FotoInfraestructura[] }) {
  if (fotos.length === 0) {
    return <p className="text-[10px] text-muted-foreground">Sin fotos</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f, i) => (
        <a
          key={`${f.url}-${i}`}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block size-20 overflow-hidden rounded-lg border border-border sm:size-24"
        >
          <img src={f.url} alt="Antes" className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function GaleriaFotosDespues({ fotos }: { fotos: FotoReparacion[] }) {
  if (fotos.length === 0) {
    return <p className="text-[10px] text-muted-foreground">Sin fotos de reparaciones</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {fotos.slice(0, 6).map((f, i) => (
        <a
          key={`${f.url}-${i}`}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block size-20 overflow-hidden rounded-lg border border-border sm:size-24"
        >
          <img src={f.url} alt="Después" className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function HistorialReparacionesArea({ reparaciones }: { reparaciones: Reparacion[] }) {
  if (reparaciones.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aún no hay reparaciones vinculadas a esta área.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {reparaciones.map((r) => {
        const meta = META_ESTATUS[r.estatus];
        const dias =
          r.estatus === "completado" && r.resuelta_ts
            ? diasTranscurridos(r.creada_ts, r.resuelta_ts)
            : diasTranscurridos(r.creada_ts, Date.now());
        return (
          <div
            key={r.id}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium">{r.titulo}</span>
              <Badge
                variant="outline"
                className="text-[10px]"
                style={{ borderColor: `${meta.color}66`, color: meta.color }}
              >
                {meta.label}
              </Badge>
              {dias > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Clock className="size-3" />
                  {dias} día{dias !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {r.descripcion && (
              <p className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
                {r.descripcion}
              </p>
            )}
            {r.fotos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.fotos.map((f, i) => (
                  <a
                    key={`${f.url}-${i}`}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block size-12 overflow-hidden rounded border border-border"
                  >
                    <img src={f.url} alt={f.tipo} className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 text-center text-[7px] uppercase text-white">
                      {f.tipo === "antes" ? "A" : "D"}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PanelAntesDespues({
  area,
  reparaciones,
}: {
  area: AreaInfraestructura;
  reparaciones: Reparacion[];
}) {
  const despues = fotosDespuesArea(area, reparaciones);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-red-400">
          Antes
        </p>
        <GaleriaFotosIniciales fotos={area.fotos_iniciales} />
        {area.descripcion_inicial && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
            {area.descripcion_inicial}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
          Después
        </p>
        <GaleriaFotosDespues fotos={despues} />
        {despues.length === 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Las fotos &quot;después&quot; provienen de reparaciones vinculadas.
          </p>
        )}
      </div>
    </div>
  );
}

function FormularioArea({
  centroId,
  area,
  onGuardado,
  onCancelar,
}: {
  centroId: string;
  area?: AreaInfraestructura;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const esEdicion = Boolean(area);
  const [nombre, setNombre] = useState(area?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(area?.descripcion_inicial ?? "");
  const [estado, setEstado] = useState<EstadoInfraestructura>(
    area?.estado ?? "requiere_mejora",
  );
  const [fotos, setFotos] = useState<FotoInfraestructura[]>(area?.fotos_iniciales ?? []);
  const [areaId, setAreaId] = useState<string | undefined>(area?.id);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const fotosDisponibles = supabaseDisponible();

  async function asegurarId(): Promise<string> {
    if (areaId) return areaId;
    const id = await crearArea({
      centro_id: centroId,
      nombre: nombre.trim() || "Sin nombre",
      descripcion_inicial: descripcion,
      estado,
      fotos_iniciales: fotos,
    });
    setAreaId(id);
    return id;
  }

  async function guardarCampo(
    cambios: Partial<{
      nombre: string;
      descripcion_inicial: string;
      estado: EstadoInfraestructura;
      fotos_iniciales: FotoInfraestructura[];
    }>,
  ) {
    setError(null);
    setGuardando(true);
    try {
      if (esEdicion && area) {
        await actualizarArea(area.id, cambios);
      } else {
        const id = await asegurarId();
        await actualizarArea(id, cambios);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el área.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarCompleto() {
    if (!nombre.trim()) {
      setError("El nombre del área es obligatorio.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      if (esEdicion && area) {
        await actualizarArea(area.id, {
          nombre,
          descripcion_inicial: descripcion,
          estado,
          fotos_iniciales: fotos,
        });
      } else if (areaId) {
        await actualizarArea(areaId, {
          nombre,
          descripcion_inicial: descripcion,
          estado,
          fotos_iniciales: fotos,
        });
      } else {
        await crearArea({
          centro_id: centroId,
          nombre,
          descripcion_inicial: descripcion,
          estado,
          fotos_iniciales: fotos,
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el área.");
    } finally {
      setGuardando(false);
    }
  }

  async function onSeleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (fotos.length >= MAX_FOTOS_INICIALES) {
      setError(`Máximo ${MAX_FOTOS_INICIALES} fotos iniciales por área.`);
      return;
    }

    setSubiendoFoto(true);
    setError(null);
    try {
      const id = await asegurarId();
      const nuevasFotos = await agregarFotoInicial(centroId, id, file, fotos);
      setFotos(nuevasFotos);
      await actualizarArea(id, { fotos_iniciales: nuevasFotos });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function quitarFoto(index: number) {
    const nuevas = fotos.filter((_, i) => i !== index);
    setFotos(nuevas);
    const id = area?.id ?? areaId;
    if (id) await guardarCampo({ fotos_iniciales: nuevas });
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="px-3 py-2">
        <CardTitle className="text-xs">
          {esEdicion ? "Editar área" : "Nueva área de infraestructura"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div>
          <Label htmlFor="area-nombre" className="text-[11px]">
            Nombre del área
          </Label>
          <Input
            id="area-nombre"
            className="mt-1"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => {
              if (nombre.trim() && (esEdicion || areaId)) {
                void guardarCampo({ nombre });
              }
            }}
            placeholder='Ej. "Baños bloque A", "Tanque de agua"'
          />
        </div>
        <div>
          <Label htmlFor="area-desc" className="text-[11px]">
            Descripción del estado inicial
          </Label>
          <Textarea
            id="area-desc"
            className="mt-1"
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onBlur={() => {
              if (esEdicion || areaId) void guardarCampo({ descripcion_inicial: descripcion });
            }}
            placeholder="Describe cómo está el área al levantamiento…"
          />
        </div>
        <div>
          <Label className="text-[11px]">Estado de atención</Label>
          <Select
            value={estado}
            onValueChange={(v) => {
              const nuevo = v as EstadoInfraestructura;
              setEstado(nuevo);
              if (esEdicion || areaId) void guardarCampo({ estado: nuevo });
            }}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_INFRAESTRUCTURA.map((e) => (
                <SelectItem key={e.valor} value={e.valor}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">
            Fotos iniciales ({fotos.length}/{MAX_FOTOS_INICIALES})
          </Label>
          <GaleriaFotosIniciales fotos={fotos} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                !fotosDisponibles || subiendoFoto || fotos.length >= MAX_FOTOS_INICIALES
              }
              onClick={() => inputFoto.current?.click()}
            >
              {subiendoFoto ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              Subir foto
            </Button>
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onSeleccionarFoto(e)}
            />
          </div>
          {fotos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {fotos.map((_, i) => (
                <Button
                  key={i}
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => void quitarFoto(i)}
                >
                  Quitar foto {i + 1}
                </Button>
              ))}
            </div>
          )}
          {!fotosDisponibles && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Supabase no configurado: las fotos están desactivadas.
            </p>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={guardando} onClick={() => void guardarCompleto()}>
            {guardando && <Loader2 className="size-4 animate-spin" />}
            {esEdicion ? "Listo" : "Crear área"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TarjetaArea({
  area,
  reparaciones,
  puedeEditar,
  onEditar,
  onEliminar,
  expandidaPorDefecto,
}: {
  area: AreaInfraestructura;
  reparaciones: Reparacion[];
  puedeEditar: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  expandidaPorDefecto?: boolean;
}) {
  const [abierta, setAbierta] = useState(expandidaPorDefecto ?? false);
  const vinculadas = reparacionesDeArea(area.id, reparaciones);

  return (
    <Collapsible open={abierta} onOpenChange={setAbierta}>
      <div
        className={cn(
          "rounded-lg border border-border bg-card",
          area.estado === "requiere_mejora" && "border-red-500/25",
          area.estado === "en_proceso" && "border-amber-500/25",
          area.estado === "mejorado" && "border-emerald-500/25",
        )}
      >
        <div className="flex items-start justify-between gap-2 px-3 py-2.5">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-start gap-2 text-left">
            <ChevronDown
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                abierta && "rotate-180",
              )}
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">{area.nombre}</span>
                <BadgeEstado estado={area.estado} />
                {vinculadas.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {vinculadas.length} reparación{vinculadas.length !== 1 ? "es" : ""}
                  </Badge>
                )}
              </div>
              {area.descripcion_inicial && !abierta && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {area.descripcion_inicial}
                </p>
              )}
            </div>
          </CollapsibleTrigger>
          {puedeEditar && (
            <div className="flex shrink-0 gap-0.5">
              <Button type="button" size="icon-xs" variant="ghost" onClick={onEditar}>
                <Pencil className="size-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar área?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará &quot;{area.nombre}&quot;. Las reparaciones vinculadas
                      conservarán su historial pero perderán el vínculo al área.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
        <CollapsibleContent className="space-y-3 border-t border-border px-3 py-3">
          <PanelAntesDespues area={area} reparaciones={vinculadas} />
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Wrench className="size-3.5 text-amber-400" />
              Historial de reparaciones
            </p>
            <HistorialReparacionesArea reparaciones={vinculadas} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/** Contenido editable de la pestaña Infraestructura en CentroForm. */
export function InfraestructuraCentro({
  centroId,
  puedeEditar = false,
  esNuevo,
  ocultarCabecera = false,
}: PropsCentro) {
  const [filtroEstado, setFiltroEstado] = useState<EstadoInfraestructura | "todos">("todos");
  const areasTodas = useAreasInfraestructura({ centroId });
  const { trabajos: reparaciones } = useReparacionesCentros({ centroId });
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [editando, setEditando] = useState<AreaInfraestructura | null>(null);

  const areas = useMemo(() => {
    if (filtroEstado === "todos") return areasTodas;
    return areasTodas.filter((a) => a.estado === filtroEstado);
  }, [areasTodas, filtroEstado]);

  const conteos = contarPorEstado(areasTodas);

  if (esNuevo) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <Building2 className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          Guarda el campamento primero para registrar áreas de infraestructura.
        </p>
      </div>
    );
  }

  const filtrosEstado = areasTodas.length > 0 && (
    <div className={cn("flex flex-wrap gap-2 text-[10px]", !ocultarCabecera && "mt-2")}>
      <button
        type="button"
        className={cn(
          "rounded-full border px-2 py-0.5 transition-colors",
          filtroEstado === "todos"
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:bg-muted/50",
        )}
        onClick={() => setFiltroEstado("todos")}
      >
        Todas ({areasTodas.length})
      </button>
      {ESTADOS_INFRAESTRUCTURA.map((e) => (
        <button
          key={e.valor}
          type="button"
          className={cn(
            "rounded-full border px-2 py-0.5 transition-colors",
            filtroEstado === e.valor
              ? "border-primary/50 bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/50",
          )}
          style={
            filtroEstado === e.valor
              ? { borderColor: `${e.color}66`, color: e.color }
              : undefined
          }
          onClick={() => setFiltroEstado(e.valor)}
        >
          {conteos[e.valor]} {e.label.toLowerCase()}
          {conteos[e.valor] !== 1 ? "s" : ""}
        </button>
      ))}
    </div>
  );

  const vacioSinAreas = filtroEstado === "todos";

  return (
    <div className="space-y-4">
      {!ocultarCabecera ? (
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <HardHat className="size-4 text-sky-400" />
            <p className="text-sm font-medium">Áreas de infraestructura</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Define las áreas físicas del campamento y su estado inicial. Los trabajos se
            registran en Reparaciones y alimentan el panel &quot;después&quot;.
          </p>
          {filtrosEstado}
        </div>
      ) : (
        filtrosEstado
      )}

      {puedeEditar &&
        !mostrandoForm &&
        !editando &&
        areasTodas.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => setMostrandoForm(true)}>
            <Plus className="size-4" />
            Registrar área
          </Button>
        )}

      {mostrandoForm && (
        <FormularioArea
          centroId={centroId}
          onGuardado={() => setMostrandoForm(false)}
          onCancelar={() => setMostrandoForm(false)}
        />
      )}

      {editando && (
        <FormularioArea
          centroId={centroId}
          area={editando}
          onGuardado={() => setEditando(null)}
          onCancelar={() => setEditando(null)}
        />
      )}

      {areas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {vacioSinAreas
              ? "Sin áreas de infraestructura"
              : "No hay áreas con este estado"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {vacioSinAreas
              ? "Define espacios físicos del campamento con fotos iniciales y seguimiento de reparaciones."
              : "Prueba otro filtro de estado."}
          </p>
          {vacioSinAreas && puedeEditar && !mostrandoForm && !editando && (
            <Button
              type="button"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={() => setMostrandoForm(true)}
            >
              <Plus className="size-3.5" />
              Registrar área
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {areas.map((a) => (
            <TarjetaArea
              key={a.id}
              area={a}
              reparaciones={reparaciones}
              puedeEditar={puedeEditar && !editando}
              onEditar={() => {
                setEditando(a);
                setMostrandoForm(false);
              }}
              onEliminar={() => void eliminarArea(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PropsSeccion {
  centro: CentroTransitorio;
  puedeEditar?: boolean;
  variant?: "compacto" | "expandido";
}

/** Sección de lectura para ficha del campamento y panel lateral. */
export function SeccionInfraestructuraCentro({
  centro,
  puedeEditar = false,
  variant = "compacto",
}: PropsSeccion) {
  const areas = useAreasInfraestructura({ centroId: centro.id });
  const { trabajos: reparaciones } = useReparacionesCentros({ centroId: centro.id });
  const conteos = contarPorEstado(areas);
  const expandido = variant === "expandido";

  if (areas.length === 0) {
    return (
      <Card size="sm">
        <CardHeader className="px-3 py-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Building2 className="size-3.5 text-sky-400" />
            Infraestructura
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="text-xs text-muted-foreground">
            Sin áreas de infraestructura registradas
            {puedeEditar ? ". Edita el campamento para definirlas." : "."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader className="px-3 py-2">
        <CardTitle className="flex items-center gap-1.5 text-xs">
          <Building2 className="size-3.5 text-sky-400" />
          Infraestructura
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {areas.length} área{areas.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span>{conteos.requiere_mejora} requieren mejora</span>
          <span>·</span>
          <span>{conteos.en_proceso} en proceso</span>
          <span>·</span>
          <span>{conteos.mejorado} mejorada{conteos.mejorado !== 1 ? "s" : ""}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {areas.map((a) => (
          <TarjetaArea
            key={a.id}
            area={a}
            reparaciones={reparaciones}
            puedeEditar={false}
            onEditar={() => {}}
            onEliminar={() => {}}
            expandidaPorDefecto={expandido && areas.length <= 3}
          />
        ))}
      </CardContent>
    </Card>
  );
}
