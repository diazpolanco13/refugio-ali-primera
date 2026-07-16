// Bandeja de identificaciones de terreno (`/usuarios/terreno`, admin y
// analista SAE). Fase A del plan de identidad (decisión (b) del 16-jul):
// los operadores que se identifican con cédula entran a trabajar de una vez
// y los analistas los aprueban (o rechazan) a posteriori desde aquí. Un
// rechazo bloquea el próximo login por cédula (check en `login-terreno`).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  IdCard,
  Loader2,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { supabase } from "@/data/supabaseClient";
import { registrarHistorial } from "@/data/historial";
import {
  vinculosTelegramDeUsuarios,
  type VinculoTelegram,
} from "@/data/telegramOperador";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VistaPagina } from "@/components/VistaPagina";
import { EstadoVacio, LoadingTable } from "@/components/skeletons";
import { etiquetaCentro } from "./TarjetaUsuario";

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

export function BandejaOperadoresView({ sesion }: { sesion: Sesion }) {
  const rol = sesion.user.rol;
  const autorizado = rol === "admin" || rol === "analista_sae";
  const [operadores, setOperadores] = useState<OperadorFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [accionando, setAccionando] = useState<string | null>(null);
  const [vinculos, setVinculos] = useState<Map<string, VinculoTelegram>>(new Map());

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const etiquetasCentros = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of filasCentros) m.set(c.id, etiquetaCentro(c, c.id));
    return m;
  }, [filasCentros]);

  const recargar = useCallback(async () => {
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("perfiles")
        .select(
          "user_id, username, nombre, jerarquia, responsabilidad, cedula, cedula_norm, verificado_nexus, aprobacion, aprobacion_por, aprobacion_ts, centros_asignados, created_at",
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

  const conteos = useMemo(() => {
    const c = { pendientes: 0, aprobados: 0, rechazados: 0 };
    for (const o of operadores) {
      if (o.aprobacion === "pendiente") c.pendientes++;
      else if (o.aprobacion === "aprobada") c.aprobados++;
      else if (o.aprobacion === "rechazada") c.rechazados++;
    }
    return c;
  }, [operadores]);

  const visibles = useMemo(() => {
    if (filtro === "todos") return operadores;
    const estado =
      filtro === "pendientes" ? "pendiente" : filtro === "aprobados" ? "aprobada" : "rechazada";
    return operadores.filter((o) => o.aprobacion === estado);
  }, [operadores, filtro]);

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

  if (!autorizado) {
    return (
      <VistaPagina
        icono={IdCard}
        titulo="Identificaciones de terreno"
        descripcion="Solo administración y analistas SAE pueden revisar esta bandeja."
      >
        <EstadoVacio titulo="Sin acceso" descripcion="Su rol no puede revisar identificaciones." />
      </VistaPagina>
    );
  }

  return (
    <VistaPagina
      icono={IdCard}
      titulo="Identificaciones de terreno"
      descripcion="Operadores que se identificaron con su cédula desde el QR del campamento. Revise que la persona corresponda y apruebe o rechace; el rechazo bloquea su próximo ingreso."
    >
      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <TabsList>
          <TabsTrigger value="pendientes">
            Pendientes{conteos.pendientes > 0 ? ` (${conteos.pendientes})` : ""}
          </TabsTrigger>
          <TabsTrigger value="aprobados">
            Aprobados{conteos.aprobados > 0 ? ` (${conteos.aprobados})` : ""}
          </TabsTrigger>
          <TabsTrigger value="rechazados">
            Rechazados{conteos.rechazados > 0 ? ` (${conteos.rechazados})` : ""}
          </TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {cargando ? (
        <div className="mt-4">
          <LoadingTable rows={5} cols={3} />
        </div>
      ) : visibles.length === 0 ? (
        <div className="mt-4">
          <EstadoVacio
            titulo={
              filtro === "pendientes"
                ? "Sin identificaciones pendientes"
                : "Nada que mostrar"
            }
            descripcion={
              filtro === "pendientes"
                ? "Cuando un operador nuevo se identifique con su cédula aparecerá aquí."
                : "No hay operadores en este estado."
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {visibles.map((o) => {
            const pendiente = o.aprobacion === "pendiente";
            return (
              <li key={o.user_id}>
                <Card>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-tight">
                          {o.nombre || o.username}
                        </p>
                        {o.verificado_nexus ? (
                          <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            <BadgeCheck className="size-3" /> Verificado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
                            <ShieldAlert className="size-3" /> Sin verificar
                          </Badge>
                        )}
                        {o.aprobacion === "aprobada" && (
                          <Badge variant="secondary">Aprobado</Badge>
                        )}
                        {o.aprobacion === "rechazada" && (
                          <Badge variant="destructive">Rechazado</Badge>
                        )}
                        {vinculos.has(o.user_id) ? (
                          <Badge variant="outline" className="gap-1 border-sky-500/50 text-sky-600 dark:text-sky-400">
                            <Send className="size-3" />
                            {vinculos.get(o.user_id)?.telegram_username
                              ? `@${vinculos.get(o.user_id)?.telegram_username}`
                              : "Telegram"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Send className="size-3" /> Telegram pendiente
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{o.cedula || o.cedula_norm}</span>
                        {o.responsabilidad ? ` · ${o.responsabilidad}` : o.jerarquia ? ` · ${o.jerarquia}` : ""}
                        {o.created_at ? ` · identificado el ${fechaCorta(o.created_at)}` : ""}
                      </p>
                      {(o.centros_asignados?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(o.centros_asignados ?? []).map((id) => (
                            <Badge key={id} variant="outline" className="text-[11px]">
                              {etiquetasCentros.get(id) ?? id}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {!pendiente && o.aprobacion_por && (
                        <p className="text-[11px] text-muted-foreground">
                          Revisado por {o.aprobacion_por}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
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
                          variant="ghost"
                          disabled={accionando === o.user_id}
                          onClick={() =>
                            void resolver(o, o.aprobacion === "aprobada" ? "rechazada" : "aprobada")
                          }
                        >
                          {o.aprobacion === "aprobada" ? "Rechazar" : "Aprobar"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </VistaPagina>
  );
}
