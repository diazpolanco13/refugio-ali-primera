// Sección de INCIDENCIAS de un centro: alta rápida (descripción + etiqueta de
// severidad + categorías), lista de incidencias abiertas con botón "Resolver",
// resueltas recientes (colapsable) y calendario mensual con un punto del color
// de la severidad máxima de cada día (clic en un día → incidencias de ese día).
// Se consume igual que las demás `Seccion*Centro` de `DetalleCentro.tsx`.

import { useMemo, useState } from "react";
import { es } from "date-fns/locale";
import type { DayButton } from "react-day-picker";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useIncidencias } from "@/data/useIncidencias";
import { crearIncidencia, resolverIncidencia } from "@/data/reposReportes";
import { claveDia } from "@/data/reposSupabase";
import { useSesion } from "@/data/authSupabase";
import { puedeResolverIncidencia } from "@/domain/permisos";
import {
  CATEGORIAS_INCIDENCIA,
  CATEGORIA_LABEL,
  ETIQUETAS_INCIDENCIA,
  META_ETIQUETA,
  agruparIncidenciasPorDia,
  incidenciasAbiertas,
  severidadMaximaPorDia,
  type CategoriaIncidencia,
  type EtiquetaIncidencia,
  type Incidencia,
} from "@/domain/incidencias";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
}

/** "YYYY-MM-DD" → "DD-MM" para mostrar fechas compactas. */
function formatearDia(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}-${m}`;
}

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

/** Tarjeta de una incidencia (abierta o resuelta). */
function TarjetaIncidencia({
  incidencia,
  puedeResolver,
  onResolver,
  resolviendo,
}: {
  incidencia: Incidencia;
  puedeResolver: boolean;
  onResolver: (id: string) => void;
  resolviendo: boolean;
}) {
  const resuelta = incidencia.estado === "resuelta";
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-2",
        resuelta && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <BadgeSeveridad etiqueta={incidencia.etiqueta} />
            {incidencia.categorias.map((c) => (
              <span
                key={c}
                className="rounded bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground"
              >
                {CATEGORIA_LABEL[c]}
              </span>
            ))}
          </div>
          <p className="whitespace-pre-wrap text-xs leading-snug text-foreground">
            {incidencia.descripcion}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatearDia(incidencia.dia)}
            {incidencia.ts > 0 && <> · {formatearHora(incidencia.ts)}</>}
            {incidencia.updated_by && <> · {incidencia.updated_by}</>}
            {resuelta && (
              <span className="text-emerald-500">
                {" "}
                · resuelta{incidencia.resuelta_por ? ` por ${incidencia.resuelta_por}` : ""}
                {incidencia.resuelta_ts ? ` (${formatearDia(claveDia(incidencia.resuelta_ts))})` : ""}
              </span>
            )}
          </p>
        </div>
        {!resuelta && puedeResolver && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="xs"
                variant="secondary"
                className="shrink-0"
                disabled={resolviendo}
              >
                {resolviendo ? (
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
    </div>
  );
}

/** Alta rápida de una incidencia (descripción + etiqueta + categorías). */
function AltaIncidencia({ centroId }: { centroId: string }) {
  const [abierto, setAbierto] = useState(false);
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
      setAbierto(false);
    } catch (err) {
      console.error("[IncidenciasCentro] error creando incidencia:", err);
      setError(err instanceof Error ? err.message : "No se pudo registrar la incidencia.");
    } finally {
      setGuardando(false);
    }
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
      <CollapsibleContent className="mt-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <Label htmlFor={`incidencia-desc-${centroId}`} className="text-[11px] text-muted-foreground">
            ¿Qué pasó?
          </Label>
          <Textarea
            id={`incidencia-desc-${centroId}`}
            className="mt-1"
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
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
                  onClick={() => setEtiqueta(e.valor)}
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
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
                  onClick={() => alternarCategoria(c.valor)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
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

        {error && <p className="text-[11px] text-destructive">{error}</p>}

        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={guardando}
          onClick={() => void registrar()}
        >
          {guardando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Registrar incidencia
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Calendario mensual con punto de color por severidad máxima de cada día. */
function CalendarioIncidencias({
  incidencias,
  puedeResolver,
  onResolver,
  resolviendoId,
}: {
  incidencias: Incidencia[];
  /** Permiso por incidencia: el operador solo resuelve las que él abrió. */
  puedeResolver: (incidencia: Incidencia) => boolean;
  onResolver: (id: string) => void;
  resolviendoId: string | null;
}) {
  const [diaSel, setDiaSel] = useState<Date | undefined>();
  const sevPorDia = useMemo(() => severidadMaximaPorDia(incidencias), [incidencias]);
  const porDia = useMemo(() => agruparIncidenciasPorDia(incidencias), [incidencias]);

  const claveSel = diaSel ? claveDia(diaSel.getTime()) : null;
  const delDia = claveSel ? porDia.get(claveSel) ?? [] : [];

  return (
    <div className="space-y-2">
      <div className="flex justify-center rounded-lg border border-border bg-muted/30">
        <Calendar
          mode="single"
          selected={diaSel}
          onSelect={setDiaSel}
          locale={es}
          components={{
            // Punto del color de la severidad máxima del día bajo el número.
            DayButton: ({ children, ...props }: React.ComponentProps<typeof DayButton>) => {
              const sev = sevPorDia.get(claveDia(props.day.date.getTime()));
              return (
                <CalendarDayButton {...props}>
                  {children}
                  {sev && (
                    <span
                      aria-hidden
                      className="absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
                      style={{ background: META_ETIQUETA[sev].color }}
                    />
                  )}
                </CalendarDayButton>
              );
            },
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {ETIQUETAS_INCIDENCIA.map((e) => (
          <span key={e.valor} className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: e.color }} />
            {e.label}
          </span>
        ))}
      </div>

      {claveSel && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-foreground">
            Incidencias del {formatearDia(claveSel)}
            {delDia.length > 0 && ` (${delDia.length})`}
          </p>
          {delDia.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Sin incidencias ese día.</p>
          ) : (
            delDia.map((i) => (
              <TarjetaIncidencia
                key={i.id}
                incidencia={i}
                puedeResolver={puedeResolver(i)}
                onResolver={onResolver}
                resolviendo={resolviendoId === i.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Sección completa de incidencias del centro (alta, abiertas, calendario). */
export function SeccionIncidenciasCentro({ centro, puedeEditar }: Props) {
  const sesion = useSesion();
  const incidencias = useIncidencias({ centroId: centro.id });
  const abiertas = useMemo(() => incidenciasAbiertas(incidencias), [incidencias]);

  /** Permiso por incidencia: el operador solo resuelve las que él abrió. */
  const puedeResolver = (i: Incidencia) =>
    puedeEditar && sesion != null && puedeResolverIncidencia(sesion.user, i);
  const resueltas = useMemo(
    () =>
      incidencias
        .filter((i) => i.estado === "resuelta")
        .sort((a, b) => (b.resuelta_ts ?? 0) - (a.resuelta_ts ?? 0))
        .slice(0, 10),
    [incidencias],
  );
  const hayUrgente = abiertas.some((i) => i.etiqueta === "urgente");
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);

  async function resolver(id: string) {
    setResolviendoId(id);
    try {
      await resolverIncidencia(id);
    } catch (err) {
      console.error("[IncidenciasCentro] error resolviendo incidencia:", err);
    } finally {
      setResolviendoId(null);
    }
  }

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
              hayUrgente
                ? "border-red-500/40 text-red-400"
                : "border-amber-500/40 text-amber-500",
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
            Sin incidencias abiertas en este centro.
          </p>
        ) : (
          abiertas.map((i) => (
            <TarjetaIncidencia
              key={i.id}
              incidencia={i}
              puedeResolver={puedeResolver(i)}
              onResolver={(id) => void resolver(id)}
              resolviendo={resolviendoId === i.id}
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
                  puedeResolver={false}
                  onResolver={() => {}}
                  resolviendo={false}
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
          <CollapsibleContent className="mt-2">
            <CalendarioIncidencias
              incidencias={incidencias}
              puedeResolver={puedeResolver}
              onResolver={(id) => void resolver(id)}
              resolviendoId={resolviendoId}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
