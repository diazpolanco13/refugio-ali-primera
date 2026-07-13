// Formulario móvil del directorio de autoridades en /terreno: Ente encargado,
// Política, Seguridad, Salud y Justicia (sin Supervisión).

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { CamposResponsableCoordinacion } from "@/features/centros/DialogoResponsableCoordinacion";
import { AccionesContacto } from "@/components/AccionesContacto";
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { asegurarSesionTerreno } from "@/data/loginTerreno";
import { guardarCentro, obtenerCentroPorId } from "@/data/reposSupabase";
import { normalizarCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_AUTORIDADES_TERRENO,
  ETIQUETA_SUBTIPO,
  PESTANAS_AUTORIDADES_TERRENO,
  asegurarIdsResponsablesCoordinacion,
  metaCategoriaCoordinacion,
  normalizarResponsableCoordinacion,
  prepararResponsablesCoordinacionParaGuardar,
  responsableCoordinacionTieneDatos,
  responsableCoordinacionVacio,
  responsablesCoordinacionDeCentro,
  syncCentroDesdeCoordinacion,
  type IdPestanaCoordinacion,
  type ResponsableCoordinacion,
} from "@/domain/coordinacionCentro";
import { centroTieneAutoridadesTerreno } from "@/lib/autoridadesTerreno";
import { conActualizacionTerreno } from "@/lib/terrenoActualizacion";
import { cn } from "@/lib/utils";

/** Asegura al menos un campo de teléfono vacío en el formulario de edición. */
function conTelefonoEditable(r: ResponsableCoordinacion): ResponsableCoordinacion {
  return r.telefonos.length > 0 ? r : { ...r, telefonos: [""] };
}

const SET_CATEGORIAS_TERRENO = new Set<string>(CATEGORIAS_AUTORIDADES_TERRENO);

function etiquetaAgregar(pestanaId: IdPestanaCoordinacion): string {
  switch (pestanaId) {
    case "politica":
      return "Agregar responsable político";
    case "seguridad":
      return "Agregar responsable de seguridad";
    case "salud":
      return "Agregar responsable de salud";
    case "justicia":
      return "Agregar responsable de justicia";
    case "comunitaria":
      return "Agregar ente encargado";
    default:
      return "Agregar responsable";
  }
}

interface Props {
  centroId: string;
  centroNombre: string;
  token: string;
  /** Recibe si el directorio quedó con datos reales tras guardar. */
  onGuardado?: (tieneDirectorio: boolean, actualizadoAt: number) => void;
}

type Vista = "lista" | "formulario";

export function AutoridadesTerrenoPanel({
  centroId,
  centroNombre,
  token,
  onGuardado,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [centro, setCentro] = useState<CentroTransitorio | null>(null);
  const [responsables, setResponsables] = useState<ResponsableCoordinacion[]>([]);
  const [sinAutoridad, setSinAutoridad] = useState<string[]>([]);
  const [pestana, setPestana] = useState<IdPestanaCoordinacion>("comunitaria");
  const [vista, setVista] = useState<Vista>("lista");
  const [borrador, setBorrador] = useState<ResponsableCoordinacion | null>(null);
  const [guardando, setGuardando] = useState(false);
  /** Responsable pendiente de confirmar eliminación (AlertDialog). */
  const [aEliminar, setAEliminar] = useState<ResponsableCoordinacion | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError("");
    (async () => {
      try {
        if (token) await asegurarSesionTerreno(token, centroId);
        const fila = await obtenerCentroPorId(centroId);
        if (cancelado) return;
        if (!fila) {
          setError("No se pudo cargar el campamento. Verifique el enlace o su sesión.");
          return;
        }
        const norm = normalizarCentro(fila);
        setCentro(norm);
        setResponsables(responsablesCoordinacionDeCentro(norm));
        setSinAutoridad(norm.ambitos_sin_autoridad);
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo preparar el directorio. Intente de nuevo.",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [centroId, token]);

  const pestanaMeta = PESTANAS_AUTORIDADES_TERRENO.find((p) => p.id === pestana)!;
  const categoriaActiva = pestanaMeta.categorias[0];
  const ambitoSinAutoridad = sinAutoridad.includes(categoriaActiva);
  const textoAgregar = etiquetaAgregar(pestana);

  const delAmbito = useMemo(
    () =>
      responsables.filter(
        (r) =>
          responsableCoordinacionTieneDatos(r) &&
          pestanaMeta.categorias.includes(r.categoria),
      ),
    [responsables, pestanaMeta],
  );

  const conteos = useMemo(() => {
    const map = Object.fromEntries(
      PESTANAS_AUTORIDADES_TERRENO.map((p) => [p.id, 0]),
    ) as Record<IdPestanaCoordinacion, number>;
    for (const r of responsables.filter(responsableCoordinacionTieneDatos)) {
      if (!SET_CATEGORIAS_TERRENO.has(r.categoria)) continue;
      const p = PESTANAS_AUTORIDADES_TERRENO.find((x) => x.categorias.includes(r.categoria));
      if (p) map[p.id] += 1;
    }
    return map;
  }, [responsables]);

  function abrirNuevo() {
    setBorrador(responsableCoordinacionVacio(categoriaActiva));
    setError("");
    setVista("formulario");
  }

  function abrirEditar(r: ResponsableCoordinacion) {
    setBorrador(conTelefonoEditable(normalizarResponsableCoordinacion(r)));
    setError("");
    setVista("formulario");
  }

  function cancelarFormulario() {
    if (guardando) return;
    setVista("lista");
    setBorrador(null);
    setError("");
  }

  async function persistir(
    lista: ResponsableCoordinacion[],
    ambitosSin: string[] = sinAutoridad,
  ) {
    if (!centro) return false;
    const prevCentro = centro;
    const prevResponsables = responsables;
    const prevSinAutoridad = sinAutoridad;

    const preparada = prepararResponsablesCoordinacionParaGuardar(
      asegurarIdsResponsablesCoordinacion(lista),
    );
    const sync = syncCentroDesdeCoordinacion(centro, preparada);
    const ahora = Date.now();
    const siguiente: CentroTransitorio = {
      ...centro,
      responsables_coordinacion: preparada,
      ambitos_sin_autoridad: ambitosSin,
      personal: sync.personal,
      servicios: sync.servicios,
      terreno_actualizado: conActualizacionTerreno(centro.terreno_actualizado, "autoridades", ahora),
    };

    // Optimista: la lista se actualiza al instante; si falla el upsert, se revierte.
    setCentro(siguiente);
    setResponsables(preparada);
    setSinAutoridad(ambitosSin);
    setGuardando(true);
    setError("");
    try {
      await guardarCentro(siguiente);
      onGuardado?.(centroTieneAutoridadesTerreno(siguiente), ahora);
      return true;
    } catch (err) {
      setCentro(prevCentro);
      setResponsables(prevResponsables);
      setSinAutoridad(prevSinAutoridad);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar. Intente de nuevo.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function guardarBorrador() {
    if (!borrador || !borrador.nombre.trim()) {
      setError("Indique al menos el nombre del responsable.");
      return;
    }
    const normalizado = normalizarResponsableCoordinacion(borrador);
    const existe = responsables.some((r) => r.id === normalizado.id);
    const lista = existe
      ? responsables.map((r) => (r.id === normalizado.id ? normalizado : r))
      : [...responsables, normalizado];
    // Al registrar alguien, ese ámbito deja de estar «sin autoridades».
    const ambitosSin = sinAutoridad.filter((c) => c !== normalizado.categoria);
    // Volver a la lista de inmediato (estado optimista ya pintado en persistir).
    setVista("lista");
    setBorrador(null);
    setPestana(
      PESTANAS_AUTORIDADES_TERRENO.find((p) => p.categorias.includes(normalizado.categoria))
        ?.id ?? "comunitaria",
    );
    const ok = await persistir(lista, ambitosSin);
    if (!ok) {
      // Si falló, reabrir el formulario con lo que el usuario había escrito.
      setBorrador(conTelefonoEditable(normalizado));
      setVista("formulario");
    }
  }

  async function confirmarEliminar() {
    if (!aEliminar || guardando) return;
    const id = aEliminar.id;
    const ok = await persistir(responsables.filter((r) => r.id !== id));
    if (ok) setAEliminar(null);
  }

  async function marcarSinAutoridades() {
    const cats = pestanaMeta.categorias;
    const lista = responsables.filter((r) => !cats.includes(r.categoria));
    const ambitosSin = [...new Set([...sinAutoridad, ...cats])];
    await persistir(lista, ambitosSin);
  }

  async function desmarcarSinAutoridades() {
    const cats = new Set<string>(pestanaMeta.categorias);
    const ambitosSin = sinAutoridad.filter((c) => !cats.has(c));
    await persistir(responsables, ambitosSin);
  }

  if (cargando) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 shadow-lg">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando autoridades…</p>
      </Card>
    );
  }

  if (error && !centro) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col shadow-lg">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <Landmark className="size-10 text-muted-foreground" />
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (vista === "formulario" && borrador) {
    const esEdicion = responsables.some((r) => r.id === borrador.id);
    return (
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
        <CardHeader className="shrink-0 space-y-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelarFormulario}
              aria-label="Volver a la lista"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="min-w-0">
              <CardTitle className="text-base">
                {esEdicion ? "Editar responsable" : "Nuevo responsable"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{centroNombre}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
          <CamposResponsableCoordinacion
            valor={borrador}
            categoriasPermitidas={CATEGORIAS_AUTORIDADES_TERRENO}
            onChange={(patch) => setBorrador((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="shrink-0 flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full border border-border font-semibold sm:flex-1"
            disabled={guardando}
            onClick={cancelarFormulario}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 w-full gap-2 sm:flex-1"
            disabled={guardando || !borrador.nombre.trim()}
            onClick={() => void guardarBorrador()}
          >
            {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
            {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Registrar"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 space-y-3 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="size-4 text-primary" />
            Autoridades de {centroNombre}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Ente encargado, Política, Seguridad, Salud y Justicia.
          </p>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {PESTANAS_AUTORIDADES_TERRENO.map((p) => {
            const activa = p.id === pestana;
            const n = conteos[p.id] ?? 0;
            const marcadoVacio = p.categorias.some((c) => sinAutoridad.includes(c));
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestana(p.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  activa
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {p.labelCorto}
                {n > 0 ? (
                  <span
                    className={cn(
                      "inline-flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                      activa ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    {n}
                  </span>
                ) : marcadoVacio ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: pestanaMeta.color }}>
            {pestanaMeta.label}
          </p>
          {delAmbito.length > 0 && (
            <Button type="button" size="sm" className="h-8 gap-1.5" onClick={abrirNuevo}>
              <Plus className="size-3.5" />
              {textoAgregar}
            </Button>
          )}
        </div>

        {delAmbito.length === 0 && ambitoSinAutoridad ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-8 text-center">
            <CheckCircle2 className="size-8 text-emerald-500" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                Sin autoridades asignadas
              </p>
              <p className="max-w-xs text-xs leading-snug text-muted-foreground">
                Quedó registrado que este ámbito no tiene responsables en el campamento.
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Button
                type="button"
                className="h-10 w-full gap-1.5"
                disabled={guardando}
                onClick={abrirNuevo}
              >
                <Plus className="size-4" />
                {textoAgregar}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full border border-border font-medium"
                disabled={guardando}
                onClick={() => void desmarcarSinAutoridades()}
              >
                {guardando ? "Guardando…" : "Deshacer marca"}
              </Button>
            </div>
          </div>
        ) : delAmbito.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Landmark className="size-8 text-muted-foreground/60" />
            <p className="max-w-xs text-xs leading-snug text-muted-foreground">
              Sin datos en {pestanaMeta.labelCorto.toLowerCase()}. Registre un responsable o
              confirme que no hay autoridades en este ámbito.
            </p>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Button
                type="button"
                className="h-11 w-full gap-1.5"
                disabled={guardando}
                onClick={abrirNuevo}
              >
                <Plus className="size-4" />
                {textoAgregar}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full gap-1.5 border border-border font-semibold"
                disabled={guardando}
                onClick={() => void marcarSinAutoridades()}
              >
                {guardando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {guardando ? "Guardando…" : "Sin autoridades asignadas"}
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {delAmbito.map((r) => {
              const meta = metaCategoriaCoordinacion(r.categoria);
              const tel = r.telefonos.find((t) => t.trim()) ?? "";
              return (
                <li
                  key={r.id}
                  className="space-y-2 rounded-xl border border-border bg-card px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ETIQUETA_SUBTIPO[r.subtipo]}
                        {r.ente.trim() ? ` · ${r.ente}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px]"
                      style={{ borderColor: `${meta.color}66`, color: meta.color }}
                    >
                      {r.personal_mando} pers.
                    </Badge>
                  </div>
                  {tel && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{tel}</span>
                      <AccionesContacto telefono={tel} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 flex-1 gap-1.5 border border-border font-medium"
                      disabled={guardando}
                      onClick={() => abrirEditar(r)}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 text-destructive hover:text-destructive"
                      disabled={guardando}
                      onClick={() => setAEliminar(r)}
                    >
                      <Trash2 className="size-3.5" />
                      Quitar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>

      <AlertDialog
        open={aEliminar != null}
        onOpenChange={(abierto) => {
          if (!abierto && !guardando) setAEliminar(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar del directorio?</AlertDialogTitle>
            <AlertDialogDescription>
              {aEliminar
                ? `Se eliminará a ${aEliminar.nombre.trim() || "este responsable"} del ámbito ${
                    metaCategoriaCoordinacion(aEliminar.categoria).label
                  }. Puede volver a registrarlo después.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={guardando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminar();
              }}
            >
              {guardando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Quitando…
                </>
              ) : (
                "Quitar"
              )}
            </AlertDialogAction>
            <AlertDialogCancel type="button" disabled={guardando}>
              Cancelar
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
