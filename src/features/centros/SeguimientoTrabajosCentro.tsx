// Seguimiento de trabajos/reparaciones del campamento (misma fuente que el
// reporte diario). Crear, editar, archivar y eliminar sin bloque de confirmación.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, Wrench, X } from "lucide-react";
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
  type EstatusTrabajo,
  type TrabajoCentro,
} from "@/domain/reparaciones";
import { TarjetaTrabajo } from "@/features/centros/TrabajosReporteTab";
import { claseSelectReporte } from "@/features/centros/clasesReporte";
import { formatearDiaCalendario } from "./CalendarioSelectorDia";
import {
  EncabezadoDiaSeguimiento,
  SEGUIMIENTO_ITEMS_POR_PAGINA,
  agruparPorDiaCampo,
} from "./seguimientoListaUi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginadorTabla } from "@/components/ui/pagination";
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
  hoyClave: string;
  diaSel?: string | null;
  activos: TrabajoCentro[];
  archivados: TrabajoCentro[];
  onRecargar: () => Promise<void>;
  onIrAReporte?: (fase?: string) => void;
}

type SubVista = "activos" | "archivados";

export function SeguimientoTrabajosCentro({
  centroId,
  puedeEditar,
  hoyClave,
  diaSel = null,
  activos,
  archivados,
  onRecargar,
  onIrAReporte,
}: Props) {
  const hoyReal = useMemo(() => claveDia(Date.now()), []);
  const autoArchivoHecho = useRef(false);

  const [subVista, setSubVista] = useState<SubVista>("activos");
  const [pagina, setPagina] = useState(0);
  const [formularioNuevo, setFormularioNuevo] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [finalidad, setFinalidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estatus, setEstatus] = useState<EstatusTrabajo>("pendiente");
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);

  useEffect(() => {
    if (autoArchivoHecho.current || activos.length === 0) return;
    if (!activos.some((t) => debeAutoArchivarTrabajo(t, hoyReal))) return;
    autoArchivoHecho.current = true;
    void archivarTrabajosCompletadosVencidos(activos, hoyReal).then((n) => {
      if (n > 0) void onRecargar();
    });
  }, [activos, hoyReal, onRecargar]);

  function resetForm() {
    setEditandoId(null);
    setFormularioNuevo(false);
    setTitulo("");
    setFinalidad("");
    setDescripcion("");
    setEstatus("pendiente");
  }

  function abrirNuevo() {
    setEditandoId(null);
    setTitulo("");
    setFinalidad("");
    setDescripcion("");
    setEstatus("pendiente");
    setSubVista("activos");
    setFormularioNuevo(true);
  }

  function iniciarEdicion(t: TrabajoCentro) {
    setFormularioNuevo(false);
    setSubVista("activos");
    setEditandoId(t.id);
    setTitulo(t.titulo);
    setFinalidad(t.finalidad);
    setDescripcion(t.descripcion);
    setEstatus(t.estatus === "archivado" ? "completado" : t.estatus);
  }

  async function guardar() {
    if (!titulo.trim()) return;
    setGuardando(true);
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
          reportada_dia: diaSel ?? hoyClave,
        });
      }
      resetForm();
      await onRecargar();
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    setEliminandoId(id);
    try {
      await eliminarTrabajo(id);
      if (editandoId === id) resetForm();
      await onRecargar();
    } finally {
      setEliminandoId(null);
    }
  }

  async function cambiarEstatus(id: string, estatus: EstatusTrabajo) {
    setCambiandoId(id);
    try {
      await actualizarTrabajo(id, { estatus });
      await onRecargar();
    } finally {
      setCambiandoId(null);
    }
  }

  async function archivar(id: string) {
    setArchivandoId(id);
    try {
      await archivarTrabajo(id);
      if (editandoId === id) resetForm();
      await onRecargar();
    } finally {
      setArchivandoId(null);
    }
  }

  const listaBase = subVista === "activos" ? activos : archivados;
  const lista = useMemo(() => {
    const filtrados = diaSel
      ? listaBase.filter((t) => t.reportada_dia === diaSel)
      : listaBase;
    return [...filtrados].sort(
      (a, b) =>
        b.reportada_dia.localeCompare(a.reportada_dia) || b.creada_ts - a.creada_ts,
    );
  }, [listaBase, diaSel]);

  const totalPaginas = Math.max(1, Math.ceil(lista.length / SEGUIMIENTO_ITEMS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const listaPagina = useMemo(() => {
    const inicio = paginaSegura * SEGUIMIENTO_ITEMS_POR_PAGINA;
    return lista.slice(inicio, inicio + SEGUIMIENTO_ITEMS_POR_PAGINA);
  }, [lista, paginaSegura]);
  const gruposPagina = useMemo(
    () => agruparPorDiaCampo(listaPagina, (t) => t.reportada_dia),
    [listaPagina],
  );

  useEffect(() => {
    setPagina(0);
  }, [subVista, diaSel]);

  const mostrarForm = puedeEditar && (formularioNuevo || editandoId !== null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-lg border border-border/70 text-[11px] font-semibold">
          {(
            [
              {
                valor: "activos" as const,
                label: `En curso${activos.length > 0 ? ` (${activos.length})` : ""}`,
              },
              {
                valor: "archivados" as const,
                label: `Archivados${archivados.length > 0 ? ` (${archivados.length})` : ""}`,
              },
            ]
          ).map((s) => (
            <button
              key={s.valor}
              type="button"
              onClick={() => {
                setSubVista(s.valor);
                if (s.valor === "archivados" && editandoId) resetForm();
              }}
              className={cn(
                "border-r border-border/70 px-2.5 py-1.5 transition-colors last:border-r-0",
                subVista === s.valor
                  ? "bg-teal-600/20 text-teal-300"
                  : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        {puedeEditar && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
              disabled={formularioNuevo}
              onClick={abrirNuevo}
            >
              <Plus className="size-3.5" />
              Añadir trabajo
            </Button>
            {onIrAReporte && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => onIrAReporte("trabajos")}
              >
                <Wrench className="size-3.5" />
                Ir al reporte
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {subVista === "activos"
          ? "Trabajos abiertos del campamento. Completados pasan a Archivados al día siguiente."
          : "Trabajos archivados, ordenados por fecha."}
      </p>

      {mostrarForm && (
        <div className="space-y-3 rounded-lg border border-teal-500/40 bg-teal-500/5 px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              {editandoId ? "Editar trabajo" : "Nuevo trabajo"}
            </p>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {formatearDiaCalendario(diaSel ?? hoyClave)}
            </Badge>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Trabajo</Label>
            <Input
              className="mt-1"
              value={titulo}
              disabled={guardando}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título del trabajo (obligatorio)"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Finalidad</Label>
            <Input
              className="mt-1"
              value={finalidad}
              disabled={guardando}
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
              disabled={guardando}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Progreso</Label>
            <Select
              value={estatus}
              onValueChange={(v) => setEstatus(v as EstatusTrabajo)}
              disabled={guardando}
            >
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="sm:flex-1"
              disabled={!titulo.trim() || guardando}
              onClick={() => void guardar()}
            >
              {guardando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {editandoId ? "Actualizar trabajo" : "Guardar trabajo"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={guardando}
              onClick={resetForm}
            >
              <X className="size-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <Wrench className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {subVista === "activos"
              ? diaSel
                ? "Sin trabajos ese día"
                : "Sin trabajos en curso"
              : diaSel
                ? "Sin trabajos archivados ese día"
                : "Sin trabajos archivados"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Añade un trabajo aquí o desde el reporte del día.
          </p>
          {puedeEditar && subVista === "activos" && (
            <Button
              type="button"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={abrirNuevo}
            >
              <Plus className="size-3.5" />
              Añadir trabajo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {gruposPagina.map((grupo) => (
            <div key={grupo.dia} className="space-y-2">
              <EncabezadoDiaSeguimiento
                dia={grupo.dia}
                cantidad={grupo.items.length}
                hoyClave={hoyClave}
              />
              <div className="space-y-2">
                {grupo.items.map((t) => (
                  <TarjetaTrabajo
                    key={t.id}
                    trabajo={t}
                    variante="seguimiento"
                    deshabilitado={!puedeEditar}
                    cambiando={cambiandoId === t.id}
                    archivando={archivandoId === t.id}
                    eliminando={eliminandoId === t.id}
                    onEditar={() => iniciarEdicion(t)}
                    onCambiarEstatus={
                      subVista === "activos" && puedeEditar
                        ? (est) => void cambiarEstatus(t.id, est)
                        : undefined
                    }
                    onArchivar={
                      subVista === "activos" && puedeEditar
                        ? () => void archivar(t.id)
                        : undefined
                    }
                    onEliminar={() => void eliminar(t.id)}
                  />
                ))}
              </div>
            </div>
          ))}
          {lista.length > SEGUIMIENTO_ITEMS_POR_PAGINA && (
            <PaginadorTabla
              pagina={paginaSegura}
              totalPaginas={totalPaginas}
              totalFilas={lista.length}
              filasPorPagina={SEGUIMIENTO_ITEMS_POR_PAGINA}
              onPagina={setPagina}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Contador accionable: pendiente + en progreso (badge de pestaña). */
export function contarTrabajosPendientesSeguimiento(activos: TrabajoCentro[]): number {
  return activos.filter((t) => t.estatus === "pendiente" || t.estatus === "en_progreso").length;
}
