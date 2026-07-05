// Pestaña "Reparaciones" del reporte diario: preguntas al operador + lista
// histórica de trabajos con fotos antes/después.

import { useRef, useState } from "react";
import {
  Camera,
  Hammer,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import {
  actualizarReparacion,
  agregarFotoReparacion,
  crearReparacion,
} from "@/data/reposReparaciones";
import { supabaseDisponible } from "@/data/supabase";
import {
  ESTATUS_REPARACION,
  META_ESTATUS,
  centroRequiereReparaciones,
  contarPorEstatus,
  reparacionesPendientes,
  type EstatusReparacion,
  type FotoReparacion,
  type Reparacion,
  type TipoFotoReparacion,
} from "@/domain/reparaciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface Props {
  centroId: string;
  puedeEditar: boolean;
  requiereTrabajos: boolean;
  seTrabajoHoy: boolean;
  observaciones: string;
  onRequiereTrabajos: (v: boolean) => void;
  onSeTrabajoHoy: (v: boolean) => void;
  onObservaciones: (v: string) => void;
  deshabilitado?: boolean;
}

/** Selector binario Sí / No. */
function SelectorSiNo({
  valor,
  onChange,
  deshabilitado,
  id,
}: {
  valor: boolean;
  onChange: (v: boolean) => void;
  deshabilitado?: boolean;
  id?: string;
}) {
  return (
    <div id={id} className="flex gap-1" role="group">
      {([
        { v: true, label: "Sí" },
        { v: false, label: "No" },
      ] as const).map(({ v, label }) => {
        const activo = valor === v;
        return (
          <button
            key={label}
            type="button"
            disabled={deshabilitado}
            onClick={() => onChange(v)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50",
              activo
                ? v
                  ? "border-amber-500/50 bg-amber-500/15 text-amber-400"
                  : "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/50",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BadgeEstatus({ estatus }: { estatus: EstatusReparacion }) {
  const meta = META_ESTATUS[estatus];
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

/** Galería compacta de fotos antes/después. */
function GaleriaFotos({ fotos }: { fotos: FotoReparacion[] }) {
  if (fotos.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {fotos.map((f, i) => (
        <a
          key={`${f.url}-${i}`}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block size-16 overflow-hidden rounded-lg border border-border"
        >
          <img src={f.url} alt={f.tipo} className="size-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[8px] font-medium uppercase text-white">
            {f.tipo === "antes" ? "Antes" : "Después"}
          </span>
        </a>
      ))}
    </div>
  );
}

/** Tarjeta de un ítem de reparación en la lista histórica. */
function TarjetaReparacion({
  reparacion,
  puedeEditar,
  onEditar,
}: {
  reparacion: Reparacion;
  puedeEditar: boolean;
  onEditar: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-2.5",
        reparacion.estatus === "dañado" && "border-red-500/30 bg-red-500/5",
        reparacion.estatus === "en_reparacion" && "border-amber-500/25 bg-amber-500/5",
        reparacion.estatus === "reparado" && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{reparacion.titulo}</span>
            <BadgeEstatus estatus={reparacion.estatus} />
          </div>
          {reparacion.descripcion && (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">
              {reparacion.descripcion}
            </p>
          )}
          <GaleriaFotos fotos={reparacion.fotos} />
        </div>
        {puedeEditar && (
          <Button type="button" size="icon-xs" variant="ghost" onClick={onEditar}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Formulario inline para crear o editar una reparación. */
function FormularioReparacion({
  centroId,
  reparacion,
  onGuardado,
  onCancelar,
}: {
  centroId: string;
  reparacion?: Reparacion;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const esEdicion = Boolean(reparacion);
  const [titulo, setTitulo] = useState(reparacion?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(reparacion?.descripcion ?? "");
  const [estatus, setEstatus] = useState<EstatusReparacion>(
    reparacion?.estatus ?? "dañado",
  );
  const [fotos, setFotos] = useState<FotoReparacion[]>(reparacion?.fotos ?? []);
  const [repId, setRepId] = useState<string | undefined>(reparacion?.id);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const [tipoFoto, setTipoFoto] = useState<TipoFotoReparacion>("antes");

  async function asegurarId(): Promise<string> {
    if (repId) return repId;
    const id = await crearReparacion({
      centro_id: centroId,
      titulo: titulo.trim() || "Sin título",
      descripcion,
      estatus,
      fotos: [],
    });
    setRepId(id);
    return id;
  }

  async function guardar() {
    if (!titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      if (esEdicion && reparacion) {
        await actualizarReparacion(reparacion.id, {
          titulo,
          descripcion,
          estatus,
          fotos,
        });
      } else if (repId) {
        await actualizarReparacion(repId, {
          titulo,
          descripcion,
          estatus,
          fotos,
        });
      } else {
        await crearReparacion({
          centro_id: centroId,
          titulo,
          descripcion,
          estatus,
          fotos,
        });
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la reparación.");
    } finally {
      setGuardando(false);
    }
  }

  async function onSeleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setSubiendoFoto(true);
    setError(null);
    try {
      const id = await asegurarId();
      const foto = await agregarFotoReparacion(centroId, id, file, tipoFoto);
      const nuevasFotos = [...fotos, foto];
      setFotos(nuevasFotos);
      await actualizarReparacion(id, { fotos: nuevasFotos });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  const fotosDisponibles = supabaseDisponible();

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="px-3 py-2">
        <CardTitle className="text-xs">
          {esEdicion ? "Editar reparación" : "Nueva reparación"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div>
          <Label htmlFor="rep-titulo" className="text-[11px]">
            Título del trabajo
          </Label>
          <Input
            id="rep-titulo"
            className="mt-1"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Filtración en techo del comedor"
          />
        </div>
        <div>
          <Label htmlFor="rep-desc" className="text-[11px]">
            Descripción
          </Label>
          <Textarea
            id="rep-desc"
            className="mt-1"
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalle del daño o trabajo realizado…"
          />
        </div>
        <div>
          <Label className="text-[11px]">Estatus</Label>
          <Select value={estatus} onValueChange={(v) => setEstatus(v as EstatusReparacion)}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ESTATUS_REPARACION.map((e) => (
                <SelectItem key={e.valor} value={e.valor}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[11px]">Fotos (antes / después)</Label>
          <GaleriaFotos fotos={fotos} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select
              value={tipoFoto}
              onValueChange={(v) => setTipoFoto(v as TipoFotoReparacion)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="antes">Antes</SelectItem>
                <SelectItem value="despues">Después</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!fotosDisponibles || subiendoFoto}
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
          <Button type="button" size="sm" disabled={guardando} onClick={() => void guardar()}>
            {guardando && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Contenido de la pestaña Reparaciones en el reporte diario. */
export function ReparacionesTab({
  centroId,
  puedeEditar,
  requiereTrabajos,
  seTrabajoHoy,
  observaciones,
  onRequiereTrabajos,
  onSeTrabajoHoy,
  onObservaciones,
  deshabilitado,
}: Props) {
  const reparaciones = useReparacionesCentros({ centroId });
  const pendientes = reparacionesPendientes(reparaciones);
  const conteos = contarPorEstatus(reparaciones);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [editando, setEditando] = useState<Reparacion | null>(null);

  return (
    <div className="space-y-4">
      {reparaciones.length > 0 && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2.5",
            centroRequiereReparaciones(reparaciones)
              ? "border-amber-500/35 bg-amber-500/5"
              : "border-emerald-500/35 bg-emerald-500/5",
          )}
        >
          <div className="flex items-center gap-2">
            <Wrench
              className={cn(
                "size-4",
                centroRequiereReparaciones(reparaciones)
                  ? "text-amber-400"
                  : "text-emerald-400",
              )}
            />
            <p className="text-sm font-medium text-foreground">
              {centroRequiereReparaciones(reparaciones)
                ? `${pendientes.length} reparación${pendientes.length !== 1 ? "es" : ""} pendiente${pendientes.length !== 1 ? "s" : ""}`
                : "Todas las reparaciones resueltas"}
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span>{conteos.dañado} dañado{conteos.dañado !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{conteos.en_reparacion} en reparación</span>
            <span>·</span>
            <span>{conteos.reparado} reparado{conteos.reparado !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      <Card size="sm">
        <CardHeader className="px-3 py-2">
          <CardTitle className="flex items-center gap-1.5 text-xs">
            <Hammer className="size-3.5 text-amber-400" />
            Reporte de hoy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-3">
          <div>
            <Label className="text-xs font-medium">
              ¿El centro requiere trabajos de reparación?
            </Label>
            <div className="mt-1.5">
              <SelectorSiNo
                valor={requiereTrabajos}
                onChange={onRequiereTrabajos}
                deshabilitado={deshabilitado || !puedeEditar}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium">
              ¿Hoy se trabajó en solucionar esos trabajos?
            </Label>
            <div className="mt-1.5">
              <SelectorSiNo
                valor={seTrabajoHoy}
                onChange={onSeTrabajoHoy}
                deshabilitado={deshabilitado || !puedeEditar}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="rep-obs-dia" className="text-xs">
              Observaciones del día (opcional)
            </Label>
            <Textarea
              id="rep-obs-dia"
              className="mt-1"
              rows={2}
              value={observaciones}
              disabled={deshabilitado || !puedeEditar}
              onChange={(e) => onObservaciones(e.target.value)}
              placeholder="Ej. llegó cuadrilla de mantenimiento, falta material…"
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">Trabajos registrados</Label>
          {puedeEditar && !mostrandoForm && !editando && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMostrandoForm(true)}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
          )}
        </div>

        {mostrandoForm && (
          <div className="mb-3">
            <FormularioReparacion
              centroId={centroId}
              onGuardado={() => setMostrandoForm(false)}
              onCancelar={() => setMostrandoForm(false)}
            />
          </div>
        )}

        {editando && (
          <div className="mb-3">
            <FormularioReparacion
              centroId={centroId}
              reparacion={editando}
              onGuardado={() => setEditando(null)}
              onCancelar={() => setEditando(null)}
            />
          </div>
        )}

        {reparaciones.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <Camera className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground">
              Aún no hay trabajos de reparación registrados en este campamento.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {reparaciones.map((r) => (
              <TarjetaReparacion
                key={r.id}
                reparacion={r}
                puedeEditar={puedeEditar && !editando}
                onEditar={() => {
                  setEditando(r);
                  setMostrandoForm(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
