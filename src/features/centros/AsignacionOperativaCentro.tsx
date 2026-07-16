// Asignación operativa del campamento: cuerpo → unidad de supervisión → revista → analistas SAE.
// Fuente de verdad: `cuerpo` + `supervision.{unidad_sebin,supervisor_sebin,analistas_sae}`.

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSesion } from "@/data/authSupabase";
import { esAnalistaDeCuerpo } from "@/domain/permisos";
import { guardarCentro } from "@/data/reposSupabase";
import {
  etiquetaAnalistaSae,
  useAnalistasSae,
} from "@/data/useAnalistasSae";
import { useSupervisoresSebin } from "@/data/useSupervisoresSebin";
import { useCatalogoCuerposActivos } from "@/data/useCuerposPoliciales";
import { useCatalogoUnidadesPorCuerpo } from "@/data/useUnidadesSebin";
import {
  META_CUERPO,
  normalizarCentro,
  normalizarCuerpo,
  normalizarSupervision,
  normalizarUnidadSebin,
  type CentroTransitorio,
  type ClaveCuerpo,
  type ClaveUnidadSebin,
  type SupervisionCentro,
} from "@/domain/centrosTransitorios";
import {
  SelectorAsignacionBusqueda,
  type OpcionAsignacion,
} from "@/components/SelectorAsignacionBusqueda";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function CampoCompacto({
  n,
  label,
  children,
  className,
}: {
  n: number;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-[11px] font-medium leading-none text-muted-foreground">
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded bg-teal-950/70 text-[9px] font-semibold tabular-nums text-teal-300 ring-1 ring-teal-500/25"
          aria-hidden
        >
          {n}
        </span>
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Campos controlados de asignación operativa (alta o edición embebida). */
export function AsignacionOperativaCampos({
  cuerpo,
  supervision,
  onCuerpoChange,
  onSupervisionChange,
  disabled,
}: {
  cuerpo: string;
  supervision: SupervisionCentro;
  onCuerpoChange: (cuerpo: string) => void;
  onSupervisionChange: (patch: Partial<SupervisionCentro>) => void;
  disabled?: boolean;
}) {
  const catalogoCuerpos = useCatalogoCuerposActivos();
  const sesion = useSesion();
  // El analista con ámbito de cuerpo solo asigna campamentos a su propio
  // cuerpo (la RLS `centros_insert` rechaza unidades de otros cuerpos).
  const cuerpoFijo =
    sesion && esAnalistaDeCuerpo(sesion.user)
      ? (sesion.user.cuerpo_asignado ?? null)
      : null;
  const claveCuerpo = normalizarCuerpo(cuerpo);
  const catalogoUnidades = useCatalogoUnidadesPorCuerpo(
    claveCuerpo === "sin_asignar" ? null : claveCuerpo,
  );
  const { supervisores, cargando: cargandoSupervisores } = useSupervisoresSebin();
  const analistasSae = useAnalistasSae();
  const supervisionN = normalizarSupervision(supervision);

  const opcionesCuerpo: OpcionAsignacion[] = useMemo(
    () =>
      catalogoCuerpos
        .filter((c) => c.clave !== "sin_asignar")
        .filter((c) => !cuerpoFijo || c.clave === cuerpoFijo)
        .map((c) => ({
          valor: c.clave,
          etiqueta: c.label,
        })),
    [catalogoCuerpos, cuerpoFijo],
  );

  // Autoasigna el cuerpo del analista en el alta (y corrige derivas: un
  // campamento suyo nunca puede quedar apuntando a otro cuerpo desde su
  // sesión). `onCuerpoChange` del form ya limpia la unidad al cambiar.
  const labelCuerpoFijo = cuerpoFijo
    ? (catalogoCuerpos.find((c) => c.clave === cuerpoFijo)?.label ?? null)
    : null;
  useEffect(() => {
    if (disabled || !cuerpoFijo || !labelCuerpoFijo) return;
    if (claveCuerpo !== cuerpoFijo) onCuerpoChange(labelCuerpoFijo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, cuerpoFijo, labelCuerpoFijo, claveCuerpo]);

  const opcionesUnidad: OpcionAsignacion[] = useMemo(
    () =>
      catalogoUnidades
        .filter((u) => u.clave !== "sin_asignar")
        .map((u) => ({
          valor: u.clave,
          etiqueta: u.label,
          indicador: (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: u.color }}
              aria-hidden
            />
          ),
        })),
    [catalogoUnidades],
  );

  const opcionesSupervisor: OpcionAsignacion[] = useMemo(() => {
    const lista = supervisores.map((s) => ({
      valor: s.nombre,
      etiqueta: s.nombre,
    }));
    const actual = supervisionN.supervisor_sebin.trim();
    if (
      actual &&
      !lista.some((o) => o.valor === actual || o.etiqueta === actual)
    ) {
      lista.unshift({ valor: actual, etiqueta: `${actual} (actual)` });
    }
    return lista;
  }, [supervisores, supervisionN.supervisor_sebin]);

  const opcionesAnalistas: OpcionAsignacion[] = useMemo(
    () =>
      analistasSae.map((a) => ({
        valor: a.user_id,
        etiqueta: etiquetaAnalistaSae(a),
      })),
    [analistasSae],
  );

  const claveUnidad = normalizarUnidadSebin(supervisionN.unidad_sebin);
  const unidadPerteneceAlCuerpo = useMemo(() => {
    if (claveUnidad === "sin_asignar") return true;
    return catalogoUnidades.some((u) => u.clave === claveUnidad);
  }, [catalogoUnidades, claveUnidad]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/15">
      <div className="flex items-baseline justify-between gap-2 border-b border-border/70 px-3 py-1.5">
        <p className="text-xs font-semibold text-foreground">Asignación operativa</p>
        <p className="truncate text-[10px] text-muted-foreground">
          Cuerpo → unidad → revista → analista
        </p>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <CampoCompacto n={1} label="Cuerpo policial">
          <SelectorAsignacionBusqueda
            modo="unico"
            opciones={opcionesCuerpo}
            seleccion={claveCuerpo === "sin_asignar" ? [] : [claveCuerpo]}
            disabled={disabled || Boolean(cuerpoFijo)}
            placeholder="Cuerpo"
            buscarPlaceholder="Buscar cuerpo…"
            onCambiar={(vals) => {
              const clave = (vals[0] ?? "sin_asignar") as ClaveCuerpo;
              const meta = META_CUERPO[clave];
              onCuerpoChange(clave === "sin_asignar" ? "" : meta?.label ?? "");
            }}
          />
        </CampoCompacto>

        <CampoCompacto n={2} label="Unidad de supervisión">
          <SelectorAsignacionBusqueda
            modo="unico"
            opciones={opcionesUnidad}
            seleccion={
              claveUnidad === "sin_asignar" || !unidadPerteneceAlCuerpo
                ? []
                : [claveUnidad]
            }
            disabled={disabled || claveCuerpo === "sin_asignar"}
            placeholder={
              claveCuerpo === "sin_asignar" ? "Elegí cuerpo primero" : "Unidad"
            }
            buscarPlaceholder="Buscar unidad…"
            vacioMensaje="Sin unidades para este cuerpo."
            onCambiar={(vals) => {
              const clave = (vals[0] ?? "sin_asignar") as ClaveUnidadSebin;
              const meta = catalogoUnidades.find((u) => u.clave === clave);
              onSupervisionChange({ unidad_sebin: meta?.valorDb ?? "" });
            }}
          />
        </CampoCompacto>

        <CampoCompacto n={3} label="Funcionario SEBIN (revista)">
          <SelectorAsignacionBusqueda
            modo="unico"
            opciones={opcionesSupervisor}
            seleccion={
              supervisionN.supervisor_sebin.trim()
                ? [supervisionN.supervisor_sebin.trim()]
                : []
            }
            disabled={disabled || cargandoSupervisores}
            placeholder="Revista"
            buscarPlaceholder={
              cargandoSupervisores ? "Cargando…" : "Buscar funcionario…"
            }
            vacioMensaje="Sin supervisores."
            onCambiar={(vals) => {
              onSupervisionChange({ supervisor_sebin: vals[0] ?? "" });
            }}
          />
        </CampoCompacto>

        <CampoCompacto n={4} label="Analista">
          <SelectorAsignacionBusqueda
            modo="multiple"
            opciones={opcionesAnalistas}
            seleccion={supervisionN.analistas_sae}
            disabled={disabled}
            placeholder="Analistas"
            buscarPlaceholder="Buscar analista…"
            vacioMensaje="Sin analistas."
            mostrarChips
            onCambiar={(vals) => onSupervisionChange({ analistas_sae: vals })}
          />
        </CampoCompacto>
      </div>
    </div>
  );
}

/** Cuántos ítems de asignación operativa están rellenos (badge de pestaña). */
export function contarAsignacionOperativa(centro: CentroTransitorio): number {
  const s = normalizarSupervision(centro.supervision);
  let n = 0;
  if (normalizarCuerpo(centro.cuerpo ?? "") !== "sin_asignar") n += 1;
  if (s.unidad_sebin.trim()) n += 1;
  if (s.supervisor_sebin.trim()) n += 1;
  n += s.analistas_sae.length;
  return n;
}

interface PropsPanel {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onActualizado?: (centro: CentroTransitorio) => void;
}

/** Panel Coordinación → Supervisión: persiste al instante `cuerpo` + `supervision.*`. */
export function AsignacionOperativaCentro({
  centro,
  puedeEditar,
  onActualizado,
}: PropsPanel) {
  const [centroLocal, setCentroLocal] = useState(centro);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCentroLocal((prev) => {
      if (centro.id !== prev.id) return centro;
      if ((centro.updated_at ?? 0) >= (prev.updated_at ?? 0)) return centro;
      return prev;
    });
  }, [centro]);

  const c = normalizarCentro(centroLocal);
  const supervision = c.supervision;

  async function persistir(patch: {
    cuerpo?: string;
    supervision?: SupervisionCentro;
  }) {
    setError(null);
    setGuardando(true);
    const siguiente: CentroTransitorio = {
      ...centroLocal,
      cuerpo: patch.cuerpo ?? centroLocal.cuerpo,
      supervision: patch.supervision ?? centroLocal.supervision,
      updated_at: Date.now(),
    };
    setCentroLocal(siguiente);
    try {
      await guardarCentro(siguiente);
      onActualizado?.(siguiente);
    } catch (err) {
      console.error("[AsignacionOperativaCentro] error guardando:", err);
      setCentroLocal(centro);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la asignación operativa.",
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <AsignacionOperativaCampos
        cuerpo={c.cuerpo ?? ""}
        supervision={supervision}
        disabled={!puedeEditar || guardando}
        onCuerpoChange={(cuerpo) =>
          void persistir({
            cuerpo,
            supervision: normalizarSupervision({
              ...supervision,
              unidad_sebin: "",
            }),
          })
        }
        onSupervisionChange={(patch) =>
          void persistir({
            supervision: normalizarSupervision({ ...supervision, ...patch }),
          })
        }
      />
      {guardando && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Loader2 className="size-2.5 animate-spin" />
          Guardando…
        </p>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
