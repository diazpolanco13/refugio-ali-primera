// Vista interna: progreso del censo nominal por campamento (vs parte).
// Acceso: admin, analista SAE, autoridad, censo_rapido.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FilterX,
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
import { useCensoNominalRed } from "@/data/useCensoNominalRed";
import {
  deltaParteNominal,
  estadoCensoNominalRed,
  type ResumenCensoNominalCentro,
} from "@/domain/censoNominalRed";
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
import { CENSO_SELECT_TRIGGER } from "@/features/censo/censoFormularioShared";
import { GraficoCensoRed } from "./GraficoCensoRed";
import { TarjetaCensoNominal } from "./TarjetaCensoNominal";
import { CensoRedTabs } from "./CensoRedTabs";
import { BotonReporteEstatusCenso } from "./reporte-estatus/BotonReporteEstatusCenso";

type FiltroEstado = FiltroEstadoCensoRed;
type OrdenCenso = OrdenCensoRed;

const OPCIONES_ESTADO: { valor: FiltroEstado; label: string }[] = [
  { valor: "todos", label: "Todos los estados" },
  { valor: "sin_iniciar", label: "Sin iniciar" },
  { valor: "en_curso", label: "En progreso" },
  { valor: "meta_alcanzada", label: "Cuadra con el parte" },
  { valor: "discrepancia", label: "Discrepancia" },
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

function coincideFiltroEstado(
  resumen: ResumenCensoNominalCentro,
  estado: FiltroEstado,
): boolean {
  if (estado === "todos") return true;
  return estadoCensoNominalRed(resumen) === estado;
}

function ordenarResumenes(
  items: ResumenCensoNominalCentro[],
  orden: OrdenCenso,
): ResumenCensoNominalCentro[] {
  const copia = [...items];
  switch (orden) {
    case "discrepancia":
      return copia.sort((a, b) => {
        const ca = a.contraste === "excede_parte" ? 2 : 0;
        const cb = b.contraste === "excede_parte" ? 2 : 0;
        if (ca !== cb) return cb - ca;
        return (
          deltaParteNominal(b) - deltaParteNominal(a) ||
          b.registrados - a.registrados
        );
      });
    case "registrados":
      return copia.sort(
        (a, b) =>
          b.registrados - a.registrados ||
          a.centroNombre.localeCompare(b.centroNombre, "es"),
      );
    case "actividad":
      return copia.sort(
        (a, b) =>
          b.ultimoRegistroTs - a.ultimoRegistroTs ||
          a.centroNombre.localeCompare(b.centroNombre, "es"),
      );
    case "nombre":
    default:
      return copia.sort(
        (a, b) =>
          (a.nro ?? 9999) - (b.nro ?? 9999) ||
          a.centroNombre.localeCompare(b.centroNombre, "es"),
      );
  }
}

/** Variación día: `invertir` = bajar es bueno (sin iniciar / discrepancias). */
function TextoVariacionDia({
  delta,
  invertir = false,
}: {
  delta: number | null | undefined;
  invertir?: boolean;
}) {
  if (delta == null) {
    return (
      <p className="mt-0.5 text-[10px] text-muted-foreground">vs. día previo</p>
    );
  }
  if (delta === 0) {
    return (
      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
        sin cambio hoy
      </p>
    );
  }
  const bueno = invertir ? delta < 0 : delta > 0;
  return (
    <p
      className={cn(
        "mt-0.5 text-[10px] font-medium tabular-nums",
        bueno
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-amber-600 dark:text-amber-400",
      )}
    >
      {delta > 0 ? "+" : ""}
      {delta.toLocaleString("es")} hoy
    </p>
  );
}

function KpiRed({
  valor,
  etiqueta,
  icono: Icono,
  clase,
  delta,
  invertirDelta = false,
  cargando = false,
}: {
  valor: number;
  etiqueta: string;
  icono: typeof Users;
  clase?: string;
  delta?: number | null;
  /** true cuando bajar el KPI es progreso (sin iniciar, discrepancias). */
  invertirDelta?: boolean;
  /** Datos aún cargando: muestra placeholder en vez de cifras parciales. */
  cargando?: boolean;
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
          {cargando ? (
            <Skeleton className="h-[18px] w-12" />
          ) : (
            <p className="text-lg font-bold tabular-nums leading-none">
              {valor.toLocaleString("es")}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">{etiqueta}</p>
          {!cargando && <TextoVariacionDia delta={delta} invertir={invertirDelta} />}
        </div>
      </CardContent>
    </Card>
  );
}

export function CensoRedView({ sesion }: { sesion: Sesion }) {
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const { resumenes, serieDiaria, variacion, cargando } = useCensoNominalRed();
  const filtrosIniciales = useMemo(() => cargarFiltrosCensoRed(), []);
  const [busqueda, setBusqueda] = useState(filtrosIniciales.busqueda);
  const [estado, setEstado] = useState<FiltroEstado>(filtrosIniciales.estado);
  const [orden, setOrden] = useState<OrdenCenso>(filtrosIniciales.orden);

  useEffect(() => {
    guardarFiltrosCensoRed({ busqueda, estado, orden });
  }, [busqueda, estado, orden]);

  const kpis = useMemo(() => {
    const sinIniciar = resumenes.filter(
      (r) => coincideFiltroEstado(r, "sin_iniciar"),
    ).length;
    const enCurso = resumenes.filter((r) =>
      coincideFiltroEstado(r, "en_curso"),
    ).length;
    const totalPersonas = resumenes.reduce((acc, r) => acc + r.registrados, 0);
    const totalParte = resumenes.reduce(
      (acc, r) => acc + r.metaRefugiados,
      0,
    );
    const metaAlcanzada = resumenes.filter((r) =>
      coincideFiltroEstado(r, "meta_alcanzada"),
    ).length;
    const discrepancias = resumenes.filter((r) =>
      coincideFiltroEstado(r, "discrepancia"),
    ).length;
    return {
      sinIniciar,
      enCurso,
      totalPersonas,
      totalParte,
      metaAlcanzada,
      discrepancias,
      deltaSinIniciar: variacion?.sinIniciar ?? null,
      deltaEnCurso: variacion?.enCurso ?? null,
      deltaTotalPersonas: variacion?.totalPersonas ?? null,
      deltaMetaAlcanzada: variacion?.metaAlcanzada ?? null,
      deltaDiscrepancias: variacion?.discrepancias ?? null,
    };
  }, [resumenes, variacion]);

  const visibles = useMemo(() => {
    const q = normalizarBusqueda(busqueda);
    const filtrados = resumenes.filter((r) => {
      const coincideNombre =
        !q ||
        normalizarBusqueda(r.centroNombre).includes(q) ||
        (r.nro != null && String(r.nro).includes(q));
      return coincideNombre && coincideFiltroEstado(r, estado);
    });
    return ordenarResumenes(filtrados, orden);
  }, [busqueda, estado, orden, resumenes]);

  const hayFiltros = filtrosCensoRedDistintosDeDefault({
    busqueda,
    estado,
    orden,
  });

  return (
    <VistaPagina
      icono={ClipboardList}
      acento="teal"
      titulo="Registro (red)"
      descripcion="Progreso del registro nominal por campamento (contraste vs parte)"
      cuerpoClassName="p-4 lg:p-6"
    >
      {!tieneAcceso ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Acceso restringido
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo el administrador, el analista y la autoridad pueden
            consultar el registro de la red.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CensoRedTabs />

          <GraficoCensoRed serie={serieDiaria} cargando={cargando} />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <KpiRed
              valor={kpis.sinIniciar}
              etiqueta="Sin iniciar registro"
              icono={CircleDashed}
              clase="bg-muted text-muted-foreground"
              delta={kpis.deltaSinIniciar}
              invertirDelta
              cargando={cargando}
            />
            <KpiRed
              valor={kpis.enCurso}
              etiqueta="Registro en progreso"
              icono={ClipboardList}
              delta={kpis.deltaEnCurso}
              cargando={cargando}
            />
            <KpiRed
              valor={kpis.totalPersonas}
              etiqueta={
                kpis.totalParte > 0
                  ? `Registrados / parte (${kpis.totalParte.toLocaleString("es")})`
                  : "Personas registradas (red)"
              }
              icono={Users}
              delta={kpis.deltaTotalPersonas}
              cargando={cargando}
            />
            <KpiRed
              valor={kpis.metaAlcanzada}
              etiqueta="Cuadran con el parte"
              icono={CheckCircle2}
              clase="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              delta={kpis.deltaMetaAlcanzada}
              cargando={cargando}
            />
            <KpiRed
              valor={kpis.discrepancias}
              etiqueta="Con discrepancia"
              icono={AlertTriangle}
              clase="bg-red-500/10 text-red-600 dark:text-red-300"
              delta={kpis.deltaDiscrepancias}
              invertirDelta
              cargando={cargando}
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

            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as FiltroEstado)}
            >
              <SelectTrigger
                size="sm"
                className={cn(CENSO_SELECT_TRIGGER, "h-8 w-48")}
              >
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

            <Select
              value={orden}
              onValueChange={(v) => setOrden(v as OrdenCenso)}
            >
              <SelectTrigger
                size="sm"
                className={cn(CENSO_SELECT_TRIGGER, "h-8 w-44")}
              >
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

            {hayFiltros ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border border-border text-xs"
                onClick={() => {
                  setBusqueda(FILTROS_CENSO_RED_DEFAULT.busqueda);
                  setEstado(FILTROS_CENSO_RED_DEFAULT.estado);
                  setOrden(FILTROS_CENSO_RED_DEFAULT.orden);
                }}
              >
                <FilterX className="size-3.5" />
                Limpiar
              </Button>
            ) : null}

            <BotonReporteEstatusCenso
              resumenes={resumenes}
              cargando={cargando}
            />

            <Badge variant="outline" className="ml-auto tabular-nums">
              {visibles.length} escuela{visibles.length === 1 ? "" : "s"}
            </Badge>
          </div>

          {/* Gate por `cargando` a secas: los centros llegan antes que los
              alojamientos (26k+) y con `resumenes.length === 0` la rama
              saltaba al estado vacío con conteos en cero a media carga. */}
          {cargando ? (
            <div
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
              aria-busy="true"
              aria-label="Cargando escuelas del registro"
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
                <TarjetaCensoNominal key={resumen.centroId} resumen={resumen} />
              ))}
            </div>
          )}
        </div>
      )}
    </VistaPagina>
  );
}
