// Sección de INCIDENCIAS de un campamento: alta, bandeja de abiertas,
// calendario interactivo e historial. Modo `expandido` para la ficha a
// pantalla completa; `compacto` (default) para el panel lateral del mapa.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Siren,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useIncidencias } from "@/data/useIncidencias";
import {
  actualizarIncidencia,
  crearIncidencia,
  eliminarIncidencia,
  resolverIncidencia,
} from "@/data/reposReportes";
import { claveDia } from "@/data/reposSupabase";
import { useSesion } from "@/data/authSupabase";
import { puedeEliminarIncidencia, puedeResolverIncidencia } from "@/domain/permisos";
import {
  CATEGORIAS_INCIDENCIA,
  CATEGORIA_LABEL,
  ETIQUETAS_INCIDENCIA,
  META_ETIQUETA,
  agruparIncidenciasPorDia,
  compararSeveridad,
  contadoresIncidenciasPorPeriodo,
  incidenciasAbiertas,
  parsearDiaIncidencia,
  severidadMaximaPorDia,
  type CategoriaIncidencia,
  type EtiquetaIncidencia,
  type Incidencia,
} from "@/domain/incidencias";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CalendarioSelectorDia,
  formatearDiaCalendario,
} from "./CalendarioSelectorDia";
import { GraficoIncidenciasCentro } from "./GraficoIncidenciasCentro";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  /** `expandido`: ficha a pantalla completa; `compacto`: panel lateral del mapa. */
  variant?: "compacto" | "expandido";
}

type FiltroLista = "abiertas" | "hoy" | "semana" | "mes" | "dia" | "historial";

type AccionIncidencia = "resolver" | "guardar" | "eliminar";

const LEYENDA_INCIDENCIAS = ETIQUETAS_INCIDENCIA.map((e) => ({
  color: e.color,
  label: e.label,
}));

/** Timestamp (ms) → "HH:MM" local. */
function formatearHora(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Badge con el color de la etiqueta de severidad. */
function BadgeSeveridad({ etiqueta }: { etiqueta: EtiquetaIncidencia }) {
  const meta = META_ETIQUETA[etiqueta];
  return (
    <Badge
      variant="outline"
      className="shrink-0 text-[10px]"
      style={{ borderColor: `${meta.color}66`, color: meta.color }}
    >
      {meta.label}
    </Badge>
  );
}

/** Campos compartidos del formulario de alta/edición. */
function CamposFormularioIncidencia({
  idSuffix,
  descripcion,
  onDescripcion,
  etiqueta,
  onEtiqueta,
  categorias,
  onAlternarCategoria,
  filasTexto = 3,
}: {
  idSuffix: string;
  descripcion: string;
  onDescripcion: (v: string) => void;
  etiqueta: EtiquetaIncidencia;
  onEtiqueta: (v: EtiquetaIncidencia) => void;
  categorias: CategoriaIncidencia[];
  onAlternarCategoria: (c: CategoriaIncidencia) => void;
  filasTexto?: number;
}) {
  return (
    <>
      <div>
        <Label htmlFor={`incidencia-desc-${idSuffix}`} className="text-[11px] text-muted-foreground">
          ¿Qué pasó?
        </Label>
        <Textarea
          id={`incidencia-desc-${idSuffix}`}
          className="mt-1"
          rows={filasTexto}
          value={descripcion}
          onChange={(e) => onDescripcion(e.target.value)}
          placeholder="Ej. se dañó la bomba de agua del tanque principal…"
        />
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Severidad</Label>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {ETIQUETAS_INCIDENCIA.map((e) => {
            const activa = etiqueta === e.valor;
            return (
              <button
                key={e.valor}
                type="button"
                onClick={() => onEtiqueta(e.valor)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                  !activa && "border-border text-muted-foreground hover:bg-muted/40",
                )}
                style={
                  activa
                    ? {
                        borderColor: e.color,
                        color: e.color,
                        background: `${e.color}1a`,
                      }
                    : undefined
                }
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">Categorías</Label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {CATEGORIAS_INCIDENCIA.map((c) => {
            const activa = categorias.includes(c.valor);
            return (
              <button
                key={c.valor}
                type="button"
                onClick={() => onAlternarCategoria(c.valor)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  activa
                    ? "border-primary/50 bg-primary/10 font-medium text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/40",
                )}
              >
                {c.icono} {c.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Tarjeta de una incidencia (abierta o resuelta). */
function TarjetaIncidencia({
  incidencia,
  puedeEditar,
  puedeEliminar,
  onGuardar,
  onEliminar,
  onResolver,
  accionEnCurso,
  grande,
}: {
  incidencia: Incidencia;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  onGuardar: (
    id: string,
    datos: {
      descripcion: string;
      etiqueta: EtiquetaIncidencia;
      categorias: CategoriaIncidencia[];
      reabrir?: boolean;
    },
  ) => Promise<void>;
  onEliminar: (id: string) => void;
  onResolver: (id: string) => void;
  accionEnCurso: { id: string; tipo: AccionIncidencia } | null;
  grande?: boolean;
}) {
  const resuelta = incidencia.estado === "resuelta";
  const procesando = accionEnCurso?.id === incidencia.id;
  const [editando, setEditando] = useState(false);
  const [descripcion, setDescripcion] = useState(incidencia.descripcion);
  const [etiqueta, setEtiqueta] = useState(incidencia.etiqueta);
  const [categorias, setCategorias] = useState(incidencia.categorias);
  const [reabrir, setReabrir] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  function abrirEdicion() {
    setDescripcion(incidencia.descripcion);
    setEtiqueta(incidencia.etiqueta);
    setCategorias(incidencia.categorias);
    setReabrir(false);
    setErrorEdit(null);
    setEditando(true);
  }

  function alternarCategoria(c: CategoriaIncidencia) {
    setCategorias((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function guardarEdicion() {
    if (!descripcion.trim()) {
      setErrorEdit("La descripción no puede quedar vacía.");
      return;
    }
    setErrorEdit(null);
    void (async () => {
      try {
        await onGuardar(incidencia.id, {
          descripcion: descripcion.trim(),
          etiqueta,
          categorias,
          reabrir: resuelta && reabrir,
        });
        setEditando(false);
      } catch (err) {
        setErrorEdit(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    })();
  }

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-border bg-card transition-colors",
          grande ? "px-4 py-3 shadow-sm" : "rounded-lg px-3 py-2",
          resuelta && "opacity-75",
          !resuelta &&
            incidencia.etiqueta === "urgente" &&
            "border-red-500/40 bg-red-500/5",
          !resuelta &&
            incidencia.etiqueta === "importante" &&
            "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <BadgeSeveridad etiqueta={incidencia.etiqueta} />
              {incidencia.estado === "abierta" && (
                <Badge variant="secondary" className="text-[9px]">
                  Abierta
                </Badge>
              )}
              {resuelta && (
                <Badge variant="outline" className="border-emerald-500/40 text-[9px] text-emerald-500">
                  Resuelta
                </Badge>
              )}
              {incidencia.categorias.map((c) => (
                <span
                  key={c}
                  className="rounded bg-muted px-1.5 py-px text-[9px] font-medium text-muted-foreground"
                >
                  {CATEGORIA_LABEL[c]}
                </span>
              ))}
            </div>
            <p
              className={cn(
                "whitespace-pre-wrap leading-snug text-foreground",
                grande ? "text-sm" : "text-xs",
              )}
            >
              {incidencia.descripcion}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatearDiaCalendario(incidencia.dia)}
              {incidencia.ts > 0 && <> · {formatearHora(incidencia.ts)}</>}
              {incidencia.creada_por && <> · {incidencia.creada_por}</>}
              {resuelta && (
                <span className="text-emerald-500">
                  {" "}
                  · resuelta
                  {incidencia.resuelta_por ? ` por ${incidencia.resuelta_por}` : ""}
                  {incidencia.resuelta_ts
                    ? ` (${formatearDiaCalendario(claveDia(incidencia.resuelta_ts))})`
                    : ""}
                </span>
              )}
            </p>
          </div>

          {(puedeEditar || puedeEliminar) && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {puedeEditar && (
                <Button
                  type="button"
                  size={grande ? "sm" : "xs"}
                  variant="outline"
                  className="shrink-0"
                  disabled={procesando}
                  onClick={abrirEdicion}
                >
                  <Pencil className="size-3" />
                  Editar
                </Button>
              )}
              {puedeEliminar && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size={grande ? "sm" : "xs"}
                      variant="outline"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={procesando}
                    >
                      {procesando && accionEnCurso?.tipo === "eliminar" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" />
                      )}
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar incidencia?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se borrará de forma permanente. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => onEliminar(incidencia.id)}
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {!resuelta && puedeEditar && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size={grande ? "sm" : "xs"}
                      variant="secondary"
                      className="shrink-0"
                      disabled={procesando}
                    >
                      {procesando && accionEnCurso?.tipo === "resolver" ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      Resolver
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Marcar como resuelta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        La incidencia quedará cerrada con tu usuario y la hora actual. Seguirá
                        visible en el historial y el calendario.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onResolver(incidencia.id)}>
                        Resolver
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar incidencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CamposFormularioIncidencia
              idSuffix={`edit-${incidencia.id}`}
              descripcion={descripcion}
              onDescripcion={setDescripcion}
              etiqueta={etiqueta}
              onEtiqueta={setEtiqueta}
              categorias={categorias}
              onAlternarCategoria={alternarCategoria}
              filasTexto={4}
            />
            {resuelta && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={reabrir}
                  onChange={(e) => setReabrir(e.target.checked)}
                  className="rounded border-border"
                />
                Reabrir incidencia (volver a estado abierta)
              </label>
            )}
            {errorEdit && <p className="text-[11px] text-destructive">{errorEdit}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={procesando && accionEnCurso?.tipo === "guardar"}
              onClick={guardarEdicion}
            >
              {procesando && accionEnCurso?.tipo === "guardar" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Alta rápida de una incidencia. */
function AltaIncidencia({
  centroId,
  siempreVisible,
  onRegistrada,
}: {
  centroId: string;
  siempreVisible?: boolean;
  onRegistrada?: () => void;
}) {
  const [abierto, setAbierto] = useState(siempreVisible ?? false);
  const [descripcion, setDescripcion] = useState("");
  const [etiqueta, setEtiqueta] = useState<EtiquetaIncidencia>("cotidiana");
  const [categorias, setCategorias] = useState<CategoriaIncidencia[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarCategoria(c: CategoriaIncidencia) {
    setCategorias((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function registrar() {
    if (!descripcion.trim()) {
      setError("Describe la incidencia antes de registrarla.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await crearIncidencia({
        centro_id: centroId,
        descripcion: descripcion.trim(),
        etiqueta,
        categorias,
      });
      setDescripcion("");
      setEtiqueta("cotidiana");
      setCategorias([]);
      if (!siempreVisible) setAbierto(false);
      onRegistrada?.();
    } catch (err) {
      console.error("[IncidenciasCentro] error creando incidencia:", err);
      setError(err instanceof Error ? err.message : "No se pudo registrar la incidencia.");
    } finally {
      setGuardando(false);
    }
  }

  const formulario = (
    <div className="space-y-3">
      <CamposFormularioIncidencia
        idSuffix={centroId}
        descripcion={descripcion}
        onDescripcion={setDescripcion}
        etiqueta={etiqueta}
        onEtiqueta={setEtiqueta}
        categorias={categorias}
        onAlternarCategoria={alternarCategoria}
        filasTexto={siempreVisible ? 4 : 3}
      />

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <Button
        type="button"
        size={siempreVisible ? "default" : "sm"}
        className="w-full"
        disabled={guardando}
        onClick={() => void registrar()}
      >
        {guardando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Registrar incidencia
      </Button>
    </div>
  );

  if (siempreVisible) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="size-4 text-primary" />
            Nueva incidencia
          </CardTitle>
        </CardHeader>
        <CardContent>{formulario}</CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-3.5" />
            Registrar incidencia
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
        {formulario}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Vista expandida: gráfico + calendario plegable + lista a ancho completo. */
function IncidenciasExpandido({
  centro,
  puedeEditar,
  incidencias,
  abiertas,
  puedeEditarInc,
  puedeEliminar,
  onGuardar,
  onEliminar,
  onResolver,
  accionEnCurso,
}: {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  incidencias: Incidencia[];
  abiertas: Incidencia[];
  puedeEditarInc: (i: Incidencia) => boolean;
  puedeEliminar: boolean;
  onGuardar: (
    id: string,
    datos: {
      descripcion: string;
      etiqueta: EtiquetaIncidencia;
      categorias: CategoriaIncidencia[];
      reabrir?: boolean;
    },
  ) => Promise<void>;
  onEliminar: (id: string) => void;
  onResolver: (id: string) => void;
  accionEnCurso: { id: string; tipo: AccionIncidencia } | null;
}) {
  const hoyClave = claveDia(Date.now());
  const contadores = useMemo(
    () => contadoresIncidenciasPorPeriodo(incidencias, hoyClave),
    [incidencias, hoyClave],
  );
  const porDia = useMemo(() => agruparIncidenciasPorDia(incidencias), [incidencias]);

  const [filtro, setFiltro] = useState<FiltroLista>(
    abiertas.length > 0 ? "abiertas" : "hoy",
  );
  const [diaSel, setDiaSel] = useState<string | null>(hoyClave);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);

  const marcasPorDia = useMemo(() => {
    const sev = severidadMaximaPorDia(incidencias);
    const m = new Map<string, string>();
    for (const [dia, et] of sev) m.set(dia, META_ETIQUETA[et].color);
    return m;
  }, [incidencias]);

  const { anio: hy, mes: hm } = parsearDiaIncidencia(hoyClave);
  const semInicio = (contadores.semanaDelMes - 1) * 7 + 1;
  const semFin = Math.min(contadores.semanaDelMes * 7, new Date(hy, hm, 0).getDate());

  const lista = useMemo(() => {
    switch (filtro) {
      case "abiertas":
        return abiertas;
      case "hoy":
        return porDia.get(hoyClave) ?? [];
      case "semana":
        return incidencias
          .filter((i) => {
            const p = parsearDiaIncidencia(i.dia);
            return (
              p.anio === hy &&
              p.mes === hm &&
              p.dia >= semInicio &&
              p.dia <= semFin
            );
          })
          .sort((a, b) => compararSeveridad(a.etiqueta, b.etiqueta) || b.ts - a.ts);
      case "mes":
        return incidencias
          .filter((i) => {
            const p = parsearDiaIncidencia(i.dia);
            return p.anio === hy && p.mes === hm;
          })
          .sort((a, b) => b.dia.localeCompare(a.dia) || compararSeveridad(a.etiqueta, b.etiqueta));
      case "dia":
        return diaSel ? (porDia.get(diaSel) ?? []) : [];
      case "historial":
        return [...incidencias].sort((a, b) => b.ts - a.ts).slice(0, 50);
      default:
        return [];
    }
  }, [filtro, abiertas, porDia, hoyClave, incidencias, hy, hm, semInicio, semFin, diaSel]);

  function seleccionarFiltro(f: FiltroLista, dia?: string | null) {
    setFiltro(f);
    if (f === "dia" && dia) setDiaSel(dia);
    if (f === "hoy") setDiaSel(hoyClave);
  }

  function tituloLista(): string {
    switch (filtro) {
      case "abiertas":
        return `Requieren atención (${lista.length})`;
      case "hoy":
        return `Hoy · ${formatearDiaCalendario(hoyClave)} (${lista.length})`;
      case "semana":
        return `Semana ${contadores.semanaDelMes} · ${contadores.mesLabel} (${lista.length})`;
      case "mes":
        return `${contadores.mesLabel} (${lista.length})`;
      case "dia":
        return diaSel
          ? `Día ${formatearDiaCalendario(diaSel)} (${lista.length})`
          : "Selecciona un día en el calendario";
      case "historial":
        return `Historial reciente (${lista.length})`;
    }
  }

  const hayUrgente = contadores.urgentesAbiertas > 0;

  const diaMarcado = useMemo(() => {
    if (filtro === "dia" && diaSel) return diaSel;
    if (filtro === "hoy") return hoyClave;
    return null;
  }, [filtro, diaSel, hoyClave]);

  return (
    <div className="space-y-4">
      {/* Encabezado operativo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Siren className={cn("size-5", hayUrgente ? "text-red-500" : "text-amber-500")} />
            Supervisión de incidencias
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Registra, edita, resuelve o elimina novedades de este campamento.
          </p>
        </div>
        {contadores.abiertas > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              hayUrgente ? "border-red-500/50 text-red-400" : "border-amber-500/50 text-amber-500",
            )}
          >
            {contadores.abiertas} abierta{contadores.abiertas === 1 ? "" : "s"}
            {hayUrgente && ` · ${contadores.urgentesAbiertas} urgente${contadores.urgentesAbiertas === 1 ? "" : "s"}`}
          </Badge>
        )}
      </div>

      {/* Fila 1: gráfico + calendario plegable */}
      <div className="flex items-stretch gap-2">
        {calendarioAbierto && (
          <div className="w-[11.5rem] shrink-0 sm:w-[12.5rem]">
            <CalendarioSelectorDia
              titulo="Calendario"
              diaSeleccionado={filtro === "dia" || filtro === "hoy" ? diaSel : null}
              onSeleccionarDia={(dia) => {
                if (dia) seleccionarFiltro("dia", dia);
                else if (filtro === "dia") seleccionarFiltro("abiertas");
              }}
              marcasPorDia={marcasPorDia}
              leyenda={LEYENDA_INCIDENCIAS}
              onCerrar={() => setCalendarioAbierto(false)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <GraficoIncidenciasCentro
            incidencias={incidencias}
            diaMarcado={diaMarcado}
            abiertas={contadores.abiertas}
            accionCalendario={
              <Button
                type="button"
                size="xs"
                variant={calendarioAbierto ? "secondary" : "outline"}
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={() => setCalendarioAbierto((v) => !v)}
              >
                {calendarioAbierto ? (
                  <PanelLeftClose className="size-3" />
                ) : (
                  <PanelLeftOpen className="size-3" />
                )}
                <CalendarDays className="size-3" />
                {diaMarcado ? formatearDiaCalendario(diaMarcado) : "Fecha"}
              </Button>
            }
          />
        </div>
      </div>

      {/* Fila 2: registro + lista a ancho completo */}
      <div className="space-y-4">
        {puedeEditar && (
          <AltaIncidencia
            centroId={centro.id}
            siempreVisible
            onRegistrada={() => seleccionarFiltro("abiertas")}
          />
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{tituloLista()}</h4>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="xs"
                variant={filtro === "abiertas" ? "secondary" : "outline"}
                onClick={() => seleccionarFiltro("abiertas")}
              >
                <AlertTriangle className="size-3" />
                Abiertas
              </Button>
              <Button
                type="button"
                size="xs"
                variant={filtro === "historial" ? "secondary" : "outline"}
                onClick={() => seleccionarFiltro("historial")}
              >
                <Clock className="size-3" />
                Historial
              </Button>
            </div>
          </div>

          {lista.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {filtro === "abiertas"
                  ? "Sin incidencias abiertas — buen trabajo."
                  : "No hay incidencias en este periodo."}
              </p>
              {filtro !== "abiertas" && contadores.abiertas > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => seleccionarFiltro("abiertas")}
                >
                  Ver {contadores.abiertas} abierta{contadores.abiertas === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {lista.map((i) => (
                <TarjetaIncidencia
                  key={i.id}
                  incidencia={i}
                  grande
                  puedeEditar={puedeEditarInc(i)}
                  puedeEliminar={puedeEliminar}
                  onGuardar={onGuardar}
                  onEliminar={onEliminar}
                  onResolver={onResolver}
                  accionEnCurso={accionEnCurso}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Vista compacta para el panel lateral del mapa. */
function IncidenciasCompacto({
  centro,
  puedeEditar,
  incidencias,
  abiertas,
  puedeEditarInc,
  puedeEliminar,
  onGuardar,
  onEliminar,
  onResolver,
  accionEnCurso,
}: {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  incidencias: Incidencia[];
  abiertas: Incidencia[];
  puedeEditarInc: (i: Incidencia) => boolean;
  puedeEliminar: boolean;
  onGuardar: (
    id: string,
    datos: {
      descripcion: string;
      etiqueta: EtiquetaIncidencia;
      categorias: CategoriaIncidencia[];
      reabrir?: boolean;
    },
  ) => Promise<void>;
  onEliminar: (id: string) => void;
  onResolver: (id: string) => void;
  accionEnCurso: { id: string; tipo: AccionIncidencia } | null;
}) {
  const resueltas = useMemo(
    () =>
      incidencias
        .filter((i) => i.estado === "resuelta")
        .sort((a, b) => (b.resuelta_ts ?? 0) - (a.resuelta_ts ?? 0))
        .slice(0, 10),
    [incidencias],
  );
  const hayUrgente = abiertas.some((i) => i.etiqueta === "urgente");
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const porDia = useMemo(() => agruparIncidenciasPorDia(incidencias), [incidencias]);
  const delDia = diaSel ? (porDia.get(diaSel) ?? []) : [];
  const marcasPorDia = useMemo(() => {
    const sev = severidadMaximaPorDia(incidencias);
    const m = new Map<string, string>();
    for (const [dia, et] of sev) m.set(dia, META_ETIQUETA[et].color);
    return m;
  }, [incidencias]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <TriangleAlert
            className={cn("size-3.5", hayUrgente ? "text-red-500" : "text-amber-500")}
          />
          Incidencias
        </p>
        {abiertas.length > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              hayUrgente ? "border-red-500/40 text-red-400" : "border-amber-500/40 text-amber-500",
            )}
          >
            {abiertas.length} abierta{abiertas.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="mt-2 space-y-2">
        {puedeEditar && <AltaIncidencia centroId={centro.id} />}

        {abiertas.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Sin incidencias abiertas en este campamento.
          </p>
        ) : (
          abiertas.map((i) => (
            <TarjetaIncidencia
              key={i.id}
              incidencia={i}
              puedeEditar={puedeEditarInc(i)}
              puedeEliminar={puedeEliminar}
              onGuardar={onGuardar}
              onEliminar={onEliminar}
              onResolver={onResolver}
              accionEnCurso={accionEnCurso}
            />
          ))
        )}

        {resueltas.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Resueltas recientes ({resueltas.length})
                <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {resueltas.map((i) => (
                <TarjetaIncidencia
                  key={i.id}
                  incidencia={i}
                  puedeEditar={puedeEditarInc(i)}
                  puedeEliminar={puedeEliminar}
                  onGuardar={onGuardar}
                  onEliminar={onEliminar}
                  onResolver={onResolver}
                  accionEnCurso={accionEnCurso}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Calendario de incidencias
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            <CalendarioSelectorDia
              diaSeleccionado={diaSel}
              onSeleccionarDia={setDiaSel}
              marcasPorDia={marcasPorDia}
              leyenda={LEYENDA_INCIDENCIAS}
            />
            {diaSel && (
              <div className="space-y-2">
                {delDia.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Sin incidencias ese día.</p>
                ) : (
                  delDia.map((i) => (
                    <TarjetaIncidencia
                      key={i.id}
                      incidencia={i}
                      puedeEditar={puedeEditarInc(i)}
                      puedeEliminar={puedeEliminar}
                      onGuardar={onGuardar}
                      onEliminar={onEliminar}
                      onResolver={onResolver}
                      accionEnCurso={accionEnCurso}
                    />
                  ))
                )}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

/** Sección completa de incidencias del campamento. */
export function SeccionIncidenciasCentro({
  centro,
  puedeEditar,
  variant = "compacto",
}: Props) {
  const sesion = useSesion();
  const incidencias = useIncidencias({ centroId: centro.id });
  const abiertas = useMemo(() => incidenciasAbiertas(incidencias), [incidencias]);
  const puedeEditarInc = (i: Incidencia) =>
    puedeEditar && sesion != null && puedeResolverIncidencia(sesion.user, i);
  const puedeEliminar =
    sesion != null && puedeEliminarIncidencia(sesion.user);
  const [accionEnCurso, setAccionEnCurso] = useState<{
    id: string;
    tipo: AccionIncidencia;
  } | null>(null);

  async function resolver(id: string) {
    setAccionEnCurso({ id, tipo: "resolver" });
    try {
      await resolverIncidencia(id);
    } catch (err) {
      console.error("[IncidenciasCentro] error resolviendo incidencia:", err);
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function guardar(
    id: string,
    datos: {
      descripcion: string;
      etiqueta: EtiquetaIncidencia;
      categorias: CategoriaIncidencia[];
      reabrir?: boolean;
    },
  ) {
    setAccionEnCurso({ id, tipo: "guardar" });
    try {
      await actualizarIncidencia(id, {
        descripcion: datos.descripcion,
        etiqueta: datos.etiqueta,
        categorias: datos.categorias,
        ...(datos.reabrir ? { estado: "abierta" as const } : {}),
      });
    } catch (err) {
      console.error("[IncidenciasCentro] error actualizando incidencia:", err);
      throw err;
    } finally {
      setAccionEnCurso(null);
    }
  }

  async function eliminar(id: string) {
    setAccionEnCurso({ id, tipo: "eliminar" });
    try {
      await eliminarIncidencia(id);
    } catch (err) {
      console.error("[IncidenciasCentro] error eliminando incidencia:", err);
    } finally {
      setAccionEnCurso(null);
    }
  }

  const propsComunes = {
    centro,
    puedeEditar,
    incidencias,
    abiertas,
    puedeEditarInc,
    puedeEliminar,
    onGuardar: guardar,
    onEliminar: (id: string) => void eliminar(id),
    onResolver: (id: string) => void resolver(id),
    accionEnCurso,
  };

  if (variant === "expandido") {
    return <IncidenciasExpandido {...propsComunes} />;
  }

  return <IncidenciasCompacto {...propsComunes} />;
}
