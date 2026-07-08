import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Check,
  Loader2,
  Package,
  Pencil,
  Plus,
} from "lucide-react";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import {
  actualizarRequerimientoSeguimiento,
  archivarRequerimientoSeguimiento,
  crearRequerimientoSeguimiento,
} from "@/data/reposRequerimientosSeguimiento";
import {
  CATEGORIAS_REQUERIMIENTO,
  ESTATUS_REQUERIMIENTO,
  META_ESTATUS_REQUERIMIENTO,
  puedeArchivarRequerimiento,
  type CategoriaRequerimientoSeguimiento,
  type EstatusRequerimientoSeguimiento,
  type RequerimientoSeguimiento,
} from "@/domain/requerimientosSeguimiento";
import { BloqueConfirmacionReporte } from "@/features/centros/BloqueConfirmacionReporte";
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import { BadgeAntiguedad } from "@/components/ui/badge-antiguedad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  centroId: string;
  hoyClave: string;
  revisado: boolean;
  onConfirmarRevision: () => Promise<void>;
  onDesmarcarRevision?: () => Promise<void>;
  deshabilitado?: boolean;
  guardando?: boolean;
}

function TarjetaRequerimiento({
  item,
  onEditar,
  onArchivar,
  deshabilitado,
}: {
  item: RequerimientoSeguimiento;
  onEditar: () => void;
  onArchivar: () => void;
  deshabilitado?: boolean;
}) {
  const meta = META_ESTATUS_REQUERIMIENTO[item.estatus];
  const catLabel =
    CATEGORIAS_REQUERIMIENTO.find((c) => c.valor === item.categoria)?.label ?? item.categoria;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{item.concepto}</span>
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: `${meta.color}66`, color: meta.color }}>
              {meta.label}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {catLabel}
            </Badge>
            <BadgeAntiguedad reportadoDia={item.reportado_dia} resueltaTs={item.resuelta_ts} creadaTs={item.creada_ts} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Cantidad: <span className="font-semibold tabular-nums text-foreground">{item.cantidad}</span>
          </p>
          {item.notas && <p className="text-xs text-muted-foreground">{item.notas}</p>}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button type="button" size="icon-xs" variant="ghost" disabled={deshabilitado} onClick={onEditar}>
            <Pencil className="size-3.5" />
          </Button>
          {puedeArchivarRequerimiento(item.estatus) && (
            <Button type="button" size="icon-xs" variant="ghost" disabled={deshabilitado} onClick={onArchivar} aria-label="Archivar">
              <Archive className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RequerimientosReporteTab({
  centroId,
  hoyClave,
  revisado,
  onConfirmarRevision,
  onDesmarcarRevision,
  deshabilitado,
  guardando,
}: Props) {
  const items = useRequerimientosSeguimiento({ centroId, soloActivos: true });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [concepto, setConcepto] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [categoria, setCategoria] = useState<CategoriaRequerimientoSeguimiento>("otro");
  const [notas, setNotas] = useState("");
  const [estatus, setEstatus] = useState<EstatusRequerimientoSeguimiento>("solicitado");
  const [guardandoItem, setGuardandoItem] = useState(false);
  /** Cambios en ítems ya guardados (editar estatus, archivar, etc.) pendientes de confirmar bloque. */
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
    setConcepto("");
    setCantidad(0);
    setCategoria("otro");
    setNotas("");
    setEstatus("solicitado");
  }

  function cargarEdicion(r: RequerimientoSeguimiento) {
    setEditandoId(r.id);
    setConcepto(r.concepto);
    setCantidad(r.cantidad);
    setCategoria(r.categoria);
    setNotas(r.notas);
    setEstatus(r.estatus);
  }

  async function guardarItem() {
    if (!concepto.trim()) return;
    setGuardandoItem(true);
    try {
      if (editandoId) {
        await actualizarRequerimientoSeguimiento(editandoId, {
          concepto,
          cantidad,
          categoria,
          notas,
          estatus,
        });
      } else {
        await crearRequerimientoSeguimiento({
          centro_id: centroId,
          concepto,
          cantidad,
          categoria,
          notas,
          reportado_dia: hoyClave,
        });
      }
      resetForm();
      setListadoModificado(true);
    } finally {
      setGuardandoItem(false);
    }
  }

  const formularioPendiente =
    editandoId !== null || concepto.trim() !== "" || cantidad > 0 || notas.trim() !== "";

  const formularioModificado = formularioPendiente || listadoModificado;

  async function confirmarBloque() {
    if (formularioPendiente) return;
    await onConfirmarRevision();
    setListadoModificado(false);
  }

  const mensajeBloqueoConfirmacion = formularioPendiente
    ? editandoId
      ? "Actualiza o cancela el requerimiento en edición antes de guardar todos los cambios."
      : "Guarda el requerimiento en edición antes de guardar todos los cambios."
    : undefined;

  return (
    <div className="space-y-4">
      <BloqueConfirmacionReporte
        titulo="Requerimientos en seguimiento"
        tituloRevisado="Requerimientos revisados hoy"
        descripcion="Revisa el listado, actualiza estatus o añade requerimientos antes de confirmar."
        icono={Package}
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
            {items.length} {items.length === 1 ? "ítem" : "ítems"}
          </Badge>
        }
      />

      <Card size="sm" className="border-border/80">
        <CardContent className="space-y-2 px-3 py-3">
          <p className="text-xs font-medium">{editandoId ? "Editar requerimiento" : "Nuevo requerimiento"}</p>
          <div>
            <Label className="text-[11px] text-muted-foreground">Concepto</Label>
            <Input className="mt-1" value={concepto} disabled={deshabilitado} onChange={(e) => setConcepto(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
              <NumInput className="mt-1" value={cantidad} disabled={deshabilitado} onChange={setCantidad} />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Categoría</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaRequerimientoSeguimiento)} disabled={deshabilitado}>
                <SelectTrigger className={claseSelectReporte}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_REQUERIMIENTO.map((c) => (
                    <SelectItem key={c.valor} value={c.valor}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editandoId && (
            <div>
              <Label className="text-[11px] text-muted-foreground">Estatus</Label>
              <Select value={estatus} onValueChange={(v) => setEstatus(v as EstatusRequerimientoSeguimiento)} disabled={deshabilitado}>
                <SelectTrigger className={claseSelectReporte}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTATUS_REQUERIMIENTO.filter((e) => e.valor !== "archivado").map((e) => (
                    <SelectItem key={e.valor} value={e.valor}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-[11px] text-muted-foreground">Notas (opcional)</Label>
            <Textarea className="mt-1 min-h-[3rem]" rows={2} value={notas} disabled={deshabilitado} onChange={(e) => setNotas(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!concepto.trim() || guardandoItem || deshabilitado} onClick={() => void guardarItem()}>
              {guardandoItem ? <Loader2 className="size-3.5 animate-spin" /> : editandoId ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
              {editandoId ? "Actualizar" : "Guardar este requerimiento"}
            </Button>
            {editandoId && (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id}>
              <TarjetaRequerimiento
                item={r}
                deshabilitado={deshabilitado}
                onEditar={() => cargarEdicion(r)}
                onArchivar={() => {
                  void archivarRequerimientoSeguimiento(r.id).then(() => setListadoModificado(true));
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Sin requerimientos abiertos.</p>
      )}
    </div>
  );
}
