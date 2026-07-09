import { useEffect, useRef, useState } from "react";
import {
  Check,
  Loader2,
  Package,
  Plus,
} from "lucide-react";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import {
  actualizarRequerimientoSeguimiento,
  archivarRequerimientoSeguimiento,
  crearRequerimientoSeguimiento,
  eliminarRequerimientoSeguimiento,
} from "@/data/reposRequerimientosSeguimiento";
import { CONCEPTOS_REQUERIMIENTO_COMUNES } from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_REQUERIMIENTO,
  ESTATUS_REQUERIMIENTO,
  puedeArchivarRequerimiento,
  type CategoriaRequerimientoSeguimiento,
  type EstatusRequerimientoSeguimiento,
  type RequerimientoSeguimiento,
} from "@/domain/requerimientosSeguimiento";
import { BloqueConfirmacionReporte } from "@/features/centros/BloqueConfirmacionReporte";
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import {
  ListaRequerimientosSeguimiento,
  ResumenRequerimientosSeguimiento,
  TarjetaRequerimientoSeguimiento,
} from "@/features/centros/RequerimientosSeguimientoUi";
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

export function RequerimientosReporteTab({
  centroId,
  hoyClave,
  revisado,
  onConfirmarRevision,
  onDesmarcarRevision,
  deshabilitado,
  guardando,
}: Props) {
  const { requerimientos: items, recargar: recargarRequerimientos } = useRequerimientosSeguimiento({
    centroId,
    soloActivos: true,
  });
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [concepto, setConcepto] = useState("");
  const [cantidad, setCantidad] = useState(0);
  const [categoria, setCategoria] = useState<CategoriaRequerimientoSeguimiento>("otro");
  const [notas, setNotas] = useState("");
  const [estatus, setEstatus] = useState<EstatusRequerimientoSeguimiento>("solicitado");
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

  function agregarConceptoRapido(texto: string) {
    const existente = items.find(
      (i) => i.concepto.trim().toLowerCase() === texto.toLowerCase(),
    );
    if (existente) {
      cargarEdicion(existente);
      return;
    }
    resetForm();
    setConcepto(texto);
    setCantidad(1);
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
      await recargarRequerimientos();
    } finally {
      setGuardandoItem(false);
    }
  }

  async function eliminarItem(id: string) {
    setEliminandoId(id);
    try {
      await eliminarRequerimientoSeguimiento(id);
      if (editandoId === id) resetForm();
      setListadoModificado(true);
      await recargarRequerimientos();
    } finally {
      setEliminandoId(null);
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

  const conceptosUsados = new Set(
    items.map((i) => i.concepto.trim().toLowerCase()).filter(Boolean),
  );

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

      <ResumenRequerimientosSeguimiento items={items} />

      {!deshabilitado && (
        <div>
          <p className="mb-2 text-[11px] font-medium text-muted-foreground">Agregar rápido</p>
          <div className="flex flex-wrap gap-1.5">
            {CONCEPTOS_REQUERIMIENTO_COMUNES.map((texto) => {
              const yaEsta = conceptosUsados.has(texto.toLowerCase());
              return (
                <Button
                  key={texto}
                  type="button"
                  size="xs"
                  variant={yaEsta ? "secondary" : "outline"}
                  className="h-auto max-w-full py-1 whitespace-normal"
                  onClick={() => agregarConceptoRapido(texto)}
                >
                  <Plus className="size-3 shrink-0" />
                  {texto}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <Card size="sm" className="border-border/80">
        <CardContent className="space-y-3 px-3 py-3">
          <p className="text-xs font-medium">
            {editandoId ? "Editar requerimiento" : "Nuevo requerimiento"}
          </p>
          <div>
            <Label className="text-[11px] text-muted-foreground">Qué se necesita</Label>
            <Input
              className="mt-1"
              list="conceptos-requerimiento-reporte"
              value={concepto}
              disabled={deshabilitado}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Camas, cocina, tanques…"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Cantidad</Label>
              <NumInput
                className="mt-1"
                value={cantidad}
                disabled={deshabilitado}
                onChange={setCantidad}
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Categoría</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as CategoriaRequerimientoSeguimiento)}
                disabled={deshabilitado}
              >
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
              <Select
                value={estatus}
                onValueChange={(v) => setEstatus(v as EstatusRequerimientoSeguimiento)}
                disabled={deshabilitado}
              >
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
            <Textarea
              className="mt-1 min-h-[3rem]"
              rows={2}
              value={notas}
              disabled={deshabilitado}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Urgencia, ubicación, observación…"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!concepto.trim() || guardandoItem || deshabilitado}
              onClick={() => void guardarItem()}
            >
              {guardandoItem ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : editandoId ? (
                <Check className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {editandoId ? "Actualizar" : "Guardar requerimiento"}
            </Button>
            {(editandoId || formularioPendiente) && (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <datalist id="conceptos-requerimiento-reporte">
        {CONCEPTOS_REQUERIMIENTO_COMUNES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <ListaRequerimientosSeguimiento
        items={items}
        vacio={
          <p className="text-xs text-muted-foreground">
            Sin requerimientos abiertos. Usa una sugerencia rápida o agrega uno personalizado.
          </p>
        }
        renderItem={(r) => (
          <TarjetaRequerimientoSeguimiento
            item={r}
            modo="reporte"
            deshabilitado={deshabilitado}
            eliminando={eliminandoId === r.id}
            onEditar={() => cargarEdicion(r)}
            onArchivar={
              puedeArchivarRequerimiento(r.estatus)
                ? () => {
                    void archivarRequerimientoSeguimiento(r.id).then(async () => {
                      setListadoModificado(true);
                      await recargarRequerimientos();
                    });
                  }
                : undefined
            }
            onEliminar={() => void eliminarItem(r.id)}
          />
        )}
      />
    </div>
  );
}
