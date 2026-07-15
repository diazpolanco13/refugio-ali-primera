// Administración de catálogos operativos: cuerpos policiales + unidades de supervisión.
// Ruta: `/config/catalogos-operativos` (redirect desde `/config/unidades-sebin`).

import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { ImagePlus, Loader2, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { supabase } from "@/data/supabaseClient";
import {
  useGestionCuerposPoliciales,
  type CuerpoPolicialInput,
} from "@/data/useCuerposPoliciales";
import {
  useGestionUnidadesSebin,
  type UnidadSebinInput,
} from "@/data/useUnidadesSebin";
import { subirLogoCatalogo, supabaseDisponible } from "@/data/supabase";
import {
  puedeEditarCuerposPoliciales,
  puedeEntrarACatalogos,
} from "@/domain/permisos";
import { slugCuerpo, type MetaCuerpo } from "@/domain/cuerposPoliciales";
import { slugUnidadSebin, type MetaUnidadSebin } from "@/domain/unidadesSebin";
import { LogoCuerpo } from "@/components/LogoCuerpo";
import { VistaPagina } from "@/components/VistaPagina";
import { LoadingTable } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
}

/** Select visible: borde + fondo (no texto plano). Misma idea que censo. */
const SELECT_TRIGGER_VISIBLE =
  "h-9 w-full min-w-[12rem] border-2 border-border bg-muted font-medium text-foreground shadow-sm hover:bg-muted/80 dark:bg-muted dark:hover:bg-muted/80 [&_svg]:text-foreground";

const TAB_LIST_VISIBLE =
  "h-11 w-full max-w-xl border-2 border-border bg-muted p-1 shadow-sm";

const TAB_TRIGGER_VISIBLE =
  "px-4 py-2 text-sm font-semibold text-muted-foreground data-active:bg-card data-active:text-foreground data-active:shadow-md data-active:ring-1 data-active:ring-border dark:data-active:bg-card dark:data-active:text-foreground";

const COLORES_SUGERIDOS = [
  "#2563eb",
  "#0891b2",
  "#0d9488",
  "#059669",
  "#ca8a04",
  "#d97706",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#e11d48",
  "#4f46e5",
  "#65a30d",
  "#64748b",
];

function formCuerpoVacio(ordenSiguiente: number): CuerpoPolicialInput {
  return {
    clave: "",
    label: "",
    color: COLORES_SUGERIDOS[ordenSiguiente % COLORES_SUGERIDOS.length] ?? "#64748b",
    icono: "🛡️",
    logo_url: null,
    orden: ordenSiguiente,
    activo: true,
  };
}

function cuerpoDesdeMeta(c: MetaCuerpo): CuerpoPolicialInput {
  return {
    clave: c.clave,
    label: c.label,
    color: c.color,
    icono: c.icono,
    logo_url: c.logo,
    orden: c.orden ?? 100,
    activo: c.activo !== false,
  };
}

function formUnidadVacio(
  ordenSiguiente: number,
  cuerpoClave: string | null,
): UnidadSebinInput {
  return {
    clave: "",
    label: "",
    valor_db: "",
    color: COLORES_SUGERIDOS[ordenSiguiente % COLORES_SUGERIDOS.length] ?? "#64748b",
    cuerpo_clave: cuerpoClave,
    logo_url: null,
    orden: ordenSiguiente,
    activo: true,
  };
}

function unidadDesdeMeta(u: MetaUnidadSebin): UnidadSebinInput {
  return {
    clave: u.clave,
    label: u.label,
    valor_db: u.valorDb,
    color: u.color,
    cuerpo_clave: u.cuerpoClave ?? null,
    logo_url: u.logoUrl ?? null,
    orden: u.orden ?? 100,
    activo: u.activo !== false,
  };
}

function CampoLogo({
  url,
  disabled,
  onSubir,
  onQuitar,
}: {
  url: string | null;
  disabled?: boolean;
  onSubir: (file: File) => Promise<void>;
  onQuitar: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSubiendo(true);
    try {
      await onSubir(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2.5">
      <Label>Logo / escudo</Label>
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/40">
          {url ? (
            <LogoCuerpo src={url} className="size-12" />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={disabled || subiendo || !supabaseDisponible()}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || subiendo || !supabaseDisponible()}
            onClick={() => inputRef.current?.click()}
          >
            {subiendo ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {url ? "Cambiar" : "Subir"}
          </Button>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || subiendo}
              onClick={onQuitar}
            >
              Quitar
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!supabaseDisponible() && (
        <p className="text-[10px] text-muted-foreground">Storage no configurado.</p>
      )}
    </div>
  );
}

export function GestionCatalogosOperativos({ sesion }: Props) {
  const puede = puedeEntrarACatalogos(sesion.user);
  /** Edición del catálogo de cuerpos (y de unidades de cualquier cuerpo). */
  const puedeCuerpos = puedeEditarCuerposPoliciales(sesion.user);
  /** Analista con cuerpo asignado: gestiona SOLO unidades de este cuerpo. */
  const cuerpoScope = puedeCuerpos ? null : (sesion.user.cuerpo_asignado ?? null);
  const puedeUnidad = (u: MetaUnidadSebin): boolean =>
    puedeCuerpos || (cuerpoScope != null && u.cuerpoClave === cuerpoScope);
  const {
    cuerpos,
    cargando: cargandoCuerpos,
    error: errorCuerpos,
    guardar: guardarCuerpo,
    eliminar: eliminarCuerpo,
  } = useGestionCuerposPoliciales();
  const {
    unidades,
    cargando: cargandoUnidades,
    error: errorUnidades,
    guardar: guardarUnidad,
    eliminar: eliminarUnidad,
  } = useGestionUnidadesSebin();

  const [pestana, setPestana] = useState<"cuerpos" | "unidades">(
    cuerpoScope ? "unidades" : "cuerpos",
  );
  const [filtroCuerpoUnidades, setFiltroCuerpoUnidades] = useState<string>(
    cuerpoScope ?? "todos",
  );

  const [dialogoCuerpo, setDialogoCuerpo] = useState<"nuevo" | "editar" | null>(null);
  const [formCuerpo, setFormCuerpo] = useState<CuerpoPolicialInput>(() => formCuerpoVacio(10));
  const [claveCuerpoOrig, setClaveCuerpoOrig] = useState<string | null>(null);

  const [dialogoUnidad, setDialogoUnidad] = useState<"nuevo" | "editar" | null>(null);
  const [formUnidad, setFormUnidad] = useState<UnidadSebinInput>(() =>
    formUnidadVacio(10, "sebin"),
  );
  const [claveUnidadOrig, setClaveUnidadOrig] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [eliminandoCuerpo, setEliminandoCuerpo] = useState<MetaCuerpo | null>(null);
  const [eliminandoUnidad, setEliminandoUnidad] = useState<MetaUnidadSebin | null>(null);
  const [eliminandoEnCurso, setEliminandoEnCurso] = useState(false);
  /** Campamentos que usan el cuerpo/unidad a eliminar (null = cargando). */
  const [usoEliminando, setUsoEliminando] = useState<number | null>(null);

  useEffect(() => {
    if (!eliminandoCuerpo) return;
    let cancelado = false;
    setUsoEliminando(null);
    void supabase
      .from("centros")
      .select("id", { count: "exact", head: true })
      .not("deleted", "is", true)
      .eq("data->>cuerpo", eliminandoCuerpo.label)
      .then(({ count }) => {
        if (!cancelado) setUsoEliminando(count ?? 0);
      });
    return () => {
      cancelado = true;
    };
  }, [eliminandoCuerpo]);

  useEffect(() => {
    if (!eliminandoUnidad?.valorDb) {
      if (eliminandoUnidad) setUsoEliminando(0);
      return;
    }
    let cancelado = false;
    setUsoEliminando(null);
    void supabase
      .from("centros")
      .select("id", { count: "exact", head: true })
      .not("deleted", "is", true)
      .eq("data->supervision->>unidad_sebin", eliminandoUnidad.valorDb)
      .then(({ count }) => {
        if (!cancelado) setUsoEliminando(count ?? 0);
      });
    return () => {
      cancelado = true;
    };
  }, [eliminandoUnidad]);

  const unidadesDelCuerpoEliminando = useMemo(() => {
    if (!eliminandoCuerpo) return 0;
    return unidades.filter(
      (u) => u.cuerpoClave === eliminandoCuerpo.clave && u.clave !== "sin_asignar",
    ).length;
  }, [unidades, eliminandoCuerpo]);

  const cuerposActivosSelect = useMemo(
    () => cuerpos.filter((c) => c.clave !== "sin_asignar" && c.activo !== false),
    [cuerpos],
  );

  const mapaCuerpoLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cuerpos) m.set(c.clave, c.label);
    return m;
  }, [cuerpos]);

  const ordenSiguienteCuerpo = useMemo(() => {
    const max = cuerpos
      .filter((c) => c.clave !== "sin_asignar")
      .reduce((m, c) => Math.max(m, c.orden ?? 0), 0);
    return max + 10;
  }, [cuerpos]);

  const unidadesFiltradas = useMemo(() => {
    if (filtroCuerpoUnidades === "todos") return unidades;
    if (filtroCuerpoUnidades === "globales") {
      return unidades.filter((u) => !u.cuerpoClave || u.clave === "sin_asignar");
    }
    return unidades.filter(
      (u) => u.cuerpoClave === filtroCuerpoUnidades || u.clave === "sin_asignar",
    );
  }, [unidades, filtroCuerpoUnidades]);

  const ordenSiguienteUnidad = useMemo(() => {
    const max = unidades
      .filter((u) => u.clave !== "sin_asignar")
      .reduce((m, u) => Math.max(m, u.orden ?? 0), 0);
    return max + 10;
  }, [unidades]);

  if (!puede) {
    return <Navigate to="/centros/mapa" replace />;
  }

  function abrirNuevoCuerpo() {
    setFormCuerpo(formCuerpoVacio(ordenSiguienteCuerpo));
    setClaveCuerpoOrig(null);
    setErrorForm(null);
    setDialogoCuerpo("nuevo");
  }

  function abrirEditarCuerpo(c: MetaCuerpo) {
    setFormCuerpo(cuerpoDesdeMeta(c));
    setClaveCuerpoOrig(c.clave);
    setErrorForm(null);
    setDialogoCuerpo("editar");
  }

  function abrirNuevoUnidad() {
    const cuerpoDefault =
      cuerpoScope ??
      (filtroCuerpoUnidades !== "todos" && filtroCuerpoUnidades !== "globales"
        ? filtroCuerpoUnidades
        : (cuerposActivosSelect.find((c) => c.clave === "sebin")?.clave ??
          cuerposActivosSelect[0]?.clave ??
          null));
    setFormUnidad(formUnidadVacio(ordenSiguienteUnidad, cuerpoDefault));
    setClaveUnidadOrig(null);
    setErrorForm(null);
    setDialogoUnidad("nuevo");
  }

  function abrirEditarUnidad(u: MetaUnidadSebin) {
    setFormUnidad(unidadDesdeMeta(u));
    setClaveUnidadOrig(u.clave);
    setErrorForm(null);
    setDialogoUnidad("editar");
  }

  async function onSubmitCuerpo(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    const label = formCuerpo.label.trim();
    if (!label) {
      setErrorForm("El nombre es obligatorio.");
      return;
    }
    let clave = formCuerpo.clave.trim();
    if (dialogoCuerpo === "nuevo") {
      clave = clave || slugCuerpo(label);
      if (!/^[a-z][a-z0-9_]{1,62}$/.test(clave)) {
        setErrorForm("La clave debe ser un slug (ej. poli_nueva).");
        return;
      }
      if (cuerpos.some((c) => c.clave === clave)) {
        setErrorForm("Ya existe un cuerpo con esa clave.");
        return;
      }
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(formCuerpo.color.trim())) {
      setErrorForm("El color debe ser hex de 6 dígitos (ej. #2563eb).");
      return;
    }
    setGuardando(true);
    try {
      await guardarCuerpo(
        {
          ...formCuerpo,
          clave: dialogoCuerpo === "nuevo" ? clave : (claveCuerpoOrig ?? formCuerpo.clave),
          label,
        },
        dialogoCuerpo === "nuevo",
      );
      setDialogoCuerpo(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function onSubmitUnidad(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    const label = formUnidad.label.trim();
    if (!label) {
      setErrorForm("La etiqueta es obligatoria.");
      return;
    }
    let clave = formUnidad.clave.trim();
    if (dialogoUnidad === "nuevo") {
      clave = clave || slugUnidadSebin(label);
      if (!/^[a-z][a-z0-9_]{1,62}$/.test(clave)) {
        setErrorForm("La clave debe ser un slug (ej. dir_nueva_unidad).");
        return;
      }
      if (unidades.some((u) => u.clave === clave)) {
        setErrorForm("Ya existe una unidad con esa clave.");
        return;
      }
    }
    if (clave !== "sin_asignar" && !formUnidad.cuerpo_clave) {
      setErrorForm("Seleccioná el cuerpo al que pertenece la unidad.");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(formUnidad.color.trim())) {
      setErrorForm("El color debe ser hex de 6 dígitos (ej. #2563eb).");
      return;
    }
    const cuerpoLabel =
      mapaCuerpoLabel.get(formUnidad.cuerpo_clave ?? "") ?? "SEBIN";
    setGuardando(true);
    try {
      await guardarUnidad(
        {
          ...formUnidad,
          clave: dialogoUnidad === "nuevo" ? clave : (claveUnidadOrig ?? formUnidad.clave),
          label,
          valor_db:
            formUnidad.valor_db.trim() ||
            (clave === "sin_asignar" ? "" : `${label} - ${cuerpoLabel}`),
        },
        dialogoUnidad === "nuevo",
      );
      setDialogoUnidad(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminarCuerpo() {
    if (!eliminandoCuerpo) return;
    setEliminandoEnCurso(true);
    try {
      await eliminarCuerpo(eliminandoCuerpo.clave);
      setEliminandoCuerpo(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo eliminar.");
      setEliminandoCuerpo(null);
    } finally {
      setEliminandoEnCurso(false);
    }
  }

  async function confirmarEliminarUnidad() {
    if (!eliminandoUnidad) return;
    setEliminandoEnCurso(true);
    try {
      await eliminarUnidad(eliminandoUnidad.clave);
      setEliminandoUnidad(null);
    } catch (err) {
      setErrorForm(err instanceof Error ? err.message : "No se pudo eliminar.");
      setEliminandoUnidad(null);
    } finally {
      setEliminandoEnCurso(false);
    }
  }

  const errorGlobal = errorForm ?? errorCuerpos ?? errorUnidades;

  return (
    <>
      <VistaPagina
        icono={Shield}
        acento="sky"
        titulo="Cuerpos y unidades"
        descripcion="Catálogos que alimentan los desplegables de asignación operativa, mapa y filtros"
        acciones={
          pestana === "cuerpos" ? (
            puedeCuerpos ? (
              <Button onClick={abrirNuevoCuerpo} className="gap-1.5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nuevo cuerpo</span>
              </Button>
            ) : undefined
          ) : (
            <Button onClick={abrirNuevoUnidad} className="gap-1.5">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nueva unidad</span>
            </Button>
          )
        }
        cuerpoClassName="p-4 lg:p-6"
      >
        <Tabs
          value={pestana}
          onValueChange={(v) => setPestana(v as "cuerpos" | "unidades")}
          className="gap-4"
        >
          <TabsList className={TAB_LIST_VISIBLE}>
            <TabsTrigger value="cuerpos" className={TAB_TRIGGER_VISIBLE}>
              Cuerpos policiales
            </TabsTrigger>
            <TabsTrigger value="unidades" className={TAB_TRIGGER_VISIBLE}>
              Unidades de supervisión
            </TabsTrigger>
          </TabsList>

          {errorGlobal && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorGlobal}
            </div>
          )}

          <TabsContent value="cuerpos" className="space-y-4">
            {cargandoCuerpos && cuerpos.length === 0 ? (
              <LoadingTable rows={6} cols={4} conToolbar={false} />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {cuerpos.map((c) => (
                  <li
                    key={c.clave}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5",
                      c.activo === false && "opacity-50",
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
                      {c.logo ? (
                        <LogoCuerpo src={c.logo} className="size-8" />
                      ) : (
                        <span className="text-base" aria-hidden>
                          {c.icono}
                        </span>
                      )}
                    </div>
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{c.label}</span>
                        {c.clave === "sin_asignar" && (
                          <Badge variant="outline" className="text-[10px]">
                            Sistema
                          </Badge>
                        )}
                        {c.activo === false && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        <span className="font-mono">{c.clave}</span>
                      </p>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      orden {c.orden ?? "—"}
                    </span>
                    {puedeCuerpos && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => abrirEditarCuerpo(c)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {c.clave !== "sin_asignar" && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            title="Eliminar"
                            onClick={() => setEliminandoCuerpo(c)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="unidades" className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full max-w-xs space-y-2">
                <Label>Filtrar por cuerpo</Label>
                <Select value={filtroCuerpoUnidades} onValueChange={setFiltroCuerpoUnidades}>
                  <SelectTrigger className={SELECT_TRIGGER_VISIBLE}>
                    <SelectValue placeholder="Todos los cuerpos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="globales">Solo globales</SelectItem>
                    {cuerposActivosSelect.map((c) => (
                      <SelectItem key={c.clave} value={c.clave}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {cargandoUnidades && unidades.length === 0 ? (
              <LoadingTable rows={6} cols={4} conToolbar={false} />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {unidadesFiltradas.map((u) => (
                  <li
                    key={u.clave}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5",
                      u.activo === false && "opacity-50",
                    )}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
                      {u.logoUrl ? (
                        <LogoCuerpo src={u.logoUrl} className="size-8" />
                      ) : (
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: u.color }}
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{u.label}</span>
                        {u.cuerpoClave && (
                          <Badge variant="outline" className="text-[10px]">
                            {mapaCuerpoLabel.get(u.cuerpoClave) ?? u.cuerpoClave}
                          </Badge>
                        )}
                        {u.clave === "sin_asignar" && (
                          <Badge variant="outline" className="text-[10px]">
                            Sistema
                          </Badge>
                        )}
                        {u.activo === false && (
                          <Badge variant="secondary" className="text-[10px]">
                            Inactiva
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        <span className="font-mono">{u.clave}</span>
                        {u.valorDb ? ` · ${u.valorDb}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      orden {u.orden ?? "—"}
                    </span>
                    {puedeUnidad(u) && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => abrirEditarUnidad(u)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {u.clave !== "sin_asignar" && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            title="Eliminar"
                            onClick={() => setEliminandoUnidad(u)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Cambios se reflejan solos en mapa, ficha y filtros. Renombrar un cuerpo o el valor
          guardado de una unidad remapea campamentos que ya lo tenían.
        </p>
      </VistaPagina>

      {/* Dialog cuerpo */}
      <Dialog
        open={dialogoCuerpo != null}
        onOpenChange={(a) => !a && !guardando && setDialogoCuerpo(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!guardando}>
          <form onSubmit={(e) => void onSubmitCuerpo(e)} className="flex min-h-0 flex-col">
            <DialogHeader className="px-5 py-4">
              <DialogTitle>
                {dialogoCuerpo === "nuevo" ? "Nuevo cuerpo" : "Editar cuerpo"}
              </DialogTitle>
              <DialogDescription>
                Aparece en asignación operativa, filtros y logos del mapa.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="cuerpo-label">Nombre</Label>
                <Input
                  id="cuerpo-label"
                  className="h-9"
                  value={formCuerpo.label}
                  disabled={guardando}
                  onChange={(e) => {
                    const label = e.target.value;
                    setFormCuerpo((prev) => ({
                      ...prev,
                      label,
                      clave:
                        dialogoCuerpo === "nuevo" && !claveCuerpoOrig
                          ? slugCuerpo(label)
                          : prev.clave,
                    }));
                  }}
                  placeholder="Poli Nueva"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuerpo-clave">Clave (slug)</Label>
                <Input
                  id="cuerpo-clave"
                  className="h-9 font-mono text-xs"
                  value={formCuerpo.clave}
                  disabled={guardando || dialogoCuerpo === "editar"}
                  onChange={(e) =>
                    setFormCuerpo((prev) => ({
                      ...prev,
                      clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    }))
                  }
                  placeholder="poli_nueva"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cuerpo-icono">Ícono (emoji)</Label>
                  <Input
                    id="cuerpo-icono"
                    className="h-9"
                    value={formCuerpo.icono}
                    disabled={guardando}
                    onChange={(e) =>
                      setFormCuerpo((prev) => ({ ...prev, icono: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cuerpo-orden">Orden</Label>
                  <Input
                    id="cuerpo-orden"
                    type="number"
                    className="h-9"
                    value={formCuerpo.orden}
                    disabled={guardando}
                    onChange={(e) =>
                      setFormCuerpo((prev) => ({
                        ...prev,
                        orden: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cuerpo-color">Color</Label>
                <div className="flex items-center gap-2.5">
                  <input
                    id="cuerpo-color"
                    type="color"
                    className="size-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                    value={formCuerpo.color}
                    disabled={guardando}
                    onChange={(e) =>
                      setFormCuerpo((prev) => ({ ...prev, color: e.target.value }))
                    }
                  />
                  <Input
                    className="h-9 font-mono text-xs"
                    value={formCuerpo.color}
                    disabled={guardando}
                    onChange={(e) =>
                      setFormCuerpo((prev) => ({ ...prev, color: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {COLORES_SUGERIDOS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      className={cn(
                        "size-7 rounded-full border-2 transition-transform hover:scale-110",
                        formCuerpo.color.toLowerCase() === c.toLowerCase()
                          ? "border-foreground"
                          : "border-transparent",
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setFormCuerpo((prev) => ({ ...prev, color: c }))}
                      disabled={guardando}
                    />
                  ))}
                </div>
              </div>
              <CampoLogo
                url={formCuerpo.logo_url}
                disabled={guardando}
                onSubir={async (file) => {
                  const clave =
                    formCuerpo.clave.trim() ||
                    slugCuerpo(formCuerpo.label) ||
                    "cuerpo";
                  const url = await subirLogoCatalogo("cuerpo", clave, file);
                  setFormCuerpo((prev) => ({ ...prev, logo_url: url }));
                }}
                onQuitar={() => setFormCuerpo((prev) => ({ ...prev, logo_url: null }))}
              />
              {formCuerpo.clave !== "sin_asignar" && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Activo</p>
                    <p className="text-[10px] text-muted-foreground">
                      Si lo desactivás, no aparece en selectores nuevos.
                    </p>
                  </div>
                  <Switch
                    checked={formCuerpo.activo}
                    disabled={guardando}
                    onCheckedChange={(v) =>
                      setFormCuerpo((prev) => ({ ...prev, activo: v }))
                    }
                  />
                </div>
              )}
            </div>
            <DialogFooter className="gap-3 p-5">
              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                onClick={() => setDialogoCuerpo(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
                {dialogoCuerpo === "nuevo" ? "Crear" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog unidad */}
      <Dialog
        open={dialogoUnidad != null}
        onOpenChange={(a) => !a && !guardando && setDialogoUnidad(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!guardando}>
          <form onSubmit={(e) => void onSubmitUnidad(e)} className="flex min-h-0 flex-col">
            <DialogHeader className="px-5 py-4">
              <DialogTitle>
                {dialogoUnidad === "nuevo" ? "Nueva unidad" : "Editar unidad"}
              </DialogTitle>
              <DialogDescription>
                Unidad de supervisión ligada a un cuerpo policial.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
              {formUnidad.clave !== "sin_asignar" && (
                <div className="space-y-2">
                  <Label>Cuerpo</Label>
                  <Select
                    value={formUnidad.cuerpo_clave ?? undefined}
                    onValueChange={(v) =>
                      setFormUnidad((prev) => ({ ...prev, cuerpo_clave: v }))
                    }
                    disabled={guardando || cuerpoScope != null}
                  >
                    <SelectTrigger className={SELECT_TRIGGER_VISIBLE}>
                      <SelectValue placeholder="Elegir cuerpo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cuerposActivosSelect.map((c) => (
                        <SelectItem key={c.clave} value={c.clave}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="unidad-label">Etiqueta</Label>
                <Input
                  id="unidad-label"
                  className="h-9"
                  value={formUnidad.label}
                  disabled={guardando}
                  onChange={(e) => {
                    const label = e.target.value;
                    const cuerpoLabel =
                      mapaCuerpoLabel.get(formUnidad.cuerpo_clave ?? "") ?? "SEBIN";
                    setFormUnidad((prev) => ({
                      ...prev,
                      label,
                      clave:
                        dialogoUnidad === "nuevo" && !claveUnidadOrig
                          ? slugUnidadSebin(label)
                          : prev.clave,
                      valor_db:
                        prev.valor_db === "" ||
                        prev.valor_db === `${prev.label} - ${cuerpoLabel}` ||
                        prev.valor_db.endsWith(` - ${cuerpoLabel}`)
                          ? label.trim()
                            ? `${label.trim()} - ${cuerpoLabel}`
                            : ""
                          : prev.valor_db,
                    }));
                  }}
                  placeholder="DIR. NUEVA"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidad-clave">Clave (slug)</Label>
                <Input
                  id="unidad-clave"
                  className="h-9 font-mono text-xs"
                  value={formUnidad.clave}
                  disabled={guardando || dialogoUnidad === "editar"}
                  onChange={(e) =>
                    setFormUnidad((prev) => ({
                      ...prev,
                      clave: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                    }))
                  }
                  placeholder="dir_nueva"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidad-valor">Valor guardado en el campamento</Label>
                <Input
                  id="unidad-valor"
                  className="h-9"
                  value={formUnidad.valor_db}
                  disabled={guardando || formUnidad.clave === "sin_asignar"}
                  onChange={(e) =>
                    setFormUnidad((prev) => ({ ...prev, valor_db: e.target.value }))
                  }
                  placeholder="DIR. NUEVA - SEBIN"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidad-orden">Orden</Label>
                  <Input
                    id="unidad-orden"
                    type="number"
                    className="h-9"
                    value={formUnidad.orden}
                    disabled={guardando}
                    onChange={(e) =>
                      setFormUnidad((prev) => ({
                        ...prev,
                        orden: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unidad-color">Color</Label>
                  <div className="flex items-center gap-2.5">
                    <input
                      id="unidad-color"
                      type="color"
                      className="size-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                      value={formUnidad.color}
                      disabled={guardando}
                      onChange={(e) =>
                        setFormUnidad((prev) => ({ ...prev, color: e.target.value }))
                      }
                    />
                    <Input
                      className="h-9 font-mono text-xs"
                      value={formUnidad.color}
                      disabled={guardando}
                      onChange={(e) =>
                        setFormUnidad((prev) => ({ ...prev, color: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
              <CampoLogo
                url={formUnidad.logo_url}
                disabled={guardando}
                onSubir={async (file) => {
                  const clave =
                    formUnidad.clave.trim() ||
                    slugUnidadSebin(formUnidad.label) ||
                    "unidad";
                  const url = await subirLogoCatalogo("unidad", clave, file);
                  setFormUnidad((prev) => ({ ...prev, logo_url: url }));
                }}
                onQuitar={() => setFormUnidad((prev) => ({ ...prev, logo_url: null }))}
              />
              {formUnidad.clave !== "sin_asignar" && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Activa</p>
                    <p className="text-[10px] text-muted-foreground">
                      Si la desactivás, no aparece en selectores nuevos.
                    </p>
                  </div>
                  <Switch
                    checked={formUnidad.activo}
                    disabled={guardando}
                    onCheckedChange={(v) =>
                      setFormUnidad((prev) => ({ ...prev, activo: v }))
                    }
                  />
                </div>
              )}
            </div>
            <DialogFooter className="gap-3 p-5">
              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                onClick={() => setDialogoUnidad(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
                {dialogoUnidad === "nuevo" ? "Crear" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={eliminandoCuerpo != null}
        onOpenChange={(a) => !a && !eliminandoEnCurso && setEliminandoCuerpo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{eliminandoCuerpo?.label}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {usoEliminando == null
                ? "Calculando impacto…"
                : usoEliminando > 0
                  ? `${usoEliminando} campamento${usoEliminando === 1 ? "" : "s"} lo ${usoEliminando === 1 ? "tiene" : "tienen"} asignado: quedará${usoEliminando === 1 ? "" : "n"} como «Sin asignar» hasta reasignarlo${usoEliminando === 1 ? "" : "s"}.`
                  : "Ningún campamento lo tiene asignado."}
              {unidadesDelCuerpoEliminando > 0 &&
                (unidadesDelCuerpoEliminando === 1
                  ? " Su unidad de supervisión se desactivará."
                  : ` Sus ${unidadesDelCuerpoEliminando} unidades de supervisión se desactivarán.`)}{" "}
              Preferí desactivar si solo querés ocultarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminandoEnCurso}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={eliminandoEnCurso}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminarCuerpo();
              }}
            >
              {eliminandoEnCurso ? <Loader2 className="size-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={eliminandoUnidad != null}
        onOpenChange={(a) => !a && !eliminandoEnCurso && setEliminandoUnidad(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{eliminandoUnidad?.label}»?</AlertDialogTitle>
            <AlertDialogDescription>
              {usoEliminando == null
                ? "Calculando impacto…"
                : usoEliminando > 0
                  ? `${usoEliminando} campamento${usoEliminando === 1 ? "" : "s"} la ${usoEliminando === 1 ? "tiene" : "tienen"} asignada: quedará${usoEliminando === 1 ? "" : "n"} como «Sin unidad» en el mapa hasta reasignarlo${usoEliminando === 1 ? "" : "s"}.`
                  : "Ningún campamento la tiene asignada."}{" "}
              Preferí desactivar si solo querés ocultarla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminandoEnCurso}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={eliminandoEnCurso}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminarUnidad();
              }}
            >
              {eliminandoEnCurso ? <Loader2 className="size-4 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** @deprecated Usar `GestionCatalogosOperativos`. */
export const GestionUnidadesSebin = GestionCatalogosOperativos;
