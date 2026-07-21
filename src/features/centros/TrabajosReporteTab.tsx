import { useEffect, useMemo, useRef, useState } from "react";
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
  archivarTrabajosCompletadosVencidos,
  crearTrabajo,
  eliminarTrabajo,
} from "@/data/reposReparaciones";
import { claveDia } from "@/data/reposSupabase";
import {
  debeAutoArchivarTrabajo,
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

type VistaTrabajos = "activos" | "archivados";

export function TarjetaTrabajo({
  trabajo,
  onEditar,
  onCambiarEstatus,
  onArchivar,
  onEliminar,
  cambiando,
  archivando,
  eliminando,
  deshabilitado,
}: {
  trabajo: TrabajoCentro;
  onEditar: () => void;
  /** Select compacto pendiente → en_progreso → completado. */
  onCambiarEstatus?: (estatus: EstatusTrabajo) => void;
  onArchivar?: () => void;
  onEliminar: () => void;
  cambiando?: boolean;
  archivando?: boolean;
  eliminando?: boolean;
  deshabilitado?: boolean;
}) {
  const meta = META_ESTATUS_TRABAJO[trabajo.estatus];
  const ocupado = Boolean(deshabilitado || eliminando || cambiando || archivando);
  const puedeArchivar = Boolean(onArchivar && puedeArchivarTrabajo(trabajo.estatus));
  const finalidadExtra =
    trabajo.finalidad.trim() &&
    trabajo.finalidad.trim().toLowerCase() !== trabajo.titulo.trim().toLowerCase()
      ? trabajo.finalidad.trim()
      : "";
  const detalle = [finalidadExtra, trabajo.descripcion.trim()].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "rounded-md border border-border/70 bg-card px-2.5 py-1.5",
        trabajo.estatus === "pendiente" && "border-red-500/25 bg-red-500/5",
        trabajo.estatus === "en_progreso" && "border-amber-500/20 bg-amber-500/5",
        trabajo.estatus === "completado" && "border-emerald-500/25 bg-emerald-500/5",
        trabajo.estatus === "archivado" && "border-border/60 bg-muted/20",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">{trabajo.titulo}</span>
            <BadgeAntiguedad
              reportadoDia={trabajo.reportada_dia}
              resueltaTs={trabajo.resuelta_ts}
              creadaTs={trabajo.creada_ts}
            />
            {ocupado && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
          {detalle ? (
            <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-muted-foreground">
              {detalle}
            </p>
          ) : null}
        </div>

        {trabajo.estatus !== "archivado" && onCambiarEstatus && !deshabilitado ? (
          <Select
            value={trabajo.estatus}
            disabled={ocupado}
            onValueChange={(v) => onCambiarEstatus(v as EstatusTrabajo)}
          >
            <SelectTrigger
              className="h-7 w-[7.25rem] shrink-0 text-[11px]"
              style={{ borderColor: `${meta.color}66`, color: meta.color }}
            >
              {cambiando ? <Loader2 className="size-3 animate-spin" /> : <SelectValue />}
            </SelectTrigger>
            <SelectContent>
              {ESTATUS_TRABAJO.filter((e) => e.valor !== "archivado").map((e) => (
                <SelectItem key={e.valor} value={e.valor} className="text-xs">
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge
            variant="outline"
            className="h-5 shrink-0 px-1.5 text-[10px]"
            style={{ borderColor: `${meta.color}66`, color: meta.color }}
          >
            {meta.label}
          </Badge>
        )}

        {trabajo.estatus !== "archivado" && (
          <div className="flex shrink-0 items-center gap-0.5">
            {puedeArchivar && (
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                disabled={ocupado}
                onClick={onArchivar}
                aria-label="Archivar trabajo"
                title="Archivar"
              >
                {archivando ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
              </Button>
            )}
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={ocupado}
              onClick={onEditar}
              aria-label="Editar trabajo"
            >
              <Pencil className="size-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={ocupado}
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
        )}
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
  const hoyReal = useMemo(() => claveDia(Date.now()), []);
  const { trabajos: activos, recargar: recargarActivos } = useReparacionesCentros({
    centroId,
    soloActivos: true,
  });
  const { trabajos: archivados, recargar: recargarArchivados } = useReparacionesCentros({
    centroId,
    estatus: "archivado",
  });
  const [vista, setVista] = useState<VistaTrabajos>("activos");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [finalidad, setFinalidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estatus, setEstatus] = useState<EstatusTrabajo>("pendiente");
  const [guardandoItem, setGuardandoItem] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);
  const [listadoModificado, setListadoModificado] = useState(false);
  const revisadoPrevio = useRef(revisado);
  const autoArchivoHecho = useRef(false);

  async function recargarTodo() {
    await Promise.all([recargarActivos(), recargarArchivados()]);
  }

  // Completados de días previos → archivados (el día de cierre se queda en activos).
  useEffect(() => {
    if (autoArchivoHecho.current || activos.length === 0) return;
    if (!activos.some((t) => debeAutoArchivarTrabajo(t, hoyReal))) return;
    autoArchivoHecho.current = true;
    void archivarTrabajosCompletadosVencidos(activos, hoyReal).then((n) => {
      if (n > 0) void recargarTodo();
    });
  }, [activos, hoyReal]);

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
    // Reactivar desde archivados: vuelve a «En curso» con formulario.
    setVista("activos");
    setEditandoId(t.id);
    setTitulo(t.titulo);
    setFinalidad(t.finalidad);
    setDescripcion(t.descripcion);
    setEstatus(t.estatus === "archivado" ? "completado" : t.estatus);
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
      await recargarTodo();
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
      await recargarTodo();
    } finally {
      setEliminandoId(null);
    }
  }

  async function cambiarEstatus(id: string, estatus: EstatusTrabajo) {
    setCambiandoId(id);
    try {
      await actualizarTrabajo(id, { estatus });
      setListadoModificado(true);
      await recargarTodo();
    } finally {
      setCambiandoId(null);
    }
  }

  async function archivarItem(id: string) {
    setArchivandoId(id);
    try {
      await archivarTrabajo(id);
      if (editandoId === id) resetForm();
      setListadoModificado(true);
      await recargarTodo();
    } finally {
      setArchivandoId(null);
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

  const lista = vista === "activos" ? activos : archivados;

  return (
    <div className="space-y-4">
      <BloqueConfirmacionReporte
        titulo="Trabajos activos"
        tituloRevisado="Trabajos revisados hoy"
        descripcion="Revisa el listado, actualiza estatus o añade trabajos nuevos antes de confirmar. Los completados pasan a Archivados al día siguiente."
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
            {activos.length} {activos.length === 1 ? "activo" : "activos"}
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={vista === "activos" ? "default" : "outline"}
            className="h-8"
            onClick={() => setVista("activos")}
          >
            En curso
            {activos.length > 0 ? ` (${activos.length})` : ""}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={vista === "archivados" ? "default" : "outline"}
            className="h-8 gap-1.5"
            onClick={() => {
              setVista("archivados");
              if (editandoId) resetForm();
            }}
          >
            <Archive className="size-3.5" />
            Archivados
            {archivados.length > 0 ? ` (${archivados.length})` : ""}
          </Button>
        </div>
      </div>

      {vista === "activos" && (
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
      )}

      {lista.length > 0 ? (
        <ul className="space-y-2">
          {lista.map((t) => (
            <li key={t.id}>
              <TarjetaTrabajo
                trabajo={t}
                deshabilitado={deshabilitado}
                cambiando={cambiandoId === t.id}
                archivando={archivandoId === t.id}
                eliminando={eliminandoId === t.id}
                onEditar={() => cargarEdicion(t)}
                onCambiarEstatus={
                  vista === "activos" && !deshabilitado
                    ? (est) => void cambiarEstatus(t.id, est)
                    : undefined
                }
                onArchivar={
                  vista === "activos" && !deshabilitado
                    ? () => void archivarItem(t.id)
                    : undefined
                }
                onEliminar={() => void eliminarItem(t.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {vista === "activos" ? "Sin trabajos abiertos." : "Sin trabajos archivados."}
        </p>
      )}
    </div>
  );
}
