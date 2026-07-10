// Vista interna autenticada: resumen del censo rápido por escuela/campamento.
// Acceso restringido a admin, analista SAE y autoridad (UI + RPC censo_resumen_red).

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FilterX,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import {
  cargarFiltrosCensoRed,
  FILTROS_CENSO_RED_DEFAULT,
  filtrosCensoRedDistintosDeDefault,
  guardarFiltrosCensoRed,
  type FiltroEstadoCensoRed,
  type OrdenCensoRed,
} from "@/data/preferenciasCensoRed";
import { useCensoRedResumen } from "@/data/useCensoRedResumen";
import {
  estadoCensoCentro,
  estadoContrasteCenso,
  type ResumenCensoCentro,
} from "@/domain/censoResumen";
import { puedeVerCensoRapidoRed } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VistaPagina } from "@/components/VistaPagina";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TarjetaCensoResumen } from "./TarjetaCensoResumen";
import { CensoRedTabs } from "./CensoRedTabs";

type FiltroEstado = FiltroEstadoCensoRed;
type OrdenCenso = OrdenCensoRed;

const OPCIONES_ESTADO: { valor: FiltroEstado; label: string }[] = [
  { valor: "todos", label: "Todos los estados" },
  { valor: "sin_iniciar", label: "Sin iniciar" },
  { valor: "en_curso", label: "En curso" },
  { valor: "completado_declarado", label: "Completado declarado" },
  { valor: "sin_ocupantes", label: "Sin ocupantes / adecuación" },
];

const OPCIONES_ORDEN: { valor: OrdenCenso; label: string }[] = [
  { valor: "nombre", label: "Nombre A → Z" },
  { valor: "registrados", label: "Más registrados" },
  { valor: "actividad", label: "Actividad reciente" },
  { valor: "discrepancia", label: "Discrepancias primero" },
];

function normalizarBusqueda(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function KpiRed({
  valor,
  etiqueta,
  icono: Icono,
  clase,
}: {
  valor: number;
  etiqueta: string;
  icono: typeof Users;
  clase?: string;
}) {
  return (
    <Card size="sm" className="border-teal-500/15 py-2">
      <CardContent className="flex items-center gap-3 px-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-300",
            clase,
          )}
        >
          <Icono className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums leading-none">{valor.toLocaleString("es")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function deltaParte(r: ResumenCensoCentro): number {
  const parte = r.parteTotal ?? 0;
  if (parte <= 0) return 0;
  return Math.abs(r.totalRegistrados - parte);
}

function ordenarResumenes(items: ResumenCensoCentro[], orden: OrdenCenso): ResumenCensoCentro[] {
  const copia = [...items];
  switch (orden) {
    case "discrepancia":
      return copia.sort((a, b) => {
        const ca = estadoContrasteCenso(a) === "excede_parte" ? 2 : estadoContrasteCenso(a) === "en_progreso" ? 1 : 0;
        const cb = estadoContrasteCenso(b) === "excede_parte" ? 2 : estadoContrasteCenso(b) === "en_progreso" ? 1 : 0;
        if (ca !== cb) return cb - ca;
        return deltaParte(b) - deltaParte(a) || b.totalRegistrados - a.totalRegistrados;
      });
    case "registrados":
      return copia.sort((a, b) => b.totalRegistrados - a.totalRegistrados || a.centroNombre.localeCompare(b.centroNombre, "es"));
    case "actividad":
      return copia.sort((a, b) => {
        const ta = a.ultimoRegistroEn ? new Date(a.ultimoRegistroEn).getTime() : 0;
        const tb = b.ultimoRegistroEn ? new Date(b.ultimoRegistroEn).getTime() : 0;
        return tb - ta || a.centroNombre.localeCompare(b.centroNombre, "es");
      });
    case "nombre":
    default:
      return copia.sort((a, b) => a.centroNombre.localeCompare(b.centroNombre, "es"));
  }
}

export function CensoRedView({ sesion }: { sesion: Sesion }) {
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const { resumenes, cargando, error, refrescar } = useCensoRedResumen();
  const filtrosIniciales = useMemo(() => cargarFiltrosCensoRed(), []);
  const [busqueda, setBusqueda] = useState(filtrosIniciales.busqueda);
  const [estado, setEstado] = useState<FiltroEstado>(filtrosIniciales.estado);
  const [orden, setOrden] = useState<OrdenCenso>(filtrosIniciales.orden);

  useEffect(() => {
    guardarFiltrosCensoRed({ busqueda, estado, orden });
  }, [busqueda, estado, orden]);

  const kpis = useMemo(() => {
    const activas = resumenes.filter((r) => estadoCensoCentro(r) === "en_curso").length;
    const sinIniciar = resumenes.filter((r) => estadoCensoCentro(r) === "sin_iniciar").length;
    const totalPersonas = resumenes.reduce((acc, r) => acc + r.totalRegistrados, 0);
    const conCierre = resumenes.filter(
      (r) =>
        estadoCensoCentro(r) === "completado_declarado" ||
        estadoCensoCentro(r) === "sin_ocupantes",
    ).length;
    return { activas, sinIniciar, totalPersonas, conCierre };
  }, [resumenes]);

  const visibles = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    const filtrados = resumenes.filter((r) => {
      const coincideNombre = !q || normalizarBusqueda(r.centroNombre).includes(q);
      const coincideEstado = estado === "todos" || estadoCensoCentro(r) === estado;
      return coincideNombre && coincideEstado;
    });
    return ordenarResumenes(filtrados, orden);
  }, [busqueda, estado, orden, resumenes]);

  const hayFiltros = filtrosCensoRedDistintosDeDefault({ busqueda, estado, orden });

  return (
    <VistaPagina
      icono={ClipboardList}
      acento="teal"
      titulo="Censo rápido (red)"
      descripcion="Avance del levantamiento en terreno por escuela/campamento"
      cuerpoClassName="p-4 lg:p-6"
      acciones={
        tieneAcceso ? (
          <Button size="sm" variant="outline" onClick={() => void refrescar()} disabled={cargando}>
            <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
            Actualizar
          </Button>
        ) : undefined
      }
    >
      {!tieneAcceso ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Acceso restringido</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo el administrador, el analista SAE y la autoridad pueden consultar el censo de la
            red.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CensoRedTabs />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <KpiRed
              valor={kpis.sinIniciar}
              etiqueta="Escuelas sin iniciar censo"
              icono={CircleDashed}
              clase="bg-muted text-muted-foreground"
            />
            <KpiRed valor={kpis.activas} etiqueta="Escuelas con censo activo" icono={ClipboardList} />
            <KpiRed valor={kpis.totalPersonas} etiqueta="Personas registradas (red)" icono={Users} />
            <KpiRed
              valor={kpis.conCierre}
              etiqueta="Escuelas con cierre declarado"
              icono={CheckCircle2}
              clase="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar escuela…"
                className="h-8 pl-8 text-sm"
              />
            </div>

            <Select value={estado} onValueChange={(v) => setEstado(v as FiltroEstado)}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_ESTADO.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={orden} onValueChange={(v) => setOrden(v as OrdenCenso)}>
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_ORDEN.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.label}
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
                  setBusqueda(FILTROS_CENSO_RED_DEFAULT.busqueda);
                  setEstado(FILTROS_CENSO_RED_DEFAULT.estado);
                  setOrden(FILTROS_CENSO_RED_DEFAULT.orden);
                }}
              >
                <FilterX className="size-3.5" />
                Limpiar
              </Button>
            )}

            <Badge variant="outline" className="ml-auto tabular-nums">
              {visibles.length} escuela{visibles.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {cargando && resumenes.length === 0 ? (
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
              aria-busy="true"
              aria-label="Cargando escuelas del censo"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4"
                  aria-hidden
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton
                        className="h-4"
                        style={{ width: `${55 + ((i * 9) % 30)}%` }}
                      />
                      <Skeleton className="h-2.5 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-5 w-14 rounded-md" />
                    <Skeleton className="h-5 w-12 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <ClipboardList className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Sin escuelas que coincidan con los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibles.map((resumen) => (
                <TarjetaCensoResumen key={resumen.centroId} resumen={resumen} />
              ))}
            </div>
          )}
        </div>
      )}
    </VistaPagina>
  );
}
