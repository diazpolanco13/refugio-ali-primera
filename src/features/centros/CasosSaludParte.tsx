import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Pencil, Plus, Stethoscope, Trash2, X } from "lucide-react";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import {
  actualizarCasoSalud,
  archivarCasoSalud,
  crearCasoSalud,
} from "@/data/reposCasosSalud";
import {
  casosAbiertosSeguimiento,
  ESTATUS_CASO_SALUD,
  META_ESTATUS_CASO_SALUD,
  type CasoSaludCentro,
  type EstatusCasoSalud,
} from "@/domain/casosSalud";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  incidenciasSalud: number;
  deshabilitado?: boolean;
}

function TarjetaCaso({
  caso,
  indice,
  hoyClave,
  editandoId,
  eliminandoId,
  deshabilitado,
  onEditar,
  onEliminar,
}: {
  caso: CasoSaludCentro;
  indice: number;
  hoyClave: string;
  editandoId: string | null;
  eliminandoId: string | null;
  deshabilitado?: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const meta = META_ESTATUS_CASO_SALUD[caso.estatus];
  const esEditando = editandoId === caso.id;

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
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: `${meta.color}66`, color: meta.color }}
            >
              {meta.label}
            </Badge>
            <BadgeAntiguedad
              reportadoDia={caso.reportado_dia}
              hoyClave={hoyClave}
              resueltaTs={caso.resuelta_ts}
              creadaTs={caso.creada_ts}
            />
          </div>
          {!esEditando && (
            <p className="mt-1.5 text-sm leading-snug text-foreground">{caso.descripcion}</p>
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
    </div>
  );
}

export function CasosSaludParte({ centroId, hoyClave, incidenciasSalud, deshabilitado }: Props) {
  const casosActivos = useCasosSaludCentros({ centroId, soloActivos: true });

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

  const [descripcion, setDescripcion] = useState("");
  const [estatus, setEstatus] = useState<EstatusCasoSalud>("activo");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const sectionRef = useRef<HTMLDivElement>(null);
  const prevIncidenciasRef = useRef(incidenciasSalud);
  const primeraRenderRef = useRef(true);

  const mostrar = incidenciasSalud > 0 || casosActivos.length > 0;
  const puedeAnadir =
    incidenciasSalud > 0 && casosSeguimiento.length < incidenciasSalud && !editandoId;
  const limiteAlcanzado =
    incidenciasSalud > 0 && casosSeguimiento.length >= incidenciasSalud && !editandoId;

  useEffect(() => {
    const prev = prevIncidenciasRef.current;
    prevIncidenciasRef.current = incidenciasSalud;

    const debeScroll =
      (prev === 0 && incidenciasSalud > 0) ||
      (primeraRenderRef.current && incidenciasSalud > 0);
    primeraRenderRef.current = false;

    if (!debeScroll) return;

    const timer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [incidenciasSalud]);

  function cancelarEdicion() {
    setEditandoId(null);
    setDescripcion("");
    setEstatus("activo");
  }

  function iniciarEdicion(id: string, desc: string, est: EstatusCasoSalud) {
    setEditandoId(id);
    setDescripcion(desc);
    setEstatus(est);
  }

  async function guardarCaso() {
    if (!descripcion.trim()) return;
    setGuardando(true);
    try {
      if (editandoId) {
        await actualizarCasoSalud(editandoId, { descripcion, estatus });
      } else {
        await crearCasoSalud({
          centro_id: centroId,
          descripcion,
          estatus,
          reportado_dia: hoyClave,
        });
      }
      cancelarEdicion();
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCaso(id: string) {
    setEliminandoId(id);
    try {
      await archivarCasoSalud(id);
      if (editandoId === id) cancelarEdicion();
    } finally {
      setEliminandoId(null);
    }
  }

  if (!mostrar) return null;

  const titulo =
    incidenciasSalud > 0
      ? `Añade información sobre los ${incidenciasSalud} casos de salud:`
      : "Casos de salud en seguimiento";

  const etiquetaBotonGuardar = editandoId
    ? "Actualizar caso"
    : casosSeguimiento.length === 0
      ? "Guardar primer caso"
      : "Añadir siguiente caso";

  return (
    <div
      ref={sectionRef}
      className="scroll-mt-4 rounded-lg border border-teal-500/30 bg-teal-500/5"
    >
      <div className="flex items-start justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-5 shrink-0 text-teal-400" />
            <p className="text-sm font-semibold leading-snug text-foreground">{titulo}</p>
          </div>
          {casosHeredados.length > 0 && (
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              Incluye {casosHeredados.length}{" "}
              {casosHeredados.length === 1 ? "caso en seguimiento" : "casos en seguimiento"} de días
              anteriores
            </p>
          )}
          {incidenciasSalud > 0 && casosSeguimiento.length < incidenciasSalud && (
            <p className="mt-1 pl-7 text-xs text-muted-foreground">
              Faltan {incidenciasSalud - casosSeguimiento.length}{" "}
              {incidenciasSalud - casosSeguimiento.length === 1 ? "caso por registrar" : "casos por registrar"}.
            </p>
          )}
        </div>
        {incidenciasSalud > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 tabular-nums",
              casosSeguimiento.length >= incidenciasSalud
                ? "border-teal-500/50 text-teal-400"
                : "border-amber-500/50 text-amber-400",
            )}
          >
            {casosSeguimiento.length}/{incidenciasSalud}
          </Badge>
        )}
      </div>

      {casosSeguimiento.length > 0 && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3 sm:px-4">
          <p className="text-xs font-medium text-muted-foreground">Casos abiertos (seguimiento)</p>
          {casosSeguimiento.map((c, idx) => (
            <TarjetaCaso
              key={c.id}
              caso={c}
              indice={idx}
              hoyClave={hoyClave}
              editandoId={editandoId}
              eliminandoId={eliminandoId}
              deshabilitado={deshabilitado}
              onEditar={() => iniciarEdicion(c.id, c.descripcion, c.estatus)}
              onEliminar={() => void eliminarCaso(c.id)}
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
              hoyClave={hoyClave}
              editandoId={editandoId}
              eliminandoId={eliminandoId}
              deshabilitado={deshabilitado}
              onEditar={() => iniciarEdicion(c.id, c.descripcion, c.estatus)}
              onEliminar={() => void eliminarCaso(c.id)}
            />
          ))}
        </div>
      )}

      {(puedeAnadir || editandoId) && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3 sm:px-4">
          <Label className="text-xs font-medium text-muted-foreground">
            {editandoId
              ? "Editar caso"
              : casosSeguimiento.length === 0
                ? "Primer caso"
                : "Siguiente caso"}
          </Label>
          <Textarea
            className="min-h-[4.5rem] text-sm"
            rows={3}
            value={descripcion}
            disabled={deshabilitado || guardando}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción breve del caso (obligatorio)"
          />
          <Select
            value={estatus}
            onValueChange={(v) => setEstatus(v as EstatusCasoSalud)}
            disabled={deshabilitado || guardando}
          >
            <SelectTrigger className="h-10 w-full text-sm">
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
              disabled={!descripcion.trim() || guardando || deshabilitado}
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
            {editandoId && (
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
            )}
          </div>
        </div>
      )}

      {limiteAlcanzado && (
        <p className="border-t border-border/60 px-3 py-3 text-xs text-muted-foreground sm:px-4">
          Has registrado los {incidenciasSalud} casos en seguimiento indicados. Puedes editarlos
          arriba si necesitas corregir algo.
        </p>
      )}
    </div>
  );
}
