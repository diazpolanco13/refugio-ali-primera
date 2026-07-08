import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import {
  actualizarTrabajo,
  archivarTrabajo,
  crearTrabajo,
  eliminarTrabajo,
} from "@/data/reposReparaciones";
import {
  ESTATUS_TRABAJO,
  META_ESTATUS_TRABAJO,
  puedeArchivarTrabajo,
  type EstatusTrabajo,
  type TrabajoCentro,
} from "@/domain/reparaciones";
import { BloqueConfirmacionReporte } from "@/features/centros/BloqueConfirmacionReporte";
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
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
  hoyClave: string;
  revisado: boolean;
  onConfirmarRevision: () => Promise<void>;
  onDesmarcarRevision?: () => Promise<void>;
  deshabilitado?: boolean;
  guardando?: boolean;
}

function TarjetaTrabajo({
  trabajo,
  onEditar,
  onArchivar,
  onEliminar,
  eliminando,
  deshabilitado,
}: {
  trabajo: TrabajoCentro;
  onEditar: () => void;
  onArchivar: () => void;
  onEliminar: () => void;
  eliminando?: boolean;
  deshabilitado?: boolean;
}) {
  const meta = META_ESTATUS_TRABAJO[trabajo.estatus];
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-2.5",
        trabajo.estatus === "pendiente" && "border-red-500/30 bg-red-500/5",
        trabajo.estatus === "en_progreso" && "border-amber-500/25 bg-amber-500/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{trabajo.titulo}</span>
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: `${meta.color}66`, color: meta.color }}
            >
              {meta.label}
            </Badge>
            <BadgeAntiguedad
              reportadoDia={trabajo.reportada_dia}
              resueltaTs={trabajo.resuelta_ts}
              creadaTs={trabajo.creada_ts}
            />
          </div>
          {trabajo.finalidad && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium">Finalidad:</span> {trabajo.finalidad}
            </p>
          )}
          {trabajo.descripcion && (
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">{trabajo.descripcion}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button type="button" size="icon-xs" variant="ghost" disabled={deshabilitado || eliminando} onClick={onEditar}>
            <Pencil className="size-3.5" />
          </Button>
          {puedeArchivarTrabajo(trabajo.estatus) && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={deshabilitado || eliminando}
              onClick={onArchivar}
              aria-label="Archivar"
            >
              <Archive className="size-3.5" />
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={deshabilitado || eliminando}
                aria-label="Eliminar trabajo"
              >
                {eliminando ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar trabajo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrará «{trabajo.titulo}» de forma permanente. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onEliminar}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export function TrabajosReporteTab({
  centroId,
  hoyClave,
  revisado,
  onConfirmarRevision,
  onDesmarcarRevision,
  deshabilitado,
  guardando,
}: Props) {
  const { trabajos, recargar: recargarTrabajos } = useReparacionesCentros({
    centroId,
    soloActivos: true,
  });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [finalidad, setFinalidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estatus, setEstatus] = useState<EstatusTrabajo>("pendiente");
  const [guardandoItem, setGuardandoItem] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [listadoModificado, setListadoModificado] = useState(false);
  const revisadoPrevio = useRef(revisado);

  useEffect(() => {
    if (revisado && !revisadoPrevio.current) {
      setListadoModificado(false);
    }
    revisadoPrevio.current = revisado;
  }, [revisado]);

  function resetForm() {
    setEditandoId(null);
    setTitulo("");
    setFinalidad("");
    setDescripcion("");
    setEstatus("pendiente");
  }

  function cargarEdicion(t: TrabajoCentro) {
    setEditandoId(t.id);
    setTitulo(t.titulo);
    setFinalidad(t.finalidad);
    setDescripcion(t.descripcion);
    setEstatus(t.estatus);
  }

  async function guardarItem() {
    if (!titulo.trim()) return;
    setGuardandoItem(true);
    try {
      if (editandoId) {
        await actualizarTrabajo(editandoId, {
          titulo,
          finalidad,
          descripcion,
          estatus,
        });
      } else {
        await crearTrabajo({
          centro_id: centroId,
          titulo,
          finalidad,
          descripcion,
          estatus,
          reportada_dia: hoyClave,
        });
      }
      resetForm();
      setListadoModificado(true);
      await recargarTrabajos();
    } finally {
      setGuardandoItem(false);
    }
  }

  async function eliminarItem(id: string) {
    setEliminandoId(id);
    try {
      await eliminarTrabajo(id);
      if (editandoId === id) resetForm();
      setListadoModificado(true);
      await recargarTrabajos();
    } finally {
      setEliminandoId(null);
    }
  }

  const formularioPendiente =
    editandoId !== null || titulo.trim() !== "" || finalidad.trim() !== "" || descripcion.trim() !== "";

  const formularioModificado = formularioPendiente || listadoModificado;

  async function confirmarBloque() {
    if (formularioPendiente) return;
    await onConfirmarRevision();
    setListadoModificado(false);
  }

  const mensajeBloqueoConfirmacion = formularioPendiente
    ? editandoId
      ? "Actualiza o cancela el trabajo en edición antes de guardar todos los cambios."
      : "Guarda el trabajo en edición antes de guardar todos los cambios."
    : undefined;

  return (
    <div className="space-y-4">
      <BloqueConfirmacionReporte
        titulo="Trabajos activos"
        tituloRevisado="Trabajos revisados hoy"
        descripcion="Revisa el listado, actualiza estatus o añade trabajos nuevos antes de confirmar."
        icono={Wrench}
        acento="amber"
        revisado={revisado}
        modificado={formularioModificado}
        guardando={guardando || guardandoItem}
        deshabilitado={deshabilitado}
        onConfirmar={() => void confirmarBloque()}
        onDesmarcar={onDesmarcarRevision ? () => void onDesmarcarRevision() : undefined}
        etiquetaGuardar="Guardar todos los cambios"
        etiquetaConfirmar="Confirmar sin cambios"
        etiquetaActualizar="Actualizar revisión"
        confirmacionBloqueada={formularioPendiente}
        mensajeConfirmacionBloqueada={mensajeBloqueoConfirmacion}
        badgeExtra={
          <Badge variant="outline" className="tabular-nums">
            {trabajos.length} {trabajos.length === 1 ? "ítem" : "ítems"}
          </Badge>
        }
      />

      <Card size="sm" className="border-border/80">
        <CardContent className="space-y-2 px-3 py-3">
          <p className="text-xs font-medium">{editandoId ? "Editar trabajo" : "Nuevo trabajo"}</p>
          <div>
            <Label className="text-[11px] text-muted-foreground">Trabajo</Label>
            <Input className="mt-1" value={titulo} disabled={deshabilitado} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Finalidad</Label>
            <Input
              className="mt-1"
              value={finalidad}
              disabled={deshabilitado}
              onChange={(e) => setFinalidad(e.target.value)}
              placeholder="Problema que resuelve"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Detalle (opcional)</Label>
            <Textarea
              className="mt-1 min-h-[3rem]"
              rows={2}
              value={descripcion}
              disabled={deshabilitado}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Progreso</Label>
            <Select value={estatus} onValueChange={(v) => setEstatus(v as EstatusTrabajo)} disabled={deshabilitado}>
              <SelectTrigger className={claseSelectReporte}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTATUS_TRABAJO.filter((e) => e.valor !== "archivado").map((e) => (
                  <SelectItem key={e.valor} value={e.valor}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!titulo.trim() || guardandoItem || deshabilitado} onClick={() => void guardarItem()}>
              {guardandoItem ? <Loader2 className="size-3.5 animate-spin" /> : editandoId ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {editandoId ? "Actualizar" : "Guardar este trabajo"}
            </Button>
            {editandoId && (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {trabajos.length > 0 ? (
        <ul className="space-y-2">
          {trabajos.map((t) => (
            <li key={t.id}>
              <TarjetaTrabajo
                trabajo={t}
                deshabilitado={deshabilitado}
                eliminando={eliminandoId === t.id}
                onEditar={() => cargarEdicion(t)}
                onArchivar={() => {
                  void archivarTrabajo(t.id).then(async () => {
                    setListadoModificado(true);
                    await recargarTrabajos();
                  });
                }}
                onEliminar={() => void eliminarItem(t.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin trabajos abiertos.</p>
      )}
    </div>
  );
}
