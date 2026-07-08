import { useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Wrench,
} from "lucide-react";
import { useReparacionesCentros } from "@/data/useReparacionesCentros";
import {
  actualizarTrabajo,
  archivarTrabajo,
  crearTrabajo,
} from "@/data/reposReparaciones";
import {
  ESTATUS_TRABAJO,
  META_ESTATUS_TRABAJO,
  puedeArchivarTrabajo,
  type EstatusTrabajo,
  type TrabajoCentro,
} from "@/domain/reparaciones";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  onRevisadoChange: (v: boolean) => void;
  onConfirmarRevision: () => Promise<void>;
  deshabilitado?: boolean;
  guardando?: boolean;
}

function TarjetaTrabajo({
  trabajo,
  onEditar,
  onArchivar,
  deshabilitado,
}: {
  trabajo: TrabajoCentro;
  onEditar: () => void;
  onArchivar: () => void;
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
          <Button type="button" size="icon-xs" variant="ghost" disabled={deshabilitado} onClick={onEditar}>
            <Pencil className="size-3.5" />
          </Button>
          {puedeArchivarTrabajo(trabajo.estatus) && (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              disabled={deshabilitado}
              onClick={onArchivar}
              aria-label="Archivar"
            >
              <Archive className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function TrabajosReporteTab({
  centroId,
  hoyClave,
  revisado,
  onRevisadoChange,
  onConfirmarRevision,
  deshabilitado,
  guardando,
}: Props) {
  const trabajos = useReparacionesCentros({ centroId, soloActivos: true });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [finalidad, setFinalidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estatus, setEstatus] = useState<EstatusTrabajo>("pendiente");
  const [guardandoItem, setGuardandoItem] = useState(false);

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
    } finally {
      setGuardandoItem(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-lg border px-3 py-3",
          revisado ? "border-emerald-500/35 bg-emerald-500/5" : "border-amber-500/35 bg-amber-500/5",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Wrench className="size-4 text-amber-400" />
            Trabajos activos
          </p>
          <Badge variant="outline" className="tabular-nums">
            {trabajos.length} {trabajos.length === 1 ? "ítem" : "ítems"}
          </Badge>
        </div>
      </div>

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
              <SelectTrigger className="mt-1 w-full">
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
              {editandoId ? "Actualizar" : "Añadir trabajo"}
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
                onEditar={() => cargarEdicion(t)}
                onArchivar={() => void archivarTrabajo(t.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin trabajos abiertos.</p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={deshabilitado || guardando}
          onClick={() => {
            onRevisadoChange(true);
            void onConfirmarRevision();
          }}
        >
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Confirmar revisión del bloque
        </Button>
      </div>
    </div>
  );
}
