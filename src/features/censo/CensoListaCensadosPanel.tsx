// Lista de personas censadas (nominal) en el campamento.
// Dos pestañas: damnificados individuales y familias damnificadas (jefes expandibles).

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Loader2,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import {
  listarIdsCensoProcesados,
  listarRegistrosCenso,
  type RegistroCensoGuardado,
} from "@/data/reposCenso";
import { registrarEgreso } from "@/data/reposRefugiados";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { supabase } from "@/data/supabaseClient";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  agruparPorFamilia,
  alojamientosActivos,
  contarFamiliasActivas,
  formatearCedula,
  nombreCompleto,
  progresoCensoNominal,
  type AlojamientoEnriquecido,
} from "@/domain/refugiados";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  centroId: string;
  centroNombre: string;
  /** Salta a "Por cédula" con esa cédula precargada (censo viejo → nominal). */
  onVerificarEnNominal?: (letra: "V" | "E", cedula: string) => void;
  /** Abre ese hogar directo en "Por cédula" (para agregar/asignar un líder). */
  onAbrirFamilia?: (familiaId: string) => void;
}

interface FamiliaFila {
  key: string;
  jefe: AlojamientoEnriquecido;
  miembros: AlojamientoEnriquecido[];
}

function horaRegistro(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function etiquetaCedula(a: AlojamientoEnriquecido): string {
  const r = a.refugiado;
  if (r.cedula || r.cedula_norm) {
    return formatearCedula(
      r.cedula || r.cedula_norm || "",
      r.tipo_doc === "E" ? "E" : "V",
    );
  }
  return "Sin cédula";
}

function etiquetaParentesco(a: AlojamientoEnriquecido): string | null {
  if (a.es_jefe_familia) return "Jefe/a";
  return a.parentesco_jefe?.trim() || null;
}

function BarraAvance({
  etiqueta,
  actual,
  meta,
  pct,
}: {
  etiqueta: string;
  actual: number;
  meta: number;
  pct: number;
}) {
  const faltan = Math.max(0, meta - actual);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{etiqueta}</span>
        <span className="tabular-nums text-muted-foreground">
          {actual.toLocaleString("es")} / {meta.toLocaleString("es")}
          {faltan > 0 ? (
            <span className="ml-1 text-amber-500">
              (faltan {faltan.toLocaleString("es")})
            </span>
          ) : null}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function BotonEliminar({
  onClick,
  eliminando,
  className,
}: {
  onClick: () => void;
  eliminando: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "size-8 shrink-0 text-destructive hover:text-destructive",
        className,
      )}
      title="Eliminar del censo"
      disabled={eliminando}
      onClick={onClick}
    >
      {eliminando ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
    </Button>
  );
}

function FilaPersona({
  a,
  numero,
  onEliminar,
  eliminando,
  compacta = false,
}: {
  a: AlojamientoEnriquecido;
  numero?: number;
  onEliminar: () => void;
  eliminando: boolean;
  compacta?: boolean;
}) {
  const parentesco = etiquetaParentesco(a);

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compacta ? "py-1.5" : "border-b border-border/60 px-1 py-2.5 last:border-b-0",
      )}
    >
      {numero != null ? (
        <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
          {numero}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">
          {nombreCompleto(a.refugiado)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="font-mono">{etiquetaCedula(a)}</span>
          {parentesco ? (
            a.es_jefe_familia ? (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {parentesco}
              </Badge>
            ) : (
              <span>{parentesco}</span>
            )
          ) : null}
        </p>
        {!compacta ? (
          <span className="mt-0.5 flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground/80">
            <Clock className="size-2.5 opacity-70" />
            {horaRegistro(a.creada_ts)}
          </span>
        ) : null}
      </div>
      <BotonEliminar onClick={onEliminar} eliminando={eliminando} />
    </div>
  );
}

function FilaFamilia({
  familia,
  numero,
  onEliminar,
  eliminandoId,
  onAbrirFamilia,
}: {
  familia: FamiliaFila;
  numero: number;
  onEliminar: (a: AlojamientoEnriquecido) => void;
  eliminandoId: string | null;
  onAbrirFamilia?: (familiaId: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const titulo =
    familia.jefe.familia?.nombre?.trim() ||
    `Familia ${nombreCompleto(familia.jefe.refugiado).split(/\s+/).slice(-1)[0] || ""}`.trim();
  const otros = familia.miembros.filter((m) => m.id !== familia.jefe.id);
  const lideresActivos = familia.miembros.filter((m) => m.es_jefe_familia).length;

  return (
    <Collapsible
      open={abierta}
      onOpenChange={setAbierta}
      className="border-b border-border/60 last:border-b-0"
    >
      <div className="flex items-center gap-1 px-1 py-2">
        <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">
            {nombreCompleto(familia.jefe.refugiado)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{etiquetaCedula(familia.jefe)}</span>
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {familia.jefe.es_jefe_familia ? "Líder" : "Sin líder aún"}
            </Badge>
            {titulo ? (
              <span className="truncate text-muted-foreground/80">{titulo}</span>
            ) : null}
          </p>
        </div>
        <Badge variant="outline" className="h-6 shrink-0 tabular-nums">
          {familia.miembros.length}{" "}
          {familia.miembros.length === 1 ? "miembro" : "miembros"}
        </Badge>
        {onAbrirFamilia && familia.jefe.familia_id && lideresActivos < 2 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 text-xs"
            title="Buscar y asignar el líder de esta familia"
            onClick={() => onAbrirFamilia(familia.jefe.familia_id as string)}
          >
            <UserCheck className="size-3.5" />
            Agregar líder
          </Button>
        ) : null}
        <BotonEliminar
          onClick={() => onEliminar(familia.jefe)}
          eliminando={eliminandoId === familia.jefe.id}
        />
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            title={abierta ? "Ocultar miembros" : "Ver miembros"}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                abierta && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mb-2 ml-7 space-y-0 rounded-md border border-border/70 bg-muted/25 px-2 py-1">
          {otros.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              Solo está registrado el jefe/a de familia.
            </p>
          ) : (
            otros.map((m) => (
              <FilaPersona
                key={m.id}
                a={m}
                compacta
                eliminando={eliminandoId === m.id}
                onEliminar={() => onEliminar(m)}
              />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FilaCensoViejo({
  fila,
  numero,
  verificado,
  onVerificar,
}: {
  fila: RegistroCensoGuardado;
  numero: number;
  verificado: boolean;
  /** Undefined si el registro no tiene cédula V/E utilizable en Nexus. */
  onVerificar?: () => void;
}) {
  const nombre = [fila.primer_nombre, fila.segundo_nombre, fila.primer_apellido, fila.segundo_apellido]
    .filter(Boolean)
    .join(" ");
  const doc = fila.documento
    ? `${fila.tipo_doc === "P" ? "PP " : (fila.tipo_doc ?? "V") + "-"}${fila.documento}`
    : "Sin cédula";

  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-1 py-2.5 last:border-b-0">
      <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
        {numero}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{nombre}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{doc}</p>
      </div>
      {verificado ? (
        <Badge className="h-6 shrink-0 gap-1 border-transparent bg-emerald-600/15 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
          <Check className="size-3" />
          Verificado
        </Badge>
      ) : onVerificar ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 gap-1 text-xs"
          onClick={onVerificar}
        >
          <UserCheck className="size-3.5" />
          Verificar
        </Button>
      ) : (
        <Badge variant="outline" className="h-6 shrink-0 px-1.5 text-[10px] text-muted-foreground">
          Sin cédula
        </Badge>
      )}
    </div>
  );
}

export function CensoListaCensadosPanel({
  centroId,
  centroNombre,
  onVerificarEnNominal,
  onAbrirFamilia,
}: Props) {
  const [centro, setCentro] = useState<CentroTransitorio | null>(null);
  const [eliminarTarget, setEliminarTarget] =
    useState<AlojamientoEnriquecido | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<"damnificados" | "familias" | "anterior">(
    "damnificados",
  );
  const [censoViejo, setCensoViejo] = useState<RegistroCensoGuardado[]>([]);
  const [procesadosViejo, setProcesadosViejo] = useState<Set<string>>(new Set());
  const [cargandoViejo, setCargandoViejo] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCargandoViejo(true);
    Promise.all([listarRegistrosCenso(centroId), listarIdsCensoProcesados(centroId)])
      .then(([lista, procesados]) => {
        if (cancelado) return;
        setCensoViejo(lista);
        setProcesadosViejo(procesados);
        setCargandoViejo(false);
      })
      .catch((err) => {
        console.warn("[CensoListaCensados] censo anterior:", err);
        if (!cancelado) setCargandoViejo(false);
      });
    return () => {
      cancelado = true;
    };
  }, [centroId]);

  const verificadosViejo = useMemo(
    () => censoViejo.filter((f) => procesadosViejo.has(f.id)).length,
    [censoViejo, procesadosViejo],
  );

  const censoViejoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const lista = [...censoViejo].sort((a, b) =>
      (a.primer_apellido || "").localeCompare(b.primer_apellido || ""),
    );
    if (!q) return lista;
    return lista.filter((f) => {
      const nombre = [f.primer_nombre, f.segundo_nombre, f.primer_apellido, f.segundo_apellido]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (nombre.includes(q)) return true;
      return Boolean(qDigits) && (f.documento || "").includes(qDigits);
    });
  }, [censoViejo, busqueda]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const { data, error } = await supabase
        .from("centros")
        .select("*")
        .eq("id", centroId)
        .eq("deleted", false)
        .maybeSingle();
      if (cancelado) return;
      if (error || !data) {
        console.warn("[CensoListaCensados] centro:", error?.message ?? "sin fila");
        setCentro(null);
        return;
      }
      setCentro(
        normalizarCentro(
          desenvolver(data as FilaSync<CentroTransitorio>) as CentroTransitorio,
        ),
      );
    })();
    return () => {
      cancelado = true;
    };
  }, [centroId]);

  const snapshots = useOcupacionesCentros({ centroId });
  const ultimoSnap = useMemo(() => {
    if (snapshots.length === 0) return null;
    return [...snapshots].sort((a, b) => b.dia.localeCompare(a.dia))[0] ?? null;
  }, [snapshots]);

  const { alojamientos, cargando, quitarLocal } = useAlojamientosCentro({
    centroId,
    estado: "activo",
  });

  const metaRefugiados = useMemo(() => {
    const desdeCentro = centro ? poblacionCentro(centro) : 0;
    const desdeSnap = Math.max(0, ultimoSnap?.total_afectados ?? 0);
    return Math.max(desdeCentro, desdeSnap);
  }, [centro, ultimoSnap]);

  const metaFamilias = useMemo(() => {
    const desdeCentro = centro?.familias_ocupadas ?? 0;
    const desdeSnap = Math.max(0, ultimoSnap?.familias ?? 0);
    return Math.max(desdeCentro, desdeSnap);
  }, [centro, ultimoSnap]);

  const progreso = useMemo(() => {
    const activos = alojamientosActivos(alojamientos);
    return progresoCensoNominal(
      { refugiados: metaRefugiados, familias: metaFamilias },
      {
        refugiados: activos.length,
        familias: contarFamiliasActivas(activos),
      },
    );
  }, [alojamientos, metaFamilias, metaRefugiados]);

  const tieneParte = metaRefugiados > 0 || metaFamilias > 0;
  const faltanRefugiados = Math.max(
    0,
    metaRefugiados - progreso.registradosRefugiados,
  );
  const faltanFamilias = Math.max(
    0,
    metaFamilias - progreso.registradosFamilias,
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase().replace(/\D/g, "");
    const qTexto = busqueda.trim().toLowerCase();
    const lista = [...alojamientos].sort(
      (a, b) => (b.creada_ts || 0) - (a.creada_ts || 0),
    );
    if (!qTexto) return lista;
    return lista.filter((a) => {
      const nom = nombreCompleto(a.refugiado).toLowerCase();
      const ced = (
        a.refugiado.cedula_norm ??
        a.refugiado.cedula ??
        ""
      ).toLowerCase();
      if (nom.includes(qTexto)) return true;
      if (q && ced.replace(/\D/g, "").includes(q)) return true;
      return ced.includes(qTexto);
    });
  }, [alojamientos, busqueda]);

  const familiasFilas = useMemo((): FamiliaFila[] => {
    const grupos = agruparPorFamilia(filtrados);
    const filas: FamiliaFila[] = [];

    for (const [familiaId, miembros] of grupos) {
      if (!familiaId) {
        // Personas sin familia: cada una cuenta como hogar de 1 (jefe implícito).
        for (const m of miembros) {
          filas.push({ key: `solo:${m.id}`, jefe: m, miembros: [m] });
        }
        continue;
      }
      const jefe =
        miembros.find((m) => m.es_jefe_familia) ??
        [...miembros].sort((a, b) => (a.creada_ts || 0) - (b.creada_ts || 0))[0];
      if (!jefe) continue;
      filas.push({
        key: familiaId,
        jefe,
        miembros: [...miembros].sort((a, b) => {
          if (a.es_jefe_familia && !b.es_jefe_familia) return -1;
          if (!a.es_jefe_familia && b.es_jefe_familia) return 1;
          return (a.creada_ts || 0) - (b.creada_ts || 0);
        }),
      });
    }

    return filas.sort(
      (a, b) => (b.jefe.creada_ts || 0) - (a.jefe.creada_ts || 0),
    );
  }, [filtrados]);

  async function confirmarEliminar() {
    if (!eliminarTarget) return;
    const id = eliminarTarget.id;
    setErrorEliminar(null);
    setEliminandoId(id);
    try {
      await registrarEgreso(id, {
        motivo: "Corrección de censo",
      });
      // Actualización optimista: no depender solo de Realtime (a veces el
      // evento no llega o reinserta si el payload omite `estado`).
      quitarLocal(id);
      setEliminarTarget(null);
    } catch (err) {
      console.error("[CensoListaCensados] eliminar:", err);
      setErrorEliminar(
        err instanceof Error ? err.message : "No se pudo eliminar del censo.",
      );
    } finally {
      setEliminandoId(null);
    }
  }

  function pedirEliminar(a: AlojamientoEnriquecido) {
    setErrorEliminar(null);
    setEliminarTarget(a);
  }

  return (
    <div className="space-y-3">
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Avance del censo
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {centro?.nombre || centroNombre} · vs parte numérico del reporte diario
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Damnificados
              </p>
              <p className="text-xl font-semibold tabular-nums text-primary">
                {progreso.registradosRefugiados.toLocaleString("es")}
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {tieneParte
                  ? `de ${metaRefugiados.toLocaleString("es")} · faltan ${faltanRefugiados.toLocaleString("es")}`
                  : "sin parte"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Familias
              </p>
              <p className="text-xl font-semibold tabular-nums text-violet-400">
                {progreso.registradosFamilias.toLocaleString("es")}
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {tieneParte
                  ? `de ${metaFamilias.toLocaleString("es")} · faltan ${faltanFamilias.toLocaleString("es")}`
                  : "sin parte"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Parte pers.
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {tieneParte ? metaRefugiados.toLocaleString("es") : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Parte fam.
              </p>
              <p className="text-xl font-semibold tabular-nums">
                {tieneParte ? metaFamilias.toLocaleString("es") : "—"}
              </p>
            </div>
          </div>

          {tieneParte ? (
            <>
              <BarraAvance
                etiqueta="Damnificados"
                actual={progreso.registradosRefugiados}
                meta={progreso.metaRefugiados}
                pct={progreso.pctRefugiados}
              />
              <BarraAvance
                etiqueta="Familias"
                actual={progreso.registradosFamilias}
                meta={progreso.metaFamilias}
                pct={progreso.pctFamilias}
              />
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Aún no hay parte numérico para contrastar. Se actualiza al guardar
              el reporte diario del campamento.
            </p>
          )}
          {censoViejo.length > 0 ? (
            <BarraAvance
              etiqueta="Censo anterior verificado"
              actual={verificadosViejo}
              meta={censoViejo.length}
              pct={Math.round((verificadosViejo / censoViejo.length) * 100)}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="space-y-3 pb-2">
          <CardTitle className="text-base">Censo nominal</CardTitle>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre o cédula"
              className="h-10 pl-9 text-base"
              autoComplete="off"
              inputMode="search"
            />
          </div>
          <div
            role="tablist"
            aria-label="Vistas del censo nominal"
            className={cn(
              "grid overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm",
              censoViejo.length > 0 ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            {(
              [
                {
                  id: "damnificados" as const,
                  label: "Damnificados",
                  conteo: filtrados.length,
                },
                {
                  id: "familias" as const,
                  label: "Familias",
                  conteo: familiasFilas.length,
                },
                ...(censoViejo.length > 0
                  ? [
                      {
                        id: "anterior" as const,
                        label: "Censo anterior",
                        conteo: censoViejoFiltrado.length,
                      },
                    ]
                  : []),
              ] as const
            ).map((tab, i) => {
              const activa = pestana === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setPestana(tab.id)}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1.5 py-2 text-center transition-colors sm:flex-row sm:gap-1.5 sm:px-2",
                    i > 0 && "border-l border-border",
                    activa
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-muted/80",
                  )}
                >
                  <span className="text-[11px] font-semibold leading-tight sm:text-xs">
                    {tab.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      activa
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.conteo.toLocaleString("es")}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {pestana === "anterior" ? (
            cargandoViejo ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : censoViejoFiltrado.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {busqueda.trim()
                  ? "Ningún resultado para esa búsqueda."
                  : "No hay registros del censo manual anterior para este campamento."}
              </p>
            ) : (
              <>
                <p className="mb-1 text-[11px] leading-snug text-muted-foreground">
                  Personas censadas antes de este flujo por cédula. "Verificado" =
                  ya se confirmó su identidad con Nexus/SAIME y quedó agrupada en
                  una familia del censo nominal.
                </p>
                <ul className="-mx-1">
                  {censoViejoFiltrado.map((f, i) => (
                    <li key={f.id}>
                      <FilaCensoViejo
                        fila={f}
                        numero={i + 1}
                        verificado={procesadosViejo.has(f.id)}
                        onVerificar={
                          onVerificarEnNominal && f.documento && (f.tipo_doc === "V" || f.tipo_doc === "E")
                            ? () => onVerificarEnNominal(f.tipo_doc as "V" | "E", f.documento)
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : cargando ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          ) : pestana === "damnificados" ? (
            filtrados.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {busqueda.trim()
                  ? "Ningún resultado para esa búsqueda."
                  : "Aún no hay personas censadas en este campamento."}
              </p>
            ) : (
              <ul className="-mx-1">
                {filtrados.map((a, i) => (
                  <li key={a.id}>
                    <FilaPersona
                      a={a}
                      numero={i + 1}
                      eliminando={eliminandoId === a.id}
                      onEliminar={() => pedirEliminar(a)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : familiasFilas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {busqueda.trim()
                ? "Ninguna familia coincide con esa búsqueda."
                : "Aún no hay familias censadas en este campamento."}
            </p>
          ) : (
            <div className="-mx-1">
              {familiasFilas.map((f, i) => (
                <FilaFamilia
                  key={f.key}
                  familia={f}
                  numero={i + 1}
                  eliminandoId={eliminandoId}
                  onEliminar={pedirEliminar}
                  onAbrirFamilia={onAbrirFamilia}
                />
              ))}
            </div>
          )}

          {!cargando &&
          pestana !== "anterior" &&
          ((pestana === "damnificados" && filtrados.length > 0) ||
            (pestana === "familias" && familiasFilas.length > 0)) ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {pestana === "damnificados"
                ? `${filtrados.length.toLocaleString("es")} de ${alojamientos.length.toLocaleString("es")}`
                : `${familiasFilas.length.toLocaleString("es")} familia${familiasFilas.length === 1 ? "" : "s"}`}
            </p>
          ) : null}
          {pestana === "anterior" && !cargandoViejo && censoViejoFiltrado.length > 0 ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {verificadosViejo.toLocaleString("es")} de {censoViejo.length.toLocaleString("es")} verificados
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog
        open={eliminarTarget != null}
        onOpenChange={(abierto) => {
          if (!abierto && !eliminandoId) {
            setEliminarTarget(null);
            setErrorEliminar(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar del censo?</AlertDialogTitle>
            <AlertDialogDescription>
              {eliminarTarget
                ? `Se quitará a ${nombreCompleto(eliminarTarget.refugiado)} del campamento (egreso por corrección de censo).`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorEliminar ? (
            <p className="text-sm text-destructive">{errorEliminar}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={eliminandoId != null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={eliminandoId != null}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminar();
              }}
            >
              {eliminandoId ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
