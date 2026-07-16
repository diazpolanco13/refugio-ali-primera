// Bitácora de acciones (`/logs`): lista cronológica de la tabla `historial`
// con filtros por entidad, usuario, campamento y rango de fechas. Acceso solo
// para `admin` (control total) y `autoridad` (solo lectura); la RLS de la tabla
// devuelve vacío para cualquier otro rol. Se actualiza en vivo (Realtime).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Check,
  ChevronsUpDown,
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
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { useHistorial, type EntradaHistorial } from "@/data/historial";
import { useEtiquetaPerfil } from "@/data/useEtiquetaPerfil";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { puedeVerLogs } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PaginadorTabla } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const FILAS_POR_PAGINA = 50;

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

/**
 * Campamento asociado a una entrada. Orden: detalle.centro_id → entidad centro →
 * prefijo de entidad_id (`centro-NN/…`) → username de terreno (`operador-centro-NN-…`).
 */
function centroIdDeEntrada(e: EntradaHistorial): string | null {
  const d = e.detalle;
  if (d && typeof d.centro_id === "string" && d.centro_id.startsWith("centro-")) {
    return d.centro_id;
  }
  if (e.entidad === "centro" && e.entidad_id?.startsWith("centro-")) {
    return e.entidad_id;
  }
  if (e.entidad_id) {
    const m = e.entidad_id.match(/^(centro-\d+)/);
    if (m) return m[1];
  }
  if (e.usuario) {
    const m = e.usuario.match(/^operador-(centro-\d+)-/);
    if (m) return m[1];
  }
  return null;
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

function FilaLog({
  entrada,
  nombreCentro,
}: {
  entrada: EntradaHistorial;
  nombreCentro: string | null;
}) {
  const meta = META_ACCION[entrada.accion] ?? {
    label: entrada.accion,
    icono: ScrollText,
    clase: "text-muted-foreground",
  };
  const Icono = meta.icono;
  const detalle = resumenDetalle(entrada);
  const centroId = centroIdDeEntrada(entrada);
  const esCentro = entrada.entidad === "centro" && entrada.entidad_id;
  const username = entrada.usuario?.trim() || "";
  const etiqueta = useEtiquetaPerfil(username || null);
  const muestraNombre = Boolean(username && etiqueta && etiqueta !== username);

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
          {nombreCentro && !detalle?.includes(nombreCentro) && (
            <>
              {detalle || entrada.entidad_id ? " · " : ""}
              {nombreCentro}
            </>
          )}
          {esCentro && centroId && (
            <>
              {" · "}
              <Link to={`/centro/${centroId}`} className="text-primary hover:underline">
                ver campamento
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="max-w-[14rem] shrink-0 text-right">
        {muestraNombre ? (
          <>
            <p className="text-[11px] font-medium leading-snug text-foreground">{etiqueta}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground" title={username}>
              {username}
            </p>
          </>
        ) : (
          <p className="truncate text-[11px] font-medium text-foreground" title={username || undefined}>
            {username || "—"}
          </p>
        )}
        <p className="text-[10px] tabular-nums text-muted-foreground">
          {formatearFechaHora(entrada.ts)}
        </p>
      </div>
    </li>
  );
}

function etiquetaCentro(c: CentroTransitorio): string {
  const nro = c.nro != null ? `N.° ${c.nro} · ` : "";
  return `${nro}${c.nombre || c.id}`;
}

/** Combobox de campamentos: búsqueda + lista con altura acotada. */
function FiltroCampamento({
  valor,
  centros,
  onCambiar,
}: {
  valor: string;
  centros: CentroTransitorio[];
  onCambiar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const seleccionado = valor === "todos" ? null : centros.find((c) => c.id === valor);
  const etiqueta =
    valor === "todos"
      ? "Todos los campamentos"
      : seleccionado
        ? etiquetaCentro(seleccionado)
        : valor;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          className="h-8 w-56 justify-between gap-1 font-normal"
        >
          <span className="truncate text-xs">{etiqueta}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campamento o N.°…" className="h-9" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>Sin campamentos.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="todos los campamentos"
                onSelect={() => {
                  onCambiar("todos");
                  setAbierto(false);
                }}
              >
                <Check
                  className={cn("size-4", valor === "todos" ? "opacity-100" : "opacity-0")}
                />
                <span>Todos los campamentos</span>
              </CommandItem>
              {centros.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.nro ?? ""} ${c.nombre ?? ""} ${c.id}`}
                  onSelect={() => {
                    onCambiar(c.id);
                    setAbierto(false);
                  }}
                >
                  <Check
                    className={cn("size-4", valor === c.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{etiquetaCentro(c)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ItemUsuarioFiltro({
  username,
  seleccionado,
  onSelect,
}: {
  username: string;
  seleccionado: boolean;
  onSelect: () => void;
}) {
  const etiqueta = useEtiquetaPerfil(username);
  return (
    <CommandItem
      value={`${username} ${etiqueta}`}
      onSelect={onSelect}
      className="items-start"
    >
      <Check className={cn("mt-0.5 size-4", seleccionado ? "opacity-100" : "opacity-0")} />
      <div className="min-w-0 flex-1">
        {etiqueta && etiqueta !== username ? (
          <>
            <p className="truncate text-sm leading-snug">{etiqueta}</p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">{username}</p>
          </>
        ) : (
          <p className="truncate font-mono text-xs">{username}</p>
        )}
      </div>
    </CommandItem>
  );
}

/** Combobox de usuarios: búsqueda por nombre/username + lista acotada. */
function FiltroUsuario({
  valor,
  usuarios,
  onCambiar,
}: {
  valor: string;
  usuarios: string[];
  onCambiar: (username: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const etiquetaSeleccion = useEtiquetaPerfil(valor === "todos" ? null : valor);
  const etiquetaTrigger =
    valor === "todos"
      ? "Todos los usuarios"
      : etiquetaSeleccion && etiquetaSeleccion !== valor
        ? etiquetaSeleccion
        : valor;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          className="h-8 w-52 justify-between gap-1 font-normal"
        >
          <span className="truncate text-xs">{etiquetaTrigger}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar nombre o usuario…" className="h-9" />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>Sin usuarios.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="todos los usuarios"
                onSelect={() => {
                  onCambiar("todos");
                  setAbierto(false);
                }}
              >
                <Check
                  className={cn("size-4", valor === "todos" ? "opacity-100" : "opacity-0")}
                />
                <span>Todos los usuarios</span>
              </CommandItem>
              {usuarios.map((u) => (
                <ItemUsuarioFiltro
                  key={u}
                  username={u}
                  seleccionado={valor === u}
                  onSelect={() => {
                    onCambiar(u);
                    setAbierto(false);
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LogsView({ sesion }: { sesion: Sesion }) {
  const tieneAcceso = puedeVerLogs(sesion.user.rol);
  const [rango, setRango] = useState<FiltroRango>("7d");
  const [entidad, setEntidad] = useState<string>("todas");
  const [usuario, setUsuario] = useState<string>("todos");
  const [centroId, setCentroId] = useState<string>("todos");
  const [pagina, setPagina] = useState(0);

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const nombresCentros = useMemo(
    () => new Map(centros.map((c) => [c.id, c.nombre || c.id])),
    [centros],
  );

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
      entradas.filter((e) => {
        if (entidad !== "todas" && e.entidad !== entidad) return false;
        if (usuario !== "todos" && e.usuario !== usuario) return false;
        if (centroId !== "todos" && centroIdDeEntrada(e) !== centroId) return false;
        return true;
      }),
    [entradas, entidad, usuario, centroId],
  );

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / FILAS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const paginaFilas = useMemo(() => {
    const inicio = paginaSegura * FILAS_POR_PAGINA;
    return visibles.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [visibles, paginaSegura]);

  useEffect(() => {
    setPagina(0);
  }, [rango, entidad, usuario, centroId]);

  const hayFiltros =
    entidad !== "todas" || usuario !== "todos" || centroId !== "todos" || rango !== "7d";

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

            <FiltroCampamento valor={centroId} centros={centros} onCambiar={setCentroId} />

            <FiltroUsuario valor={usuario} usuarios={usuarios} onCambiar={setUsuario} />

            {hayFiltros && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  setRango("7d");
                  setEntidad("todas");
                  setUsuario("todos");
                  setCentroId("todos");
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
            <>
              <ul className="space-y-2">
                {paginaFilas.map((e) => {
                  const cid = centroIdDeEntrada(e);
                  return (
                    <FilaLog
                      key={e.id}
                      entrada={e}
                      nombreCentro={cid ? (nombresCentros.get(cid) ?? null) : null}
                    />
                  );
                })}
              </ul>
              <PaginadorTabla
                pagina={paginaSegura}
                totalPaginas={totalPaginas}
                totalFilas={visibles.length}
                filasPorPagina={FILAS_POR_PAGINA}
                cargando={cargando}
                onPagina={setPagina}
              />
            </>
          )}
        </div>
      )}
    </VistaPagina>
  );
}
