// Bandeja de identificaciones de terreno (`/usuarios/terreno`). Fase A del
// plan de identidad (decisión (b) del 16-jul): los operadores que se
// identifican con cédula entran a trabajar de una vez y los analistas los
// aprueban (o rechazan) a posteriori desde aquí. Un rechazo bloquea el
// próximo login por cédula (check en `login-terreno`).
//
// Fase 1a del plan de migración a credencial propia
// (docs/plan-migracion-operadores-password.md §4.3): el supervisor también
// entra, en solo lectura, y ve los operadores de sus campamentos con su
// estado de activación (la RLS `perfiles_select_operadores_terreno` acota
// las filas en el servidor). El resumen de avance por campamento usa
// `activado_ts` (lo escribe la Fase 2; mientras tanto todo sale pendiente).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  BellOff,
  Check,
  IdCard,
  KeyRound,
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
  puedeGestionarOperadores,
  puedeResolverOperadores,
} from "@/domain/permisos";
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

/** La lista se pagina por campamento (cada grupo trae sus operadores). */
const CENTROS_POR_PAGINA = 10;

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
  /** Epoch ms de activación de credencial propia; null = solo entra por QR. */
  activado_ts: number | null;
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
  const autorizado = puedeGestionarOperadores(rol);
  // Supervisor: solo lectura (aprobar/desuscribir/Telegram quedan en la sala;
  // la RLS de `perfiles` además bloquea sus updates en el servidor).
  const puedeResolver = puedeResolverOperadores(rol);
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
          "user_id, username, nombre, jerarquia, responsabilidad, cedula, cedula_norm, verificado_nexus, aprobacion, aprobacion_por, aprobacion_ts, centros_asignados, alertas_silenciadas, activado_ts, created_at",
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

  // Tablero de avance de la migración (§4.3 / §7 del plan): por campamento,
  // cuántos de sus operadores ya activaron credencial propia (`activado_ts`).
  const avancePorCentro = useMemo(() => {
    const m = new Map<string, { total: number; activados: number }>();
    for (const o of operadores) {
      for (const id of o.centros_asignados ?? []) {
        const e = m.get(id) ?? { total: 0, activados: 0 };
        e.total++;
        if (o.activado_ts != null) e.activados++;
        m.set(id, e);
      }
    }
    return [...m.entries()]
      .map(([id, e]) => ({ id, etiqueta: etiquetasCentros.get(id) ?? id, ...e }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  }, [operadores, etiquetasCentros]);
  const totalActivados = useMemo(
    () => operadores.filter((o) => o.activado_ts != null).length,
    [operadores],
  );

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

  // Agrupación por campamento: el rol ve sus centros y, dentro de cada uno,
  // los operadores que reportan ahí (un operador multi-centro aparece en cada
  // grupo). Los operadores sin campamento van a un grupo final propio.
  const grupos = useMemo(() => {
    const porCentro = new Map<string, OperadorFila[]>();
    for (const o of filtrados) {
      const ids = o.centros_asignados?.length ? o.centros_asignados : [""];
      for (const id of ids) {
        const arr = porCentro.get(id) ?? [];
        arr.push(o);
        porCentro.set(id, arr);
      }
    }
    const avance = new Map(avancePorCentro.map((c) => [c.id, c]));
    return [...porCentro.entries()]
      .map(([id, ops]) => {
        const centro = centrosPorId.get(id);
        return {
          id,
          etiqueta: id
            ? centro
              ? etiquetaCentro(centro, id)
              : id
            : "Sin campamento asignado",
          cuerpo: id ? metaCuerpoDe(centro?.cuerpo).label : "",
          unidad: id && centro ? metaUnidadSebinCentro(centro).label : "",
          operadores: ops,
          // Avance sobre TODOS los operadores del centro (sin filtro de pestaña).
          activados: avance.get(id)?.activados ?? 0,
          total: avance.get(id)?.total ?? ops.length,
        };
      })
      .sort((a, b) =>
        a.id === ""
          ? 1
          : b.id === ""
            ? -1
            : a.etiqueta.localeCompare(b.etiqueta, "es"),
      );
  }, [filtrados, centrosPorId, avancePorCentro]);

  const totalPaginas = Math.max(1, Math.ceil(grupos.length / CENTROS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = useMemo(() => {
    const inicio = paginaSegura * CENTROS_POR_PAGINA;
    return grupos.slice(inicio, inicio + CENTROS_POR_PAGINA);
  }, [grupos, paginaSegura]);

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
        descripcion="Solo administración, analistas SAE y supervisores pueden ver esta bandeja."
      >
        <EstadoVacio titulo="Sin acceso" descripcion="Su rol no puede revisar identificaciones." />
      </VistaPagina>
    );
  }

  return (
    <VistaPagina
      icono={IdCard}
      titulo="Usuarios de Campo"
      descripcion={
        puedeResolver
          ? "Operadores que se identificaron con su cédula desde el QR del campamento. Apruebe o rechace la identidad; desuscriba de un campamento si no debe seguir recibiendo alertas de ese centro."
          : "Operadores que reportan en sus campamentos: identidad, vínculo Telegram y avance de activación de su credencial propia (solo lectura)."
      }
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

      {!cargando && operadores.length > 0 && (
        <p className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2 text-xs text-muted-foreground lg:px-6">
          <KeyRound className="size-3.5" aria-hidden />
          Credencial propia activada: {totalActivados}/{operadores.length} operadores
        </p>
      )}

      {cargando ? (
        <div className="p-4 lg:p-6">
          <LoadingTable rows={5} cols={3} />
        </div>
      ) : grupos.length === 0 ? (
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
        <div className="divide-y divide-border/70">
          {visibles.map((g) => (
            <section key={g.id || "sin-campamento"}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/50 px-4 py-2.5 lg:px-6">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{g.etiqueta}</p>
                  {(g.cuerpo || g.unidad) && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Cuerpo responsable:{" "}
                      <span className="text-foreground/80">{g.cuerpo || "—"}</span>
                      {" · "}Revista SEBIN:{" "}
                      <span className="text-foreground/80">{g.unidad || "—"}</span>
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1 font-normal",
                    g.activados === 0
                      ? "text-muted-foreground"
                      : g.activados === g.total
                        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/50 text-amber-600 dark:text-amber-400",
                  )}
                >
                  <KeyRound className="size-3" />
                  {g.activados}/{g.total} con credencial propia
                </Badge>
              </header>
              <ul className="divide-y divide-border/50">
                {g.operadores.map((o) => {
                  const pendiente = o.aprobacion === "pendiente";
                  const enOtros = (o.centros_asignados ?? []).filter((id) => id !== g.id);
                  const telegramOk = vinculos.has(o.user_id);
                  const tgUser = vinculos.get(o.user_id)?.telegram_username;
                  const silenciado = (o.alertas_silenciadas ?? []).includes(g.id);
                  const alertasOn = telegramOk && !silenciado;
                  const togglingKey = `${o.user_id}:${g.id}`;
                  return (
                    <li
                      key={o.user_id}
                      className={cn(
                        "flex flex-col gap-2 border-l-2 border-l-transparent px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6",
                        pendiente && "border-l-amber-500/60",
                      )}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
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
                            {enOtros.length > 0
                              ? ` · también en ${enOtros
                                  .map((id) => etiquetasCentros.get(id) ?? id)
                                  .join(", ")}`
                              : ""}
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
                            {o.activado_ts != null ? (
                              <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                <KeyRound className="size-3" /> Credencial activa
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <KeyRound className="size-3" /> Activación pendiente
                              </Badge>
                            )}
                            {telegramOk ? (
                              <span className="inline-flex items-center gap-1">
                                <Badge variant="outline" className="gap-1 border-sky-500/50 text-sky-600 dark:text-sky-400">
                                  <Send className="size-3" />
                                  {tgUser ? `@${tgUser}` : "Telegram"}
                                </Badge>
                                {puedeResolver && (
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
                                            tgUser: tgUser ?? null,
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
                                )}
                              </span>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-muted-foreground">
                                <Send className="size-3" /> Telegram pendiente
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {puedeResolver && (
                        <div className="flex shrink-0 items-center gap-1.5 sm:pl-4">
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
                          {g.id && (
                            <>
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
                                    disabled={togglingAlertas === togglingKey || desuscribiendo}
                                    aria-label={
                                      alertasOn
                                        ? "Alertas activas — clic para silenciar"
                                        : telegramOk
                                          ? "Alertas silenciadas — clic para activar"
                                          : "Sin Telegram — no recibe alertas"
                                    }
                                    aria-pressed={alertasOn}
                                    onClick={() => void toggleAlertasCampamento(o, g.id)}
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
                                    aria-label={`Quitar de ${g.etiqueta}`}
                                    onClick={() =>
                                      setConfirmDesuscribir({
                                        userId: o.user_id,
                                        nombre: o.nombre || o.username || "operador",
                                        centroId: g.id,
                                        etiqueta: g.etiqueta,
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
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <PaginadorTabla
          pagina={paginaSegura}
          totalPaginas={totalPaginas}
          totalFilas={grupos.length}
          filasPorPagina={CENTROS_POR_PAGINA}
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
