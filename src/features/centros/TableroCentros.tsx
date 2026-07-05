import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  BedDouble,
  ChevronDown,
  Droplets,
  LayoutGrid,
  PawPrint,
  Search,
  Shirt,
  ShowerHead,
  Trash,
  TriangleAlert,
  Users,
  Users2,
  UserCog,
  Utensils,
  X,
} from "lucide-react";
import {
  CATALOGO_CUERPOS,
  ESTADOS_CENTRO,
  metaCuerpoDe,
  normalizarCentro,
  normalizarCuerpo,
  type CentroTransitorio,
  type ClaveCuerpo,
} from "@/domain/centrosTransitorios";
import {
  COLOR_ESTADO_AGUA,
  COLOR_SEMAFORO,
  type ClaveRecurso,
  type RecursoAnalisis,
} from "@/domain/capacidadCentros";
import {
  COLOR_NIVEL,
  COLOR_SEVERIDAD,
  ETIQUETA_NIVEL,
  ORDEN_NIVELES,
  ordenarPorPrioridad,
  prioridadCentro,
  type NivelPrioridad,
  type PrioridadCentro,
} from "@/domain/prioridadCentros";
import { AGUA_LITROS_PERSONA_DIA } from "@/domain/estandares";
import { AccionesContacto } from "@/components/AccionesContacto";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { tieneTelefonoContacto } from "@/lib/contacto";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface Props {
  centros: CentroTransitorio[];
  onSeleccionar: (id: string) => void;
}

type Orden = "prioridad" | "ocupados" | "nombre";

/** Comidas servidas por persona/día (desayuno, almuerzo, cena). */
const COMIDAS_POR_DIA = 3;

const VERDE = "#22c55e";
const AMBAR = "#f59e0b";
const ROJO = "#ef4444";

/** Etiqueta corta y icono por recurso (para las barras de capacidad). */
const RECURSO_LABEL: Record<ClaveRecurso, string> = {
  camas: "Camas",
  pocetas: "Baños",
  duchas: "Duchas",
  lavaderos: "Lavaderos",
  contenedores: "Basura",
};

const RECURSO_ICONO: Record<ClaveRecurso, React.ReactNode> = {
  camas: <BedDouble className="size-3 text-emerald-400" />,
  pocetas: <span className="text-[11px] leading-none">🚽</span>,
  duchas: <ShowerHead className="size-3 text-cyan-400" />,
  lavaderos: <Shirt className="size-3 text-violet-400" />,
  contenedores: <Trash className="size-3 text-lime-500" />,
};

interface Fila {
  centro: CentroTransitorio;
  prioridad: PrioridadCentro;
}

/** Quita acentos y pasa a minúsculas para búsquedas tolerantes. */
function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const n = (x: number) => x.toLocaleString("es");

/**
 * Sala situacional de la red de Centros Transitorios: cuadrícula de tarjetas
 * densas ordenadas por PRIORIDAD ("¿quién requiere más atención?"). Cada
 * capacidad logística se evalúa con una barra "tienes / deberías / faltan"
 * coloreada por gravedad. El clic abre la ficha completa del centro.
 */
export function TableroCentros({ centros, onSeleccionar }: Props) {
  const [orden, setOrden] = useState<Orden>("prioridad");
  const [filtroNivel, setFiltroNivel] = useState<NivelPrioridad | null>(null);
  const [filtroCuerpo, setFiltroCuerpo] = useState<ClaveCuerpo | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cuerposAbiertos, setCuerposAbiertos] = useState(false);

  const base = useMemo<Fila[]>(
    () => centros.map((c) => ({ centro: c, prioridad: prioridadCentro(c) })),
    [centros],
  );

  const cuerposPresentes = useMemo(() => {
    const m = new Map<ClaveCuerpo, number>();
    for (const { centro } of base) {
      const clave = normalizarCuerpo(centro.cuerpo);
      m.set(clave, (m.get(clave) ?? 0) + 1);
    }
    return CATALOGO_CUERPOS.filter((c) => (m.get(c.clave) ?? 0) > 0).map((c) => ({
      meta: c,
      cantidad: m.get(c.clave) ?? 0,
    }));
  }, [base]);

  const enContexto = useMemo(() => {
    const q = normalizarTexto(busqueda.trim());
    return base.filter(({ centro }) => {
      if (filtroCuerpo && normalizarCuerpo(centro.cuerpo) !== filtroCuerpo) return false;
      if (q) {
        const heno = normalizarTexto(`${centro.nombre} ${centro.parroquia}`);
        if (!heno.includes(q)) return false;
      }
      return true;
    });
  }, [base, filtroCuerpo, busqueda]);

  const conteo = useMemo(() => {
    const m: Record<NivelPrioridad, number> = {
      critico: 0,
      alto: 0,
      medio: 0,
      estable: 0,
      sin_datos: 0,
    };
    for (const f of enContexto) m[f.prioridad.nivel]++;
    return m;
  }, [enContexto]);

  const totales = useMemo(() => {
    let refugiados = 0;
    let funcionarios = 0;
    let mascotas = 0;
    let camas = 0;
    let banos = 0;
    let duchas = 0;
    let cupo = 0;
    for (const { centro, prioridad } of enContexto) {
      const a = prioridad.analisis;
      const c = normalizarCentro(centro);
      refugiados += a.refugiados;
      funcionarios += a.personal;
      mascotas += c.ocupacion.mascotas;
      camas += c.capacidad.camas_instaladas;
      banos += c.capacidad.pocetas_instaladas;
      duchas += c.capacidad.duchas_instaladas;
      if (a.cupoReal != null) cupo += a.cupoReal;
    }
    const total = refugiados + funcionarios;
    return {
      refugiados,
      funcionarios,
      mascotas,
      total,
      camas,
      banos,
      duchas,
      cupo,
      aguaDia: total * AGUA_LITROS_PERSONA_DIA,
      comidasDia: total * COMIDAS_POR_DIA,
    };
  }, [enContexto]);

  const filas = useMemo(() => {
    const filtradas = filtroNivel
      ? enContexto.filter((f) => f.prioridad.nivel === filtroNivel)
      : enContexto;
    if (orden === "prioridad") return ordenarPorPrioridad(filtradas);
    const arr = [...filtradas];
    arr.sort((a, b) => {
      const aa = a.prioridad.analisis;
      const bb = b.prioridad.analisis;
      switch (orden) {
        case "ocupados":
          return bb.refugiados - aa.refugiados;
        case "nombre":
          return a.centro.nombre.localeCompare(b.centro.nombre, "es");
        default:
          return 0;
      }
    });
    return arr;
  }, [enContexto, orden, filtroNivel]);

  const ordenes: { valor: Orden; label: string }[] = [
    { valor: "prioridad", label: "Nivel de atención" },
    { valor: "ocupados", label: "Refugiados" },
    { valor: "nombre", label: "Alfabético" },
  ];

  const cuerpoActivo = filtroCuerpo
    ? CATALOGO_CUERPOS.find((c) => c.clave === filtroCuerpo)
    : null;

  return (
    <div className="flex h-full flex-col">
      <VistaEncabezado
        icono={LayoutGrid}
        acento="sky"
        titulo="Tablero comparativo"
        descripcion="Prioridad, capacidad y déficits logísticos de la red de campamentos"
      />

      {/* Totales de la red — en móvil solo población */}
      <div className="shrink-0 border-b border-border bg-background/95 px-3 py-2.5 sm:px-4">
        <div className="flex w-full items-stretch gap-3 overflow-x-auto pb-0.5 md:w-auto">
          <GrupoTotales titulo="Población" className="w-full md:w-auto">
            <Tot etiqueta="Refugiados" valor={totales.refugiados} clase="text-sky-300" />
            <Tot etiqueta="Funcionarios" valor={totales.funcionarios} clase="text-violet-300" />
            <Tot etiqueta="Mascotas" valor={totales.mascotas} />
            <Tot etiqueta="Total" valor={totales.total} />
          </GrupoTotales>
          <GrupoTotales titulo="Instalado" className="hidden md:flex">
            <Tot etiqueta="Camas" valor={totales.camas} />
            <Tot etiqueta="Baños" valor={totales.banos} />
            <Tot etiqueta="Duchas" valor={totales.duchas} />
          </GrupoTotales>
          <GrupoTotales titulo="Necesidad diaria" className="hidden md:flex">
            <Tot etiqueta="Agua (L)" valor={totales.aguaDia} clase="text-sky-300" />
            <Tot etiqueta="Comidas" valor={totales.comidasDia} clase="text-amber-300" />
          </GrupoTotales>
          <GrupoTotales titulo="Capacidad" className="hidden md:flex">
            <Tot etiqueta="Cupo real" valor={totales.cupo} clase="text-emerald-400" />
          </GrupoTotales>
        </div>
      </div>

      {/* Buscador — fila propia, más visible en móvil */}
      <div className="shrink-0 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar campamento…"
            aria-label="Buscar campamento"
            className="h-10 w-full rounded-xl border-2 border-border bg-muted/40 pl-10 pr-10 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary/70 focus:bg-background focus:ring-2 focus:ring-primary/20 md:h-9 md:max-w-md md:text-xs"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Triage por nivel */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-3 py-2 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ORDEN_NIVELES.map((nivel) => (
          <ChipTriage
            key={nivel}
            nivel={nivel}
            cantidad={conteo[nivel]}
            activo={filtroNivel === nivel}
            onClick={() => setFiltroNivel((prev) => (prev === nivel ? null : nivel))}
          />
        ))}
      </div>

      {/* Filtro por cuerpo — plegable en móvil, siempre visible en escritorio */}
      {cuerposPresentes.length > 0 && (
        <>
          <Collapsible
            open={cuerposAbiertos}
            onOpenChange={setCuerposAbiertos}
            className="shrink-0 border-b border-border md:hidden"
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left sm:px-4"
              >
                <span className="text-xs font-medium text-foreground">
                  Filtrar por cuerpo
                  {cuerpoActivo ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {cuerpoActivo.label}
                    </span>
                  ) : (
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · Todos ({cuerposPresentes.length})
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    cuerposAbiertos && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-2.5 sm:px-4">
              <FiltroCuerpos
                cuerposPresentes={cuerposPresentes}
                filtroCuerpo={filtroCuerpo}
                onFiltroCuerpo={setFiltroCuerpo}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="hidden shrink-0 border-b border-border px-3 py-2 md:block sm:px-4">
            <FiltroCuerpos
              cuerposPresentes={cuerposPresentes}
              filtroCuerpo={filtroCuerpo}
              onFiltroCuerpo={setFiltroCuerpo}
              inlineLabel
            />
          </div>
        </>
      )}

      {/* Orden — 3 opciones */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2 sm:px-4">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <ArrowUpDown className="size-3" />
          Ordenar:
        </span>
        {ordenes.map((o) => (
          <Button
            key={o.valor}
            size="xs"
            variant={orden === o.valor ? "secondary" : "outline"}
            className="h-7 px-2.5 text-[11px] md:h-6"
            onClick={() => setOrden(o.valor)}
          >
            {o.label}
          </Button>
        ))}
        {filtroNivel && (
          <Button
            size="xs"
            variant="ghost"
            className="ml-auto h-7 px-2 text-[11px] text-muted-foreground md:h-6"
            onClick={() => setFiltroNivel(null)}
          >
            Quitar filtro: {ETIQUETA_NIVEL[filtroNivel]}
          </Button>
        )}
      </div>

      {/* Cuadrícula de tarjetas */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {filas.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No hay campamentos que coincidan con el filtro.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {filas.map((fila) => (
              <TarjetaCentro
                key={fila.centro.id}
                fila={fila}
                onSeleccionar={() => onSeleccionar(fila.centro.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Tarjeta densa de un centro. En escritorio (sm+) la foto va a la izquierda y el
 * contenido a la derecha; en móvil se apila (foto arriba). Las capacidades
 * logísticas se muestran como barras "tienes / deberías / faltan".
 */
function TarjetaCentro({
  fila,
  onSeleccionar,
}: {
  fila: Fila;
  onSeleccionar: () => void;
}) {
  const { centro, prioridad } = fila;
  const c = normalizarCentro(centro);
  const meta = metaCuerpoDe(centro.cuerpo);
  const analisis = prioridad.analisis;
  const colorNivel = COLOR_NIVEL[prioridad.nivel];
  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];
  const estadoInfo = ESTADOS_CENTRO.find((e) => e.valor === c.estado);
  const agua = analisis.agua;
  const aguaColor = COLOR_ESTADO_AGUA[agua.estado];

  const logistica = analisis.personasLogistica;
  const aguaDiaL = logistica * AGUA_LITROS_PERSONA_DIA;
  const comidasDia = logistica * COMIDAS_POR_DIA;
  const mascotas = c.ocupacion.mascotas;

  const responsables = c.responsables.filter(
    (r) => r.nombre.trim() && tieneTelefonoContacto(r.telefono),
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSeleccionar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSeleccionar();
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row"
      style={{ borderTopColor: colorNivel, borderTopWidth: 3 }}
    >
      {/* Foto / color del cuerpo. Arriba en móvil, izquierda en PC. */}
      <div className="relative h-24 w-full shrink-0 overflow-hidden bg-muted/40 sm:h-auto sm:w-36">
        {c.foto_url ? (
          <img
            src={c.foto_url}
            alt=""
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="flex size-full min-h-24 items-center justify-center"
            style={{ background: `${meta.color}22` }}
          >
            <span
              className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 bg-white text-xl"
              style={{ borderColor: meta.color }}
            >
              {meta.logo ? (
                <img src={meta.logo} alt="" className="size-full object-cover" />
              ) : (
                meta.icono
              )}
            </span>
          </div>
        )}

        <span
          className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
          style={{ background: colorNivel }}
        >
          {prioridad.nivel === "critico" && <TriangleAlert className="size-3" />}
          {ETIQUETA_NIVEL[prioridad.nivel]}
        </span>

        {estadoInfo && (
          <span
            className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm"
            style={{ color: estadoInfo.color }}
          >
            {estadoInfo.label}
          </span>
        )}

        {c.foto_url && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 py-0.5 pl-0.5 pr-2 backdrop-blur-sm">
            <span
              className="flex size-5 items-center justify-center overflow-hidden rounded-full border bg-white text-[9px]"
              style={{ borderColor: meta.color }}
            >
              {meta.logo ? (
                <img src={meta.logo} alt="" className="size-full object-cover" />
              ) : (
                meta.icono
              )}
            </span>
            <span className="text-[10px] font-semibold text-white">{meta.label}</span>
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-2.5">
        {/* Título + ocupación */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {centro.nombre}
            </p>
            {analisis.porcentajeOcupacion != null && (
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: `${colorSemaforo}1f`, color: colorSemaforo }}
                title="Ocupación sobre la capacidad efectiva"
              >
                {Math.min(999, analisis.porcentajeOcupacion)}%
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {!c.foto_url && <span className="font-medium">{meta.label} · </span>}
            {centro.nro != null && <>N.° {centro.nro} · </>}
            {centro.parroquia.replace(/^Parroquia\s/i, "")}
            {analisis.cuelloBotella && (
              <> · límite: {analisis.cuelloBotella.label.toLowerCase()}</>
            )}
          </p>
        </div>

        {/* Población (inline compacto) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stat icono={<Users className="size-3.5 text-sky-300" />} valor={analisis.refugiados} etiqueta="refug." />
          <Stat icono={<UserCog className="size-3.5 text-violet-300" />} valor={analisis.personal} etiqueta="func." />
          <Stat icono={<PawPrint className="size-3.5 text-amber-300" />} valor={mascotas} etiqueta="masc." />
          <Stat icono={<Users2 className="size-3.5 text-foreground" />} valor={logistica} etiqueta="total" resaltar />
        </div>

        {/* Necesidad diaria (inline) */}
        {logistica > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Droplets className="size-3 text-sky-300" />
              <span className="font-semibold text-foreground">{n(aguaDiaL)} L</span>/día
            </span>
            <span className="inline-flex items-center gap-1">
              <Utensils className="size-3 text-amber-300" />
              <span className="font-semibold text-foreground">{n(comidasDia)}</span> comidas/día
            </span>
          </div>
        )}

        {/* Capacidades logísticas: tienes / deberías / faltan */}
        <div className="space-y-1.5">
          {analisis.recursos.map((r) => (
            <BarraCapacidad key={r.clave} recurso={r} />
          ))}
          <BarraAgua
            medido={agua.medido}
            operativa={agua.operativa}
            autonomiaDias={agua.autonomiaDias}
            color={aguaColor}
          />
        </div>

        {/* Factores (motivos) */}
        {prioridad.factores.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {prioridad.factores.map((f, i) => {
              const color = COLOR_SEVERIDAD[f.severidad];
              return (
                <span
                  key={`${f.clave}-${i}`}
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: `${color}1f`, color }}
                >
                  {f.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Responsables con contacto (Telegram/WhatsApp/llamar) */}
        {responsables.length > 0 && (
          <div className="mt-auto space-y-1 border-t border-border pt-2">
            {responsables.slice(0, 2).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="truncate text-[11px] font-medium text-foreground">
                    {r.nombre}
                  </span>
                  {r.funcion && (
                    <span className="ml-1 truncate text-[10px] text-muted-foreground">
                      · {r.funcion}
                    </span>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <AccionesContacto telefono={r.telefono} />
                </div>
              </div>
            ))}
            {responsables.length > 2 && (
              <p className="text-[10px] text-muted-foreground">
                +{responsables.length - 2} responsable(s) más
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Estadística inline compacta (icono + número + etiqueta). */
function Stat({
  icono,
  valor,
  etiqueta,
  resaltar,
}: {
  icono: React.ReactNode;
  valor: number;
  etiqueta: string;
  resaltar?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="translate-y-0.5">{icono}</span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums text-foreground",
          resaltar && "text-emerald-300",
        )}
      >
        {n(valor)}
      </span>
      <span className="text-[10px] text-muted-foreground">{etiqueta}</span>
    </span>
  );
}

/**
 * Barra de una capacidad física: cuánto TIENES (operativas) vs. cuánto
 * DEBERÍAS (requeridas por la población), con el faltante y color por gravedad.
 */
function BarraCapacidad({ recurso }: { recurso: RecursoAnalisis }) {
  const label = RECURSO_LABEL[recurso.clave];
  const icono = RECURSO_ICONO[recurso.clave];

  if (!recurso.medido) {
    return (
      <Barra
        icono={icono}
        label={label}
        color={ROJO}
        ancho={0}
        derecha={<span className="text-muted-foreground">sin registrar</span>}
      />
    );
  }

  if (recurso.sinNecesidad) {
    return (
      <Barra
        icono={icono}
        label={label}
        color={VERDE}
        ancho={100}
        derecha={
          <span className="text-muted-foreground">
            <span className="font-bold text-foreground">{n(recurso.operativas)}</span> · sin demanda
          </span>
        }
      />
    );
  }

  const faltan = Math.max(0, recurso.requeridas - recurso.operativas);
  const color = recurso.cobertura >= 100 ? VERDE : recurso.cobertura >= 60 ? AMBAR : ROJO;

  return (
    <Barra
      icono={icono}
      label={label}
      color={color}
      ancho={Math.min(100, recurso.cobertura)}
      derecha={
        <span className="tabular-nums">
          <span className="font-bold" style={{ color }}>
            {n(recurso.operativas)}
          </span>
          <span className="text-muted-foreground">/{n(recurso.requeridas)}</span>
          {faltan > 0 ? (
            <span className="ml-1 font-semibold" style={{ color: ROJO }}>
              faltan {n(faltan)}
            </span>
          ) : (
            <span className="ml-1 font-semibold" style={{ color: VERDE }}>
              ✓
            </span>
          )}
        </span>
      }
    />
  );
}

/** Barra especial de agua: mide autonomía del tanque, no unidades. */
function BarraAgua({
  medido,
  operativa,
  autonomiaDias,
  color,
}: {
  medido: boolean;
  operativa: boolean;
  autonomiaDias: number | null;
  color: string;
}) {
  const icono = <Droplets className="size-3 text-sky-300" />;
  if (!medido) {
    return (
      <Barra
        icono={icono}
        label="Agua"
        color={ROJO}
        ancho={0}
        derecha={<span className="text-muted-foreground">sin tanque</span>}
      />
    );
  }
  // Objetivo de autonomía: 3 días de reserva.
  const ancho = autonomiaDias != null ? Math.min(100, (autonomiaDias / 3) * 100) : 0;
  const texto =
    !operativa
      ? "sin suministro"
      : autonomiaDias == null
        ? "sin consumo"
        : autonomiaDias < 1
          ? "< 1 día"
          : `~${Math.floor(autonomiaDias)} d`;
  return (
    <Barra
      icono={icono}
      label="Agua"
      color={color}
      ancho={ancho}
      derecha={
        <span className="font-semibold" style={{ color }}>
          {texto}
        </span>
      }
    />
  );
}

/** Fila base de barra: icono + label a la izquierda, dato a la derecha, barra debajo. */
function Barra({
  icono,
  label,
  color,
  ancho,
  derecha,
}: {
  icono: React.ReactNode;
  label: string;
  color: string;
  ancho: number;
  derecha: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1 font-medium text-foreground">
          {icono}
          {label}
        </span>
        <span className="shrink-0">{derecha}</span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${ancho}%`, background: color }}
        />
      </div>
    </div>
  );
}

/** Grupo de la fila de totales de red (título + métricas). */
function GrupoTotales({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5",
        className,
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <div className="flex w-full items-stretch justify-between gap-1 md:w-auto md:justify-start md:gap-3">
        {children}
      </div>
    </div>
  );
}

/** Chips de filtro por cuerpo policial (reutilizado en móvil plegable y escritorio). */
function FiltroCuerpos({
  cuerposPresentes,
  filtroCuerpo,
  onFiltroCuerpo,
  inlineLabel,
}: {
  cuerposPresentes: { meta: (typeof CATALOGO_CUERPOS)[number]; cantidad: number }[];
  filtroCuerpo: ClaveCuerpo | null;
  onFiltroCuerpo: (clave: ClaveCuerpo | null) => void;
  inlineLabel?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {inlineLabel && <span className="text-[11px] text-muted-foreground">Cuerpo:</span>}
      <button
        type="button"
        onClick={() => onFiltroCuerpo(null)}
        className={cn(
          "rounded-lg border px-2 py-1 text-[11px] transition-colors",
          filtroCuerpo === null
            ? "border-primary/50 bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:bg-muted/50",
        )}
      >
        Todos
      </button>
      {cuerposPresentes.map(({ meta, cantidad }) => {
        const activo = filtroCuerpo === meta.clave;
        return (
          <button
            key={meta.clave}
            type="button"
            onClick={() => onFiltroCuerpo(activo ? null : meta.clave)}
            title={meta.label}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-[11px] transition-colors",
              activo ? "bg-muted" : "hover:bg-muted/50",
            )}
            style={{ borderColor: activo ? meta.color : "var(--border)" }}
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white text-[9px]"
              style={{ borderColor: meta.color }}
            >
              {meta.logo ? (
                <img src={meta.logo} alt="" className="size-full object-cover" />
              ) : (
                meta.icono
              )}
            </span>
            <span className="text-foreground">{meta.label}</span>
            <span className="tabular-nums text-muted-foreground">{cantidad}</span>
          </button>
        );
      })}
    </div>
  );
}

function Tot({
  etiqueta,
  valor,
  clase,
}: {
  etiqueta: string;
  valor: number;
  clase?: string;
}) {
  return (
    <div className="min-w-0 flex-1 text-center md:flex-none">
      <div className={cn("text-base font-bold leading-none tabular-nums text-foreground", clase)}>
        {n(valor)}
      </div>
      <div className="mt-0.5 whitespace-nowrap text-[9px] leading-tight text-muted-foreground">
        {etiqueta}
      </div>
    </div>
  );
}

function ChipTriage({
  nivel,
  cantidad,
  activo,
  onClick,
}: {
  nivel: NivelPrioridad;
  cantidad: number;
  activo: boolean;
  onClick: () => void;
}) {
  const color = COLOR_NIVEL[nivel];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors",
        activo ? "bg-muted" : "hover:bg-muted/50",
      )}
      style={{ borderColor: activo ? color : "var(--border)" }}
    >
      <span className="size-2 rounded-full" style={{ background: color }} />
      <span className="font-semibold tabular-nums text-foreground">{cantidad}</span>
      <span className="text-muted-foreground">{ETIQUETA_NIVEL[nivel]}</span>
    </button>
  );
}
