// Bandeja de identificaciones de terreno (`/usuarios/terreno`, admin y
// analista SAE). Fase A del plan de identidad (decisión (b) del 16-jul):
// los operadores que se identifican con cédula entran a trabajar de una vez
// y los analistas los aprueban (o rechazan) a posteriori desde aquí. Un
// rechazo bloquea el próximo login por cédula (check en `login-terreno`).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BellOff,
  Check,
  IdCard,
  Loader2,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { desuscribirCampamentoTerreno } from "@/data/desuscribirTerreno";
import { supabase } from "@/data/supabaseClient";
import { registrarHistorial } from "@/data/historial";
import {
  desvincularTelegram,
  vinculosTelegramDeUsuarios,
  type VinculoTelegram,
} from "@/data/telegramOperador";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { metaUnidadSebinCentro } from "@/domain/centrosTransitorios";
import { metaCuerpoDe } from "@/domain/cuerposPoliciales";
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
import { Input } from "@/components/ui/input";
import { PaginadorTabla } from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VistaPagina } from "@/components/VistaPagina";
import { EstadoVacio, LoadingTable } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { etiquetaCentro } from "./TarjetaUsuario";

const FILAS_POR_PAGINA = 50;

type ConfirmDesuscribir =
  | { userId: string; nombre: string; centroId: string | null; etiqueta: string }
  | null;

type ConfirmDesvincularTg =
  | { userId: string; nombre: string; username: string | null; tgUser: string | null }
  | null;

interface OperadorFila {
  user_id: string;
  username: string | null;
  nombre: string | null;
  jerarquia: string | null;
  responsabilidad: string | null;
  cedula: string | null;
  cedula_norm: string | null;
  verificado_nexus: boolean | null;
  aprobacion: "pendiente" | "aprobada" | "rechazada" | null;
  aprobacion_por: string | null;
  aprobacion_ts: number | null;
  centros_asignados: string[] | null;
  /** Campamentos con alertas Telegram silenciadas (sigue asignado). */
  alertas_silenciadas: string[] | null;
  created_at?: string;
}

type Filtro = "pendientes" | "aprobados" | "rechazados" | "todos";

function fechaCorta(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
}

function coincideBusqueda(
  o: OperadorFila,
  q: string,
  etiquetasCentros: Map<string, string>,
): boolean {
  if (!q) return true;
  const haystack = [
    o.nombre,
    o.username,
    o.cedula,
    o.cedula_norm,
    o.jerarquia,
    ...(o.centros_asignados ?? []).flatMap((id) => [id, etiquetasCentros.get(id)]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return haystack.includes(q);
}

/** Contador dentro de una pestaña; `acento` lo resalta (pendientes > 0). */
function ConteoTab({ n, acento = false }: { n: number; acento?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums",
        acento
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-muted-foreground/15 text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = partes[0][0] ?? "";
  const segunda = partes.length > 2 ? partes[2][0] : partes[1]?.[0];
  return `${primera}${segunda ?? ""}`.toUpperCase();
}

export function BandejaOperadoresView({ sesion }: { sesion: Sesion }) {
  const rol = sesion.user.rol;
  const autorizado = rol === "admin" || rol === "analista_sae";
  const [operadores, setOperadores] = useState<OperadorFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [accionando, setAccionando] = useState<string | null>(null);
  const [confirmDesuscribir, setConfirmDesuscribir] = useState<ConfirmDesuscribir>(null);
  const [desuscribiendo, setDesuscribiendo] = useState(false);
  const [avisoSinTelegram, setAvisoSinTelegram] = useState<string | null>(null);
  const [confirmDesvincularTg, setConfirmDesvincularTg] = useState<ConfirmDesvincularTg>(null);
  const [desvinculandoTg, setDesvinculandoTg] = useState(false);
  const [togglingAlertas, setTogglingAlertas] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<Map<string, VinculoTelegram>>(new Map());

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centrosPorId = useMemo(() => {
    const m = new Map<string, CentroFila>();
    for (const c of filasCentros) m.set(c.id, c);
    return m;
  }, [filasCentros]);

  const recargar = useCallback(async () => {
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("perfiles")
        .select(
          "user_id, username, nombre, jerarquia, responsabilidad, cedula, cedula_norm, verificado_nexus, aprobacion, aprobacion_por, aprobacion_ts, centros_asignados, alertas_silenciadas, created_at",
        )
        .eq("rol", "operador")
        .not("cedula_norm", "is", null)
        .order("created_at", { ascending: false });
      if (err) throw new Error(err.message);
      const filas = (data ?? []) as OperadorFila[];
      setOperadores(filas);
      setVinculos(await vinculosTelegramDeUsuarios(filas.map((f) => f.user_id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la bandeja");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!autorizado) return;
    void recargar();
    const canal = supabase
      .channel("perfiles-bandeja-terreno")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "perfiles" },
        () => void recargar(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [autorizado, recargar]);

  const etiquetasCentros = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, c] of centrosPorId) m.set(id, etiquetaCentro(c, id));
    return m;
  }, [centrosPorId]);

  const qNorm = useMemo(
    () =>
      busqueda
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, ""),
    [busqueda],
  );

  const conteos = useMemo(() => {
    const c = { todos: 0, pendientes: 0, aprobados: 0, rechazados: 0 };
    for (const o of operadores) {
      if (!coincideBusqueda(o, qNorm, etiquetasCentros)) continue;
      c.todos++;
      if (o.aprobacion === "pendiente") c.pendientes++;
      else if (o.aprobacion === "aprobada") c.aprobados++;
      else if (o.aprobacion === "rechazada") c.rechazados++;
    }
    return c;
  }, [operadores, qNorm, etiquetasCentros]);

  const filtrados = useMemo(() => {
    const porEstado =
      filtro === "todos"
        ? operadores
        : operadores.filter((o) => {
            const estado =
              filtro === "pendientes"
                ? "pendiente"
                : filtro === "aprobados"
                  ? "aprobada"
                  : "rechazada";
            return o.aprobacion === estado;
          });
    if (!qNorm) return porEstado;
    return porEstado.filter((o) => coincideBusqueda(o, qNorm, etiquetasCentros));
  }, [operadores, filtro, qNorm, etiquetasCentros]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / FILAS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = useMemo(() => {
    const inicio = paginaSegura * FILAS_POR_PAGINA;
    return filtrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [filtrados, paginaSegura]);

  useEffect(() => {
    setPagina(0);
  }, [filtro, busqueda]);

  async function resolver(operador: OperadorFila, decision: "aprobada" | "rechazada") {
    setAccionando(operador.user_id);
    setError("");
    try {
      const { error: err } = await supabase
        .from("perfiles")
        .update({
          aprobacion: decision,
          aprobacion_por: sesion.user.username,
          aprobacion_ts: Date.now(),
        })
        .eq("user_id", operador.user_id);
      if (err) throw new Error(err.message);
      registrarHistorial(
        decision === "aprobada" ? "aprobar_identificacion" : "rechazar_identificacion",
        "usuario",
        operador.user_id,
        {
          username: operador.username,
          nombre: operador.nombre,
          cedula: operador.cedula,
          verificado_nexus: operador.verificado_nexus === true,
        },
      );
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la decisión");
    } finally {
      setAccionando(null);
    }
  }

  async function confirmarDesuscribir() {
    if (!confirmDesuscribir) return;
    setDesuscribiendo(true);
    setError("");
    try {
      await desuscribirCampamentoTerreno({
        centroId: confirmDesuscribir.centroId,
        userId: confirmDesuscribir.userId,
      });
      setConfirmDesuscribir(null);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desuscribir");
    } finally {
      setDesuscribiendo(false);
    }
  }

  async function confirmarDesvincularTg() {
    if (!confirmDesvincularTg) return;
    setDesvinculandoTg(true);
    setError("");
    try {
      await desvincularTelegram({
        userId: confirmDesvincularTg.userId,
        username: confirmDesvincularTg.username,
      });
      setConfirmDesvincularTg(null);
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desvincular Telegram");
    } finally {
      setDesvinculandoTg(false);
    }
  }

  /** Activa/silencia alertas Telegram de un campamento (requiere vínculo). */
  async function toggleAlertasCampamento(operador: OperadorFila, centroId: string) {
    if (!vinculos.has(operador.user_id)) {
      setAvisoSinTelegram(operador.nombre || operador.username || "Este operador");
      return;
    }
    const clave = `${operador.user_id}:${centroId}`;
    setTogglingAlertas(clave);
    setError("");
    try {
      const actuales = new Set(operador.alertas_silenciadas ?? []);
      if (actuales.has(centroId)) actuales.delete(centroId);
      else actuales.add(centroId);
      const { error: err } = await supabase
        .from("perfiles")
        .update({ alertas_silenciadas: [...actuales] })
        .eq("user_id", operador.user_id);
      if (err) throw new Error(err.message);
      registrarHistorial("toggle_alertas_campamento", "usuario", operador.user_id, {
        centro_id: centroId,
        silenciado: actuales.has(centroId),
        username: operador.username,
      });
      await recargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar las alertas");
    } finally {
      setTogglingAlertas(null);
    }
  }

  if (!autorizado) {
    return (
      <VistaPagina
        icono={IdCard}
        titulo="Usuarios de Campo"
        descripcion="Solo administración y analistas SAE pueden revisar esta bandeja."
      >
        <EstadoVacio titulo="Sin acceso" descripcion="Su rol no puede revisar identificaciones." />
      </VistaPagina>
    );
  }

  return (
    <VistaPagina
      icono={IdCard}
      titulo="Usuarios de Campo"
      descripcion="Operadores que se identificaron con su cédula desde el QR del campamento. Apruebe o rechace la identidad; desuscriba de un campamento si no debe seguir recibiendo alertas de ese centro."
      encabezadoDebajo={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={filtro}
            onValueChange={(v) => setFiltro(v as Filtro)}
            className="min-w-0"
          >
            <TabsList
              variant="line"
              className="h-9 max-w-full flex-nowrap justify-start overflow-x-auto p-0"
            >
              <TabsTrigger value="todos" className="shrink-0 gap-1.5 px-3">
                Todos
                <ConteoTab n={conteos.todos} />
              </TabsTrigger>
              <TabsTrigger value="pendientes" className="shrink-0 gap-1.5 px-3">
                Pendientes
                <ConteoTab n={conteos.pendientes} acento={conteos.pendientes > 0} />
              </TabsTrigger>
              <TabsTrigger value="aprobados" className="shrink-0 gap-1.5 px-3">
                Aprobados
                <ConteoTab n={conteos.aprobados} />
              </TabsTrigger>
              <TabsTrigger value="rechazados" className="shrink-0 gap-1.5 px-3">
                Rechazados
                <ConteoTab n={conteos.rechazados} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full shrink-0 lg:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, cédula o campamento…"
              className="h-9 pl-9"
              aria-label="Buscar operadores"
            />
          </div>
        </div>
      }
    >
      {error && <p className="px-4 pt-3 text-xs text-destructive lg:px-6">{error}</p>}

      {cargando ? (
        <div className="p-4 lg:p-6">
          <LoadingTable rows={5} cols={3} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-4 lg:p-6">
          <EstadoVacio
            titulo={
              qNorm
                ? "Sin coincidencias"
                : filtro === "pendientes"
                  ? "Sin identificaciones pendientes"
                  : "Nada que mostrar"
            }
            descripcion={
              qNorm
                ? `Ningún operador coincide con «${busqueda.trim()}».`
                : filtro === "pendientes"
                  ? "Cuando un operador nuevo se identifique con su cédula aparecerá aquí."
                  : "No hay operadores en este estado."
            }
          />
        </div>
      ) : (
        <>
        <ul className="divide-y divide-border/70">
          {visibles.map((o) => {
            const pendiente = o.aprobacion === "pendiente";
            return (
              <li
                key={o.user_id}
                className={cn(
                  "space-y-3 border-l-2 border-l-transparent px-4 py-4 lg:px-6",
                  pendiente && "border-l-amber-500/60",
                )}
              >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                          aria-hidden
                        >
                          {iniciales(o.nombre || o.username || "?")}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold leading-tight">
                              {o.nombre || o.username}
                            </p>
                            {pendiente ? (
                              <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
                                Pendiente
                              </Badge>
                            ) : o.aprobacion === "aprobada" ? (
                              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                <Check className="size-3" /> Aprobado
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Rechazado</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{o.cedula || o.cedula_norm}</span>
                            {o.jerarquia ? ` · ${o.jerarquia}` : ""}
                            {o.created_at ? ` · identificado el ${fechaCorta(o.created_at)}` : ""}
                            {!pendiente && o.aprobacion_por ? ` · revisado por ${o.aprobacion_por}` : ""}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {o.verificado_nexus ? (
                              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                <BadgeCheck className="size-3" /> Identidad verificada
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                <ShieldAlert className="size-3" /> Sin verificar
                              </Badge>
                            )}
                            {vinculos.has(o.user_id) ? (
                              <span className="inline-flex items-center gap-1">
                                <Badge variant="outline" className="gap-1 border-sky-500/50 text-sky-600 dark:text-sky-400">
                                  <Send className="size-3" />
                                  {vinculos.get(o.user_id)?.telegram_username
                                    ? `@${vinculos.get(o.user_id)?.telegram_username}`
                                    : "Telegram"}
                                </Badge>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                                      disabled={desvinculandoTg}
                                      aria-label="Desvincular Telegram"
                                      onClick={() =>
                                        setConfirmDesvincularTg({
                                          userId: o.user_id,
                                          nombre: o.nombre || o.username || "operador",
                                          username: o.username,
                                          tgUser:
                                            vinculos.get(o.user_id)?.telegram_username ?? null,
                                        })
                                      }
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Desvincular Telegram de este operador
                                  </TooltipContent>
                                </Tooltip>
                              </span>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <Send className="size-3" /> Telegram pendiente
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2 sm:pl-4">
                        {pendiente ? (
                          <>
                            <Button
                              size="sm"
                              disabled={accionando === o.user_id}
                              onClick={() => void resolver(o, "aprobada")}
                            >
                              {accionando === o.user_id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Check className="size-4" />
                              )}
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive"
                              disabled={accionando === o.user_id}
                              onClick={() => void resolver(o, "rechazada")}
                            >
                              <X className="size-4" />
                              Rechazar
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={accionando === o.user_id}
                            onClick={() =>
                              void resolver(o, o.aprobacion === "aprobada" ? "rechazada" : "aprobada")
                            }
                          >
                            {accionando === o.user_id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            {o.aprobacion === "aprobada" ? "Rechazar" : "Aprobar"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {(o.centros_asignados?.length ?? 0) > 0 && (
                      <div className="border-t border-border pt-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                            Campamentos asignados ({o.centros_asignados?.length})
                          </p>
                          {(o.centros_asignados?.length ?? 0) > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive"
                              disabled={accionando === o.user_id || desuscribiendo}
                              onClick={() =>
                                setConfirmDesuscribir({
                                  userId: o.user_id,
                                  nombre: o.nombre || o.username || "operador",
                                  centroId: null,
                                  etiqueta: "todos los campamentos",
                                })
                              }
                            >
                              <Trash2 className="size-3.5" />
                              Quitar de todos
                            </Button>
                          )}
                        </div>
                        <ul className="grid gap-1.5 xl:grid-cols-2">
                            {(o.centros_asignados ?? []).map((id) => {
                              const centro = centrosPorId.get(id);
                              const etiqueta = centro ? etiquetaCentro(centro, id) : id;
                              const cuerpo = metaCuerpoDe(centro?.cuerpo).label;
                              const unidad = centro
                                ? metaUnidadSebinCentro(centro).label
                                : "—";
                              const telegramOk = vinculos.has(o.user_id);
                              const tgUser = vinculos.get(o.user_id)?.telegram_username;
                              const silenciado = (o.alertas_silenciadas ?? []).includes(id);
                              const alertasOn = telegramOk && !silenciado;
                              const togglingKey = `${o.user_id}:${id}`;
                              return (
                                <li
                                  key={id}
                                  className="flex items-start gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-medium leading-tight">
                                      {etiqueta}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                                      Cuerpo responsable del centro:{" "}
                                      <span className="text-foreground/80">{cuerpo || "—"}</span>
                                      {" · "}
                                      Revista SEBIN:{" "}
                                      <span className="text-foreground/80">{unidad || "—"}</span>
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className={cn(
                                            "size-8",
                                            alertasOn
                                              ? "border-sky-500/50 text-sky-600 dark:text-sky-400"
                                              : "text-muted-foreground",
                                          )}
                                          disabled={
                                            togglingAlertas === togglingKey || desuscribiendo
                                          }
                                          aria-label={
                                            alertasOn
                                              ? "Alertas activas — clic para silenciar"
                                              : telegramOk
                                                ? "Alertas silenciadas — clic para activar"
                                                : "Sin Telegram — no recibe alertas"
                                          }
                                          aria-pressed={alertasOn}
                                          onClick={() => void toggleAlertasCampamento(o, id)}
                                        >
                                          {togglingAlertas === togglingKey ? (
                                            <Loader2 className="size-3.5 animate-spin" />
                                          ) : alertasOn ? (
                                            <Bell className="size-3.5" />
                                          ) : (
                                            <BellOff className="size-3.5" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-56">
                                        {!telegramOk
                                          ? "Sin Telegram vinculado: no recibe alertas. Clic para más info."
                                          : alertasOn
                                            ? `Alertas activas${tgUser ? ` (@${tgUser})` : ""}. Clic para silenciar este campamento.`
                                            : "Alertas silenciadas. Clic para volver a activarlas."}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className="size-8 text-destructive"
                                          disabled={accionando === o.user_id || desuscribiendo}
                                          aria-label={`Quitar ${etiqueta}`}
                                          onClick={() =>
                                            setConfirmDesuscribir({
                                              userId: o.user_id,
                                              nombre: o.nombre || o.username || "operador",
                                              centroId: id,
                                              etiqueta,
                                            })
                                          }
                                        >
                                          <Trash2 className="size-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        Quitar este campamento del operador
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    )}
              </li>
            );
          })}
        </ul>
        <PaginadorTabla
          pagina={paginaSegura}
          totalPaginas={totalPaginas}
          totalFilas={filtrados.length}
          filasPorPagina={FILAS_POR_PAGINA}
          cargando={cargando}
          onPagina={setPagina}
          className="border-t border-border/70 px-4 py-3 lg:px-6"
        />
        </>
      )}

      <AlertDialog
        open={avisoSinTelegram != null}
        onOpenChange={(abierto) => !abierto && setAvisoSinTelegram(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sin Telegram vinculado</AlertDialogTitle>
            <AlertDialogDescription>
              {avisoSinTelegram} no tiene Telegram vinculado, así que no puede
              recibir alertas ni recordatorios. Debe vincularlo desde el portal
              /terreno (botón «Vincular Telegram»). Luego podrá activar o
              silenciar alertas por campamento con la campanita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAvisoSinTelegram(null)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDesvincularTg != null}
        onOpenChange={(abierto) =>
          !abierto && !desvinculandoTg && setConfirmDesvincularTg(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desvincular Telegram de {confirmDesvincularTg?.nombre}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDesvincularTg?.tgUser
                ? `Se elimina el vínculo con @${confirmDesvincularTg.tgUser}. `
                : "Se elimina el vínculo con su chat de Telegram. "}
              El operador deja de recibir alertas de seguridad y recordatorios
              de partes. Podrá volver a vincularse desde /terreno cuando
              quiera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desvinculandoTg}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={desvinculandoTg}
              onClick={(e) => {
                e.preventDefault();
                void confirmarDesvincularTg();
              }}
            >
              {desvinculandoTg ? <Loader2 className="size-4 animate-spin" /> : null}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDesuscribir != null}
        onOpenChange={(abierto) =>
          !abierto && !desuscribiendo && setConfirmDesuscribir(null)
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Quitar a {confirmDesuscribir?.nombre} de{" "}
              {confirmDesuscribir?.etiqueta}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El operador pierde ese campamento: deja de poder reportarlo y deja
              de recibir alertas de ese centro. Su identidad no se borra; puede
              volver a entrar con el QR e identificarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desuscribiendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={desuscribiendo}
              onClick={(e) => {
                e.preventDefault();
                void confirmarDesuscribir();
              }}
            >
              {desuscribiendo ? <Loader2 className="size-4 animate-spin" /> : null}
              Quitar campamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VistaPagina>
  );
}
