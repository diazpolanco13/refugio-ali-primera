// Tabla nominal amplia para reportes del campamento (admin / SAE / supervisor).
// Columnas según nivelColumnasCensoNominal; filtros y orden demográficos.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  FileSpreadsheet,
  FilterX,
  Loader2,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  esUsernameOperadorTerreno,
  useEtiquetaPerfil,
} from "@/data/useEtiquetaPerfil";
import { useSesion } from "@/data/authSupabase";
import { supabase } from "@/data/supabaseClient";
import {
  puedeExportarCensoNominal,
  type NivelColumnasCensoNominal,
} from "@/domain/permisos";
import {
  agruparPorFamilia,
  calcularEdad,
  formatearCedula,
  grupoEtarioRefugiado,
  META_ESTADO_ALOJAMIENTO,
  nombreCompleto,
  normalizarEstatusVivienda,
  type AlojamientoEnriquecido,
  type EstatusVivienda,
} from "@/domain/refugiados";
import type { FiltroKpiDemografico } from "@/features/censo/AvanceCensoNominal";
import { exportarCensoNominalExcel } from "@/features/censo/exportarCensoNominal";
import {
  metaNivelHogar,
  tieneEnfermedadNominal,
} from "@/features/censo/metricasDemograficasNominal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginadorTabla } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface FamiliaFila {
  key: string;
  jefe: AlojamientoEnriquecido;
  miembros: AlojamientoEnriquecido[];
}

type ColumnaOrden =
  | "reciente"
  | "nombre"
  | "edad"
  | "sexo"
  | "familia"
  | "embarazada"
  | "discapacidad"
  | "hogar"
  | "estado"
  | "registrado";

type DireccionOrden = "asc" | "desc";
type FiltroSexo = "todos" | "F" | "M" | "O";
type FiltroPerfil =
  | "todos"
  | "embarazada"
  | "discapacidad"
  | "adulto_mayor"
  | "enfermedad"
  | "desaparecidos"
  | "critico";

const FILAS_POR_PAGINA = 50;

function formatearFechaHoraRegistro(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Scroll horizontal arriba + caja con altura máx. (barra inferior siempre a la vista). */
function ContenedorTablaScroll({ children }: { children: ReactNode }) {
  const barraSuperiorRef = useRef<HTMLDivElement>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const [anchoScroll, setAnchoScroll] = useState(0);
  const sincronizando = useRef(false);

  useEffect(() => {
    const cuerpo = cuerpoRef.current;
    if (!cuerpo) return;

    function medir() {
      const tabla = cuerpo?.querySelector("table");
      setAnchoScroll(tabla?.scrollWidth ?? cuerpo?.scrollWidth ?? 0);
    }

    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cuerpo);
    const tabla = cuerpo.querySelector("table");
    if (tabla) ro.observe(tabla);
    return () => ro.disconnect();
  }, [children]);

  function onScrollSuperior() {
    const top = barraSuperiorRef.current;
    const cuerpo = cuerpoRef.current;
    if (!top || !cuerpo || sincronizando.current) return;
    sincronizando.current = true;
    cuerpo.scrollLeft = top.scrollLeft;
    sincronizando.current = false;
  }

  function onScrollCuerpo() {
    const top = barraSuperiorRef.current;
    const cuerpo = cuerpoRef.current;
    if (!top || !cuerpo || sincronizando.current) return;
    sincronizando.current = true;
    top.scrollLeft = cuerpo.scrollLeft;
    sincronizando.current = false;
  }

  return (
    <div className="rounded-md border border-border">
      <div
        ref={barraSuperiorRef}
        className="overflow-x-auto overflow-y-hidden border-b border-border"
        onScroll={onScrollSuperior}
        aria-hidden
      >
        <div style={{ width: Math.max(anchoScroll, 1), height: 1 }} />
      </div>
      <div
        ref={cuerpoRef}
        className="max-h-[min(55vh,28rem)] overflow-auto"
        onScroll={onScrollCuerpo}
      >
        {children}
      </div>
    </div>
  );
}

interface Props {
  alojamientos: AlojamientoEnriquecido[];
  cargando: boolean;
  centroId: string;
  centroNombre: string;
  nivel: NivelColumnasCensoNominal;
  puedeEditar: boolean;
  eliminandoId?: string | null;
  /** Estatus vivienda por familia (si el padre ya lo cargó). */
  estatusPorFamilia?: Map<string, EstatusVivienda>;
  /** Filtro externo desde KPIs del avance. */
  filtroKpi?: FiltroKpiDemografico;
  onLimpiarFiltroKpi?: () => void;
  onAbrirRefugiado?: (alojamientoId: string) => void;
  onEliminar?: (a: AlojamientoEnriquecido) => void;
}

function etiquetaCedula(a: AlojamientoEnriquecido): string {
  const r = a.refugiado;
  if (r.cedula || r.cedula_norm) {
    return formatearCedula(
      r.cedula || r.cedula_norm || "",
      r.tipo_doc === "E" ? "E" : r.tipo_doc === "P" ? "P" : "V",
    );
  }
  return "Sin cédula";
}

function etiquetaParentesco(a: AlojamientoEnriquecido): string {
  if (a.es_jefe_familia) return "Jefe/a";
  return a.parentesco_jefe?.trim() || "—";
}

function etiquetaSexo(sexo: string | null | undefined): string {
  if (sexo === "M") return "M";
  if (sexo === "F") return "F";
  if (sexo === "O") return "Otro";
  return "—";
}

function CeldaRegistradoPor({
  username,
  creadaTs,
}: {
  username: string;
  creadaTs?: number;
}) {
  const quien = username.trim();
  const etiqueta = useEtiquetaPerfil(quien || null);
  const fechaHora = formatearFechaHoraRegistro(creadaTs ?? 0);
  if (!quien && !fechaHora) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const esTerreno = quien ? esUsernameOperadorTerreno(quien) : false;
  const muestraNombre = esTerreno && etiqueta && etiqueta !== quien;
  return (
    <div className="min-w-[10rem] max-w-[18rem] space-y-0.5" title={quien || undefined}>
      {quien ? (
        muestraNombre ? (
          <>
            <p className="whitespace-normal text-sm leading-snug break-words">
              {etiqueta}
            </p>
            <p className="font-mono text-[10px] leading-snug break-all text-muted-foreground">
              {quien}
            </p>
          </>
        ) : (
          <p className="whitespace-normal font-mono text-xs leading-snug break-words text-muted-foreground">
            {quien}
          </p>
        )
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      {fechaHora ? (
        <p className="text-[10px] tabular-nums leading-tight text-muted-foreground/80">
          {fechaHora}
        </p>
      ) : null}
    </div>
  );
}

function CabeceraOrdenable({
  children,
  activa,
  direccion,
  onClick,
}: {
  children: ReactNode;
  activa: boolean;
  direccion: DireccionOrden;
  onClick: () => void;
}) {
  const Icono = !activa ? ArrowUpDown : direccion === "asc" ? ArrowUp : ArrowDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 gap-1.5 px-2 font-medium text-foreground hover:bg-muted"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
      <Icono className="size-3.5 opacity-70" />
    </Button>
  );
}

function SiNo({ valor }: { valor: boolean }) {
  if (!valor) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-400">
      Sí
    </Badge>
  );
}

function FilaDamnificado({
  a,
  numero,
  nivel,
  estatusPorFamilia,
  puedeEditar,
  eliminando,
  onAbrir,
  onEliminar,
}: {
  a: AlojamientoEnriquecido;
  numero: number;
  nivel: NivelColumnasCensoNominal;
  estatusPorFamilia: Map<string, EstatusVivienda>;
  puedeEditar: boolean;
  eliminando: boolean;
  onAbrir?: () => void;
  onEliminar?: () => void;
}) {
  const edad = calcularEdad(a.refugiado.fecha_nacimiento);
  const meta = META_ESTADO_ALOJAMIENTO[a.estado];
  const telefono = a.refugiado.contacto?.telefono_principal?.trim() || "—";
  const registradoPor = (a.creada_por || a.updated_by || "").trim();
  const familia =
    a.familia?.nombre?.trim() ||
    (a.familia_id ? "Con hogar" : "Sin hogar");
  const embarazada = Boolean(a.refugiado.vulnerabilidades?.embarazada);
  const discapacidad = Boolean(a.refugiado.vulnerabilidades?.discapacidad);
  const nivelHogar = metaNivelHogar(a, estatusPorFamilia);

  return (
    <TableRow
      className={cn(onAbrir && "cursor-pointer hover:bg-muted/40")}
      onClick={onAbrir}
    >
      <TableCell className="text-center tabular-nums text-muted-foreground">
        {numero}
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <p className="font-medium leading-tight">
            {nombreCompleto(a.refugiado)}
          </p>
          {a.es_jefe_familia ? (
            <Badge variant="outline" className="text-[9px]">
              Jefe
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {etiquetaCedula(a)}
      </TableCell>
      <TableCell className="tabular-nums text-sm">
        {edad == null ? "—" : `${edad}`}
      </TableCell>
      <TableCell className="text-sm">{etiquetaSexo(a.refugiado.sexo)}</TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <p className="text-sm">{etiquetaParentesco(a)}</p>
          <p className="max-w-[10rem] text-[11px] leading-snug break-words text-muted-foreground">
            {familia}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <SiNo valor={embarazada} />
      </TableCell>
      <TableCell>
        <SiNo valor={discapacidad} />
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="text-[10px]"
          style={{ borderColor: nivelHogar.color, color: nivelHogar.color }}
          title={
            (a.familia?.desaparecidos ?? 0) > 0
              ? `Desaparecidos: ${a.familia?.desaparecidos}`
              : (a.familia?.fallecidos_confirmados ?? 0) > 0
                ? `Fallecidos: ${a.familia?.fallecidos_confirmados}`
                : undefined
          }
        >
          {nivelHogar.label}
        </Badge>
      </TableCell>
      {nivel === "amplio" ? (
        <TableCell className="font-mono text-xs text-muted-foreground">
          {telefono}
        </TableCell>
      ) : null}
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ borderColor: meta.color, color: meta.color }}
          >
            {meta.label}
          </Badge>
          {a.itinerante ? (
            <Badge
              variant="outline"
              className="border-sky-500/40 text-[10px] text-sky-400"
            >
              Itinerante
            </Badge>
          ) : null}
        </div>
      </TableCell>
      {nivel === "amplio" ? (
        <TableCell>
          <CeldaRegistradoPor
            username={registradoPor}
            creadaTs={a.creada_ts}
          />
        </TableCell>
      ) : null}
      {puedeEditar && onEliminar ? (
        <TableCell className="w-10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            title="Eliminar del censo"
            disabled={eliminando}
            onClick={(e) => {
              e.stopPropagation();
              onEliminar();
            }}
          >
            {eliminando ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function FilaFamiliaCard({
  familia,
  numero,
  estatusPorFamilia,
  puedeEditar,
  eliminandoId,
  onAbrir,
  onEliminar,
}: {
  familia: FamiliaFila;
  numero: number;
  estatusPorFamilia: Map<string, EstatusVivienda>;
  puedeEditar: boolean;
  eliminandoId: string | null;
  onAbrir?: (alojamientoId: string) => void;
  onEliminar?: (a: AlojamientoEnriquecido) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const titulo =
    familia.jefe.familia?.nombre?.trim() ||
    `Familia ${nombreCompleto(familia.jefe.refugiado).split(/\s+/).slice(-1)[0] || ""}`.trim();
  const otros = familia.miembros.filter((m) => m.id !== familia.jefe.id);
  const nivelHogar = metaNivelHogar(familia.jefe, estatusPorFamilia);

  return (
    <Collapsible
      open={abierta}
      onOpenChange={setAbierta}
      className="rounded-xl border border-border bg-card"
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="mt-0.5 w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
          {numero}
        </span>
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer space-y-1 text-left"
          onClick={() => onAbrir?.(familia.jefe.id)}
        >
          <p className="truncate text-sm font-medium leading-tight">
            {nombreCompleto(familia.jefe.refugiado)}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-mono">{etiquetaCedula(familia.jefe)}</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {familia.jefe.es_jefe_familia ? "Líder" : "Sin líder aún"}
            </Badge>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px]"
              style={{ borderColor: nivelHogar.color, color: nivelHogar.color }}
            >
              {nivelHogar.label}
            </Badge>
            {titulo ? (
              <span className="truncate text-muted-foreground/80">{titulo}</span>
            ) : null}
          </p>
        </button>
        <Badge variant="outline" className="h-7 shrink-0 tabular-nums">
          {familia.miembros.length}{" "}
          {familia.miembros.length === 1 ? "miembro" : "miembros"}
        </Badge>
        {puedeEditar && onEliminar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-destructive hover:text-destructive"
            title="Eliminar jefe del censo"
            disabled={eliminandoId === familia.jefe.id}
            onClick={() => onEliminar(familia.jefe)}
          >
            {eliminandoId === familia.jefe.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        ) : null}
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
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
        <div className="mx-3 mb-3 space-y-1 rounded-lg border border-border/70 bg-muted/25 px-2 py-1">
          {otros.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-muted-foreground">
              Solo está registrado el jefe/a de familia.
            </p>
          ) : (
            otros.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-2 py-1.5",
                  onAbrir && "cursor-pointer",
                )}
                onClick={() => onAbrir?.(m.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {nombreCompleto(m.refugiado)}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {etiquetaCedula(m)} · {etiquetaParentesco(m)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.refugiado.vulnerabilidades?.embarazada ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-pink-400"
                    >
                      Emb.
                    </Badge>
                  ) : null}
                  {m.refugiado.vulnerabilidades?.discapacidad ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-400"
                    >
                      Disc.
                    </Badge>
                  ) : null}
                </div>
                {puedeEditar && onEliminar ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    disabled={eliminandoId === m.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEliminar(m);
                    }}
                  >
                    {eliminandoId === m.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function filtroDesdeKpi(kpi: FiltroKpiDemografico): {
  sexo: FiltroSexo;
  perfil: FiltroPerfil;
} {
  if (kpi === "mujeres") return { sexo: "F", perfil: "todos" };
  if (kpi === "hombres") return { sexo: "M", perfil: "todos" };
  if (kpi === "embarazadas") return { sexo: "todos", perfil: "embarazada" };
  if (kpi === "discapacidad") return { sexo: "todos", perfil: "discapacidad" };
  if (kpi === "adultos_mayores") {
    return { sexo: "todos", perfil: "adulto_mayor" };
  }
  if (kpi === "enfermedad") return { sexo: "todos", perfil: "enfermedad" };
  if (kpi === "desaparecidos") {
    return { sexo: "todos", perfil: "desaparecidos" };
  }
  if (kpi === "critico") return { sexo: "todos", perfil: "critico" };
  return { sexo: "todos", perfil: "todos" };
}

export function CensoNominalTablaCentro({
  alojamientos,
  cargando,
  centroId,
  centroNombre,
  nivel,
  puedeEditar,
  eliminandoId = null,
  estatusPorFamilia: estatusProp,
  filtroKpi = null,
  onLimpiarFiltroKpi,
  onAbrirRefugiado,
  onEliminar,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [pestana, setPestana] = useState<"damnificados" | "familias">(
    "damnificados",
  );
  const [filtroSexo, setFiltroSexo] = useState<FiltroSexo>("todos");
  const [filtroPerfil, setFiltroPerfil] = useState<FiltroPerfil>("todos");
  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrden>("reciente");
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>("desc");
  const [pagina, setPagina] = useState(0);
  const [exportando, setExportando] = useState(false);
  const sesion = useSesion();
  const puedeExportar = sesion
    ? puedeExportarCensoNominal(sesion.user.rol)
    : false;
  const [estatusLocal, setEstatusLocal] = useState<
    Map<string, EstatusVivienda>
  >(new Map());

  const estatusPorFamilia = estatusProp ?? estatusLocal;

  useEffect(() => {
    if (estatusProp) return;
    let cancelado = false;
    void (async () => {
      const { data, error } = await supabase
        .from("residencias_afectadas")
        .select("familia_id,estatus_vivienda")
        .eq("centro_id", centroId);
      if (cancelado) return;
      if (error) {
        console.warn("[CensoNominalTabla] residencias:", error.message);
        setEstatusLocal(new Map());
        return;
      }
      const map = new Map<string, EstatusVivienda>();
      for (const row of data ?? []) {
        const famId = (row as { familia_id?: string }).familia_id;
        if (!famId) continue;
        map.set(
          famId,
          normalizarEstatusVivienda(
            (row as { estatus_vivienda?: string }).estatus_vivienda,
          ),
        );
      }
      setEstatusLocal(map);
    })();
    return () => {
      cancelado = true;
    };
  }, [centroId, estatusProp]);

  useEffect(() => {
    const sync = filtroDesdeKpi(filtroKpi);
    setFiltroSexo(sync.sexo);
    setFiltroPerfil(sync.perfil);
    setPagina(0);
  }, [filtroKpi]);

  function alternarOrden(col: ColumnaOrden) {
    if (columnaOrden === col) {
      setDireccionOrden((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setColumnaOrden(col);
    setDireccionOrden(
      col === "edad" || col === "reciente" || col === "registrado"
        ? "desc"
        : "asc",
    );
  }

  function limpiarFiltros() {
    setBusqueda("");
    setFiltroSexo("todos");
    setFiltroPerfil("todos");
    setPagina(0);
    onLimpiarFiltroKpi?.();
  }

  async function exportarExcel() {
    if (filtrados.length === 0 || exportando) return;
    setExportando(true);
    try {
      await exportarCensoNominalExcel(filtrados, centroNombre);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar a Excel");
    } finally {
      setExportando(false);
    }
  }

  const hayFiltros =
    busqueda.trim() !== "" ||
    filtroSexo !== "todos" ||
    filtroPerfil !== "todos";

  const filtrados = useMemo(() => {
    const qTexto = busqueda.trim().toLowerCase();
    const q = qTexto.replace(/\D/g, "");
    let lista = [...alojamientos];

    lista = lista.filter((a) => {
      if (filtroSexo !== "todos" && a.refugiado.sexo !== filtroSexo) {
        return false;
      }
      if (filtroPerfil === "embarazada") {
        if (!a.refugiado.vulnerabilidades?.embarazada) return false;
      } else if (filtroPerfil === "discapacidad") {
        if (!a.refugiado.vulnerabilidades?.discapacidad) return false;
      } else if (filtroPerfil === "adulto_mayor") {
        if (grupoEtarioRefugiado(a.refugiado.fecha_nacimiento) !== "adulto_mayor") {
          return false;
        }
      } else if (filtroPerfil === "enfermedad") {
        if (!tieneEnfermedadNominal(a)) return false;
      } else if (filtroPerfil === "desaparecidos") {
        if ((a.familia?.desaparecidos ?? 0) <= 0) return false;
      } else if (filtroPerfil === "critico") {
        if (metaNivelHogar(a, estatusPorFamilia).valor !== "critico") {
          return false;
        }
      }

      if (!qTexto) return true;
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

    const dir = direccionOrden === "asc" ? 1 : -1;
    lista.sort((a, b) => {
      const cmp = (va: string | number | boolean | null, vb: string | number | boolean | null) => {
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        if (typeof va === "boolean" && typeof vb === "boolean") {
          return (Number(va) - Number(vb)) * dir;
        }
        return String(va).localeCompare(String(vb), "es") * dir;
      };

      switch (columnaOrden) {
        case "reciente":
          return cmp(a.creada_ts || 0, b.creada_ts || 0);
        case "edad":
          return cmp(
            calcularEdad(a.refugiado.fecha_nacimiento),
            calcularEdad(b.refugiado.fecha_nacimiento),
          );
        case "sexo":
          return cmp(a.refugiado.sexo, b.refugiado.sexo);
        case "familia":
          return cmp(
            a.familia?.nombre || etiquetaParentesco(a),
            b.familia?.nombre || etiquetaParentesco(b),
          );
        case "embarazada":
          return cmp(
            Boolean(a.refugiado.vulnerabilidades?.embarazada),
            Boolean(b.refugiado.vulnerabilidades?.embarazada),
          );
        case "discapacidad":
          return cmp(
            Boolean(a.refugiado.vulnerabilidades?.discapacidad),
            Boolean(b.refugiado.vulnerabilidades?.discapacidad),
          );
        case "hogar":
          return cmp(
            metaNivelHogar(a, estatusPorFamilia).label,
            metaNivelHogar(b, estatusPorFamilia).label,
          );
        case "estado":
          return cmp(a.estado, b.estado);
        case "registrado":
          return cmp(a.creada_ts || 0, b.creada_ts || 0);
        case "nombre":
          return cmp(nombreCompleto(a.refugiado), nombreCompleto(b.refugiado));
        default:
          return cmp(a.creada_ts || 0, b.creada_ts || 0);
      }
    });

    return lista;
  }, [
    alojamientos,
    busqueda,
    columnaOrden,
    direccionOrden,
    estatusPorFamilia,
    filtroPerfil,
    filtroSexo,
  ]);

  const familiasFilas = useMemo((): FamiliaFila[] => {
    const grupos = agruparPorFamilia(filtrados);
    const filas: FamiliaFila[] = [];
    for (const [familiaId, miembros] of grupos) {
      if (!familiaId) {
        for (const m of miembros) {
          filas.push({ key: `solo:${m.id}`, jefe: m, miembros: [m] });
        }
        continue;
      }
      const jefe =
        miembros.find((m) => m.es_jefe_familia) ??
        [...miembros].sort((a, b) => (b.creada_ts || 0) - (a.creada_ts || 0))[0];
      if (!jefe) continue;
      filas.push({
        key: familiaId,
        jefe,
        miembros: [...miembros].sort((a, b) => {
          if (a.es_jefe_familia && !b.es_jefe_familia) return -1;
          if (!a.es_jefe_familia && b.es_jefe_familia) return 1;
          return (b.creada_ts || 0) - (a.creada_ts || 0);
        }),
      });
    }
    return filas.sort(
      (a, b) => (b.jefe.creada_ts || 0) - (a.jefe.creada_ts || 0),
    );
  }, [filtrados]);

  const totalFilasPestana =
    pestana === "damnificados" ? filtrados.length : familiasFilas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalFilasPestana / FILAS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);

  useEffect(() => {
    setPagina(0);
  }, [busqueda, filtroSexo, filtroPerfil, pestana, columnaOrden, direccionOrden]);

  useEffect(() => {
    if (pagina > totalPaginas - 1) setPagina(Math.max(0, totalPaginas - 1));
  }, [pagina, totalPaginas]);

  const paginaFilas = useMemo(() => {
    const inicio = paginaSegura * FILAS_POR_PAGINA;
    return filtrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [filtrados, paginaSegura]);

  const paginaFamilias = useMemo(() => {
    const inicio = paginaSegura * FILAS_POR_PAGINA;
    return familiasFilas.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [familiasFilas, paginaSegura]);

  return (
    <Card className="border-teal-500/15">
      <CardHeader className="space-y-3 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-teal-600 dark:text-teal-300" />
              Censo nominal
            </CardTitle>
            <CardDescription>
              {cargando && alojamientos.length === 0
                ? "Cargando…"
                : `${alojamientos.length.toLocaleString("es")} persona${alojamientos.length === 1 ? "" : "s"} activa${alojamientos.length === 1 ? "" : "s"} · ${filtrados.length.toLocaleString("es")} visible${filtrados.length === 1 ? "" : "s"} · ${FILAS_POR_PAGINA} por página (más recientes primero)`}
            </CardDescription>
          </div>
          {puedeExportar ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 shrink-0 gap-1.5 border border-border shadow-sm"
              disabled={cargando || filtrados.length === 0 || exportando}
              onClick={() => void exportarExcel()}
            >
              {exportando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              {exportando ? "Exportando…" : "Descargar Excel"}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre o cédula"
              className="h-10 pl-9"
              autoComplete="off"
              inputMode="search"
            />
          </div>
          <Select
            value={filtroSexo}
            onValueChange={(v) => setFiltroSexo(v as FiltroSexo)}
          >
            <SelectTrigger className="h-10 w-[8.5rem]">
              <SelectValue placeholder="Sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo sexo</SelectItem>
              <SelectItem value="F">Mujeres</SelectItem>
              <SelectItem value="M">Hombres</SelectItem>
              <SelectItem value="O">Otro</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filtroPerfil}
            onValueChange={(v) => setFiltroPerfil(v as FiltroPerfil)}
          >
            <SelectTrigger className="h-10 w-[12rem]">
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo perfil</SelectItem>
              <SelectItem value="embarazada">Embarazadas</SelectItem>
              <SelectItem value="discapacidad">Discapacidad</SelectItem>
              <SelectItem value="adulto_mayor">Adultos 60+</SelectItem>
              <SelectItem value="enfermedad">Enfermedad</SelectItem>
              <SelectItem value="desaparecidos">Con desaparecidos</SelectItem>
              <SelectItem value="critico">Hogar crítico</SelectItem>
            </SelectContent>
          </Select>
          {hayFiltros ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 gap-1.5"
              onClick={limpiarFiltros}
            >
              <FilterX className="size-3.5" />
              Limpiar
            </Button>
          ) : null}
        </div>
        <div
          role="tablist"
          aria-label="Vistas del censo nominal"
          className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-muted/40 shadow-sm"
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
                  "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 px-1.5 py-2 text-center transition-colors sm:flex-row sm:gap-1.5 sm:px-2",
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
        {cargando && alojamientos.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando censo nominal…
          </div>
        ) : pestana === "damnificados" ? (
          filtrados.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {hayFiltros
                ? "Ningún resultado con esos filtros."
                : "Aún no hay personas censadas en este campamento."}
            </p>
          ) : (
            <div className="space-y-3">
              <PaginadorTabla
                pagina={paginaSegura}
                totalPaginas={totalPaginas}
                totalFilas={filtrados.length}
                filasPorPagina={FILAS_POR_PAGINA}
                cargando={cargando}
                onPagina={setPagina}
                className="border-t-0 pt-0"
              />
              <ContenedorTablaScroll>
                <Table containerClassName="overflow-visible">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "nombre"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("nombre")}
                      >
                        Persona
                      </CabeceraOrdenable>
                    </TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "edad"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("edad")}
                      >
                        Edad
                      </CabeceraOrdenable>
                    </TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "sexo"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("sexo")}
                      >
                        Sexo
                      </CabeceraOrdenable>
                    </TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "familia"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("familia")}
                      >
                        Familia
                      </CabeceraOrdenable>
                    </TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "embarazada"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("embarazada")}
                      >
                        Emb.
                      </CabeceraOrdenable>
                    </TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "discapacidad"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("discapacidad")}
                      >
                        Disc.
                      </CabeceraOrdenable>
                    </TableHead>
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "hogar"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("hogar")}
                      >
                        Estado hogar
                      </CabeceraOrdenable>
                    </TableHead>
                    {nivel === "amplio" ? <TableHead>Teléfono</TableHead> : null}
                    <TableHead>
                      <CabeceraOrdenable
                        activa={columnaOrden === "estado"}
                        direccion={direccionOrden}
                        onClick={() => alternarOrden("estado")}
                      >
                        Estado
                      </CabeceraOrdenable>
                    </TableHead>
                    {nivel === "amplio" ? (
                      <TableHead>
                        <CabeceraOrdenable
                          activa={
                            columnaOrden === "registrado" ||
                            columnaOrden === "reciente"
                          }
                          direccion={direccionOrden}
                          onClick={() => alternarOrden("reciente")}
                        >
                          Registrado por
                        </CabeceraOrdenable>
                      </TableHead>
                    ) : null}
                    {puedeEditar && onEliminar ? (
                      <TableHead className="w-10">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginaFilas.map((a, i) => (
                    <FilaDamnificado
                      key={a.id}
                      a={a}
                      numero={paginaSegura * FILAS_POR_PAGINA + i + 1}
                      nivel={nivel}
                      estatusPorFamilia={estatusPorFamilia}
                      puedeEditar={puedeEditar}
                      eliminando={eliminandoId === a.id}
                      onAbrir={
                        onAbrirRefugiado
                          ? () => onAbrirRefugiado(a.id)
                          : undefined
                      }
                      onEliminar={
                        onEliminar ? () => onEliminar(a) : undefined
                      }
                    />
                  ))}
                </TableBody>
              </Table>
              </ContenedorTablaScroll>
            </div>
          )
        ) : familiasFilas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {hayFiltros
              ? "Ninguna familia coincide con esos filtros."
              : "Aún no hay familias censadas en este campamento."}
          </p>
        ) : (
          <div className="space-y-2">
            {paginaFamilias.map((f, i) => (
              <FilaFamiliaCard
                key={f.key}
                familia={f}
                numero={paginaSegura * FILAS_POR_PAGINA + i + 1}
                estatusPorFamilia={estatusPorFamilia}
                puedeEditar={puedeEditar}
                eliminandoId={eliminandoId}
                onAbrir={onAbrirRefugiado}
                onEliminar={onEliminar}
              />
            ))}
          </div>
        )}

        {!cargando && totalFilasPestana > 0 ? (
          <PaginadorTabla
            pagina={paginaSegura}
            totalPaginas={totalPaginas}
            totalFilas={totalFilasPestana}
            filasPorPagina={FILAS_POR_PAGINA}
            cargando={cargando}
            onPagina={setPagina}
            className="mt-3"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
