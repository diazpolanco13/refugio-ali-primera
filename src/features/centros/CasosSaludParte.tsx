import { useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Stethoscope, Trash2, X } from "lucide-react";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import {
  actualizarCasoSalud,
  crearCasoSalud,
  eliminarCasoSalud,
} from "@/data/reposCasosSalud";
import {
  casosAbiertosSeguimiento,
  contarCasosSaludPorDia,
  ESTATUS_CASO_SALUD,
  type CasoSaludCentro,
  type EstatusCasoSalud,
} from "@/domain/casosSalud";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import { cn } from "@/lib/utils";

interface Props {
  centroId: string;
  hoyClave: string;
  deshabilitado?: boolean;
}

function TarjetaCaso({
  caso,
  indice,
  editandoId,
  eliminandoId,
  cambiandoEstatusId,
  deshabilitado,
  onEditar,
  onEliminar,
  onCambiarEstatus,
}: {
  caso: CasoSaludCentro;
  indice: number;
  editandoId: string | null;
  eliminandoId: string | null;
  cambiandoEstatusId: string | null;
  deshabilitado?: boolean;
  onEditar: () => void;
  onEliminar: () => void;
  onCambiarEstatus: (estatus: EstatusCasoSalud) => void;
}) {
  const esEditando = editandoId === caso.id;
  const cambiando = cambiandoEstatusId === caso.id;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/10 px-3 py-3",
        esEditando ? "border-teal-500/50 ring-1 ring-teal-500/20" : "border-border/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Caso {indice + 1}</span>
            <BadgeAntiguedad
              reportadoDia={caso.reportado_dia}
              resueltaTs={caso.resuelta_ts}
              creadaTs={caso.creada_ts}
            />
            {cambiando && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          {!esEditando && (
            <>
              <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
                {caso.titulo}
              </p>
              {caso.descripcion ? (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {caso.descripcion}
                </p>
              ) : null}
            </>
          )}
        </div>
        {!esEditando && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={deshabilitado || eliminandoId === caso.id}
              aria-label="Editar caso"
              onClick={onEditar}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={deshabilitado || eliminandoId === caso.id}
              aria-label="Eliminar caso"
              onClick={onEliminar}
            >
              {eliminandoId === caso.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {!esEditando && (
        <div className="mt-2.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Estatus del caso
          </p>
          <div className="flex overflow-hidden rounded-lg border border-border/70">
            {ESTATUS_CASO_SALUD.filter((e) => e.valor !== "archivado").map((e) => {
              const activo = caso.estatus === e.valor;
              return (
                <button
                  key={e.valor}
                  type="button"
                  disabled={deshabilitado || cambiando || activo}
                  onClick={() => onCambiarEstatus(e.valor)}
                  className={cn(
                    "flex-1 border-r border-border/70 px-2 py-1.5 text-[11px] font-semibold transition-colors last:border-r-0",
                    activo
                      ? "text-white"
                      : "text-muted-foreground hover:bg-muted/40 active:bg-muted/60",
                  )}
                  style={activo ? { backgroundColor: e.color } : undefined}
                >
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CasosSaludParte({ centroId, hoyClave, deshabilitado }: Props) {
  // Incluye archivados para que el conteo del día (= fichas creadas) sea exacto.
  const { casos: todosCasos, recargar } = useCasosSaludCentros({ centroId });

  const casosActivos = useMemo(
    () => todosCasos.filter((c) => c.estatus !== "archivado"),
    [todosCasos],
  );
  const casosSeguimiento = useMemo(
    () => casosAbiertosSeguimiento(casosActivos),
    [casosActivos],
  );
  const casosResueltos = useMemo(
    () => casosActivos.filter((c) => c.estatus === "resuelto"),
    [casosActivos],
  );
  const casosHeredados = useMemo(
    () => casosSeguimiento.filter((c) => c.reportado_dia !== hoyClave),
    [casosSeguimiento, hoyClave],
  );
  const casosDelDia = useMemo(
    () => contarCasosSaludPorDia(todosCasos, centroId, hoyClave),
    [todosCasos, centroId, hoyClave],
  );

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estatus, setEstatus] = useState<EstatusCasoSalud>("activo");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [cambiandoEstatusId, setCambiandoEstatusId] = useState<string | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  function cancelarEdicion() {
    setEditandoId(null);
    setTitulo("");
    setDescripcion("");
    setEstatus("activo");
    setFormularioAbierto(false);
  }

  function iniciarEdicion(caso: CasoSaludCentro) {
    setEditandoId(caso.id);
    setTitulo(caso.titulo);
    setDescripcion(caso.descripcion);
    setEstatus(caso.estatus);
    setFormularioAbierto(true);
  }

  function abrirNuevo() {
    setEditandoId(null);
    setTitulo("");
    setDescripcion("");
    setEstatus("activo");
    setFormularioAbierto(true);
  }

  async function guardarCaso() {
    if (!titulo.trim()) return;
    setGuardando(true);
    try {
      if (editandoId) {
        await actualizarCasoSalud(editandoId, { titulo, descripcion, estatus });
      } else {
        await crearCasoSalud({
          centro_id: centroId,
          titulo,
          descripcion,
          estatus,
          reportado_dia: hoyClave,
        });
      }
      await recargar();
      cancelarEdicion();
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstatus(id: string, nuevo: EstatusCasoSalud) {
    setCambiandoEstatusId(id);
    try {
      await actualizarCasoSalud(id, { estatus: nuevo });
      await recargar();
    } finally {
      setCambiandoEstatusId(null);
    }
  }

  async function eliminarCaso(id: string) {
    setEliminandoId(id);
    try {
      await eliminarCasoSalud(id);
      await recargar();
      if (editandoId === id) cancelarEdicion();
    } finally {
      setEliminandoId(null);
    }
  }

  const etiquetaBotonGuardar = editandoId
    ? "Actualizar caso"
    : casosDelDia === 0
      ? "Guardar primer caso"
      : "Añadir caso";

  return (
    <div className="scroll-mt-4 rounded-lg border border-teal-500/30 bg-teal-500/5">
      <div className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-5 shrink-0 text-teal-400" />
            <p className="text-sm font-semibold leading-snug text-foreground">
              Casos de salud del día
            </p>
          </div>
          <p className="mt-1 pl-7 text-xs text-muted-foreground">
            El conteo del parte se calcula con las fichas registradas.
            {casosDelDia === 0
              ? " Sin casos hoy = sin incidencias."
              : ` ${casosDelDia} caso${casosDelDia === 1 ? "" : "s"} registrado${casosDelDia === 1 ? "" : "s"} hoy.`}
          </p>
          {casosHeredados.length > 0 && (
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              Incluye {casosHeredados.length}{" "}
              {casosHeredados.length === 1 ? "caso en seguimiento" : "casos en seguimiento"} de días
              anteriores
            </p>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 tabular-nums",
            casosDelDia > 0 ? "border-teal-500/50 text-teal-400" : "text-muted-foreground",
          )}
        >
          {casosDelDia}
        </Badge>
      </div>

      {casosSeguimiento.length > 0 && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3 sm:px-4">
          <p className="text-xs font-medium text-muted-foreground">Casos abiertos (seguimiento)</p>
          {casosSeguimiento.map((c, idx) => (
            <TarjetaCaso
              key={c.id}
              caso={c}
              indice={idx}
              editandoId={editandoId}
              eliminandoId={eliminandoId}
              cambiandoEstatusId={cambiandoEstatusId}
              deshabilitado={deshabilitado}
              onEditar={() => iniciarEdicion(c)}
              onEliminar={() => void eliminarCaso(c.id)}
              onCambiarEstatus={(est) => void cambiarEstatus(c.id, est)}
            />
          ))}
        </div>
      )}

      {casosResueltos.length > 0 && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3 sm:px-4">
          <p className="text-xs font-medium text-muted-foreground">
            Resueltos (pendientes de archivar)
          </p>
          {casosResueltos.map((c, idx) => (
            <TarjetaCaso
              key={c.id}
              caso={c}
              indice={idx}
              editandoId={editandoId}
              eliminandoId={eliminandoId}
              cambiandoEstatusId={cambiandoEstatusId}
              deshabilitado={deshabilitado}
              onEditar={() => iniciarEdicion(c)}
              onEliminar={() => void eliminarCaso(c.id)}
              onCambiarEstatus={(est) => void cambiarEstatus(c.id, est)}
            />
          ))}
        </div>
      )}

      {formularioAbierto ? (
        <div className="space-y-3 border-t border-border/60 px-3 py-3 sm:px-4">
          <Label className="text-xs font-medium text-muted-foreground">
            {editandoId ? "Editar caso" : "Nuevo caso"}
          </Label>
          <Input
            className="h-10 text-sm"
            value={titulo}
            disabled={deshabilitado || guardando}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título del caso (obligatorio) — ej. Adulto mayor hipertenso"
          />
          <Textarea
            className="min-h-[4rem] text-sm"
            rows={2}
            value={descripcion}
            disabled={deshabilitado || guardando}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalle del caso (opcional)"
          />
          <Select
            value={estatus}
            onValueChange={(v) => setEstatus(v as EstatusCasoSalud)}
            disabled={deshabilitado || guardando}
          >
            <SelectTrigger className={cn(claseSelectReporte, "mt-0")}>
              <SelectValue placeholder="Estatus" />
            </SelectTrigger>
            <SelectContent>
              {ESTATUS_CASO_SALUD.filter((e) => e.valor !== "archivado").map((e) => (
                <SelectItem key={e.valor} value={e.valor}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className={cn("w-full sm:flex-1", !editandoId && "bg-teal-600 hover:bg-teal-500")}
              disabled={!titulo.trim() || guardando || deshabilitado}
              onClick={() => void guardarCaso()}
            >
              {guardando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editandoId ? (
                <Check className="size-4" />
              ) : (
                <Plus className="size-4" />
              )}
              {etiquetaBotonGuardar}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={guardando || deshabilitado}
              onClick={cancelarEdicion}
            >
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border/60 px-3 py-3 sm:px-4">
          <Button
            type="button"
            size="sm"
            className="gap-1.5 bg-teal-600 hover:bg-teal-500"
            disabled={deshabilitado}
            onClick={abrirNuevo}
          >
            <Plus className="size-3.5" />
            Añadir caso
          </Button>
        </div>
      )}
    </div>
  );
}
