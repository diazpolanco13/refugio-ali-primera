// Bitácora de acciones (`/logs`): lista cronológica de la tabla `historial`
// con filtros por entidad, usuario y rango de fechas. Acceso solo para
// `admin` (control total) y `autoridad` (solo lectura); la RLS de la tabla
// devuelve vacío para cualquier otro rol. Se actualiza en vivo (Realtime).

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ClipboardCheck,
  FilterX,
  KeyRound,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  Siren,
  Trash2,
  UserRound,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useHistorial, type EntradaHistorial } from "@/data/historial";
import { puedeVerLogs } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VistaPagina } from "@/components/VistaPagina";
import { LoadingList } from "@/components/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Metadatos de presentación por acción (icono, etiqueta y color). */
const META_ACCION: Record<
  string,
  { label: string; icono: typeof Plus; clase: string }
> = {
  crear_centro: { label: "Creó campamento", icono: Plus, clase: "text-emerald-400" },
  editar_centro: { label: "Editó campamento", icono: Pencil, clase: "text-sky-400" },
  eliminar_centro: { label: "Eliminó campamento", icono: Trash2, clase: "text-red-400" },
  abrir_incidencia: { label: "Abrió incidencia", icono: Siren, clase: "text-amber-400" },
  editar_incidencia: { label: "Editó incidencia", icono: Pencil, clase: "text-sky-400" },
  resolver_incidencia: {
    label: "Resolvió incidencia",
    icono: ClipboardCheck,
    clase: "text-emerald-400",
  },
  eliminar_incidencia: { label: "Eliminó incidencia", icono: Trash2, clase: "text-red-400" },
  reporte_diario: {
    label: "Reporte diario",
    icono: ClipboardCheck,
    clase: "text-sky-400",
  },
  crear_usuario: { label: "Creó usuario", icono: UserRound, clase: "text-emerald-400" },
  eliminar_usuario: { label: "Eliminó usuario", icono: Trash2, clase: "text-red-400" },
  cambiar_password: {
    label: "Cambió contraseña",
    icono: KeyRound,
    clase: "text-amber-400",
  },
  editar_perfil_propio: {
    label: "Editó su perfil",
    icono: UserRound,
    clase: "text-sky-400",
  },
  registrar_refugiado: {
    label: "Registró damnificado",
    icono: Plus,
    clase: "text-emerald-400",
  },
  editar_refugiado: {
    label: "Editó damnificado",
    icono: Pencil,
    clase: "text-sky-400",
  },
  egreso_refugiado: {
    label: "Egreso de damnificado",
    icono: ClipboardCheck,
    clase: "text-amber-400",
  },
};

const ETIQUETA_ENTIDAD: Record<string, string> = {
  centro: "Campamento",
  incidencia: "Incidencia",
  reporte: "Reporte diario",
  usuario: "Usuario",
  refugiado: "Damnificado",
  alojamiento: "Alojamiento",
};

type FiltroRango = "hoy" | "7d" | "30d" | "todo";

const RANGOS: { valor: FiltroRango; label: string }[] = [
  { valor: "hoy", label: "Hoy" },
  { valor: "7d", label: "Últimos 7 días" },
  { valor: "30d", label: "Últimos 30 días" },
  { valor: "todo", label: "Todo" },
];

function inicioDeRango(rango: FiltroRango): number | undefined {
  const ahora = new Date();
  switch (rango) {
    case "hoy":
      return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    case "7d":
      return ahora.getTime() - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return ahora.getTime() - 30 * 24 * 60 * 60 * 1000;
    case "todo":
      return undefined;
  }
}

/** Timestamp → "04-07-2026 14:32". */
function formatearFechaHora(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()} ${d.toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Resumen legible del detalle jsonb de una entrada. */
function resumenDetalle(e: EntradaHistorial): string | null {
  const d = e.detalle;
  if (!d) return null;
  const partes: string[] = [];
  if (typeof d.nombre === "string" && d.nombre) partes.push(d.nombre);
  if (d.nro != null) partes.push(`N.° ${d.nro}`);
  if (typeof d.username === "string" && d.username) partes.push(`@${d.username}`);
  if (typeof d.rol === "string" && d.rol) partes.push(d.rol);
  if (typeof d.etiqueta === "string" && d.etiqueta) partes.push(d.etiqueta);
  if (typeof d.dia === "string" && d.dia) partes.push(d.dia);
  return partes.length > 0 ? partes.join(" · ") : null;
}

function FilaLog({ entrada }: { entrada: EntradaHistorial }) {
  const meta = META_ACCION[entrada.accion] ?? {
    label: entrada.accion,
    icono: ScrollText,
    clase: "text-muted-foreground",
  };
  const Icono = meta.icono;
  const detalle = resumenDetalle(entrada);
  const esCentro = entrada.entidad === "centro" && entrada.entidad_id;

  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/40",
          meta.clase,
        )}
      >
        <Icono className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold text-foreground">{meta.label}</span>
          {entrada.entidad && (
            <Badge variant="outline" className="text-[9px] uppercase text-muted-foreground">
              {ETIQUETA_ENTIDAD[entrada.entidad] ?? entrada.entidad}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {detalle ?? entrada.entidad_id ?? ""}
          {esCentro && (
            <>
              {" · "}
              <Link
                to={`/centro/${entrada.entidad_id}`}
                className="text-primary hover:underline"
              >
                ver campamento
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-medium text-foreground">
          {entrada.usuario ?? "—"}
        </p>
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {formatearFechaHora(entrada.ts)}
        </p>
      </div>
    </li>
  );
}

export function LogsView({ sesion }: { sesion: Sesion }) {
  const tieneAcceso = puedeVerLogs(sesion.user.rol);
  const [rango, setRango] = useState<FiltroRango>("7d");
  const [entidad, setEntidad] = useState<string>("todas");
  const [usuario, setUsuario] = useState<string>("todos");

  const desdeTs = useMemo(() => inicioDeRango(rango), [rango]);
  const { entradas, cargando } = useHistorial({ desdeTs });

  const usuarios = useMemo(
    () =>
      [...new Set(entradas.map((e) => e.usuario).filter((u): u is string => Boolean(u)))].sort(),
    [entradas],
  );
  const entidades = useMemo(
    () =>
      [...new Set(entradas.map((e) => e.entidad).filter((x): x is string => Boolean(x)))].sort(),
    [entradas],
  );

  const visibles = useMemo(
    () =>
      entradas.filter(
        (e) =>
          (entidad === "todas" || e.entidad === entidad) &&
          (usuario === "todos" || e.usuario === usuario),
      ),
    [entradas, entidad, usuario],
  );

  const hayFiltros = entidad !== "todas" || usuario !== "todos" || rango !== "7d";

  return (
    <VistaPagina
      icono={ScrollText}
      acento="amber"
      titulo="Bitácora de acciones"
      descripcion="Registro cronológico de cambios en campamentos, incidencias y usuarios"
      cuerpoClassName="p-4 lg:p-6"
    >
        {!tieneAcceso ? (
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
            <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Acceso restringido</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo el administrador y la autoridad pueden consultar la bitácora.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={rango} onValueChange={(v) => setRango(v as FiltroRango)}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGOS.map((r) => (
                    <SelectItem key={r.valor} value={r.valor}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={entidad} onValueChange={setEntidad}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las entidades</SelectItem>
                  {entidades.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ETIQUETA_ENTIDAD[e] ?? e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={usuario} onValueChange={setUsuario}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder="Usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {usuarios.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hayFiltros && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => {
                    setRango("7d");
                    setEntidad("todas");
                    setUsuario("todos");
                  }}
                >
                  <FilterX className="size-3.5" />
                  Limpiar
                </Button>
              )}

              <span className="ml-auto text-xs text-muted-foreground">
                {visibles.length} registro{visibles.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Lista */}
            {cargando ? (
              <LoadingList count={8} />
            ) : visibles.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <Building2 className="mx-auto mb-2 size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Sin registros en el rango seleccionado.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {visibles.map((e) => (
                  <FilaLog key={e.id} entrada={e} />
                ))}
              </ul>
            )}
          </div>
        )}
    </VistaPagina>
  );
}
