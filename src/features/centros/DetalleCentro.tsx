import {
  BedDouble,
  ClipboardList,
  Droplets,
  ExternalLink,
  Info,
  Landmark,
  Package,
  Pencil,
  Shirt,
  ShowerHead,
  Trash,
  Users,
} from "lucide-react";
import {
  ESTADOS_CENTRO,
  metaCuerpoDe,
  normalizarCentro,
  poblacionCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import {
  analisisCentro,
  COLOR_ESTADO_AGUA,
  COLOR_SEMAFORO,
  type AnalisisAgua,
  type ClaveRecurso,
  type RecursoAnalisis,
} from "@/domain/capacidadCentros";
import { CATEGORIAS_RESPONSABLE } from "@/domain/tipos";
import { AccionesContacto } from "@/components/AccionesContacto";
import { DemografiaResumen } from "@/features/tablero/DemografiaResumen";
import {
  GridServicios,
  TarjetaContacto,
  TarjetaSeguridad,
} from "@/features/centros/LevantamientoCentro";
import { ListaRequerimientos } from "@/features/centros/RequerimientosCentro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICONO_RECURSO: Record<ClaveRecurso, React.ReactNode> = {
  camas: <BedDouble className="size-3.5 text-primary" />,
  pocetas: <span className="text-sm leading-none">🚽</span>,
  duchas: <ShowerHead className="size-3.5 text-cyan-400" />,
  lavaderos: <Shirt className="size-3.5 text-violet-400" />,
  contenedores: <Trash className="size-3.5 text-lime-500" />,
};

/** Botón (i) que abre un popover explicando de dónde sale una cantidad. */
function InfoEstandar({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground/70 transition-colors hover:text-foreground"
          aria-label={`Cómo se calcula: ${titulo}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-1 text-xs">
        <p className="font-semibold text-foreground">{titulo}</p>
        <p className="text-muted-foreground">{texto}</p>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onEditar: () => void;
}

const ETIQUETA_SEMAFORO: Record<string, string> = {
  verde: "Con cupo",
  amarillo: "Casi lleno",
  rojo: "Saturado",
  sin_datos: "Sin datos de capacidad",
};

/** Ficha de detalle de un centro: foto, contactos, capacidad vs ocupación. */
export function DetalleCentro({ centro, puedeEditar, onEditar }: Props) {
  const c = normalizarCentro(centro);
  const meta = metaCuerpoDe(centro.cuerpo);
  const analisis = analisisCentro(centro);
  const poblacion = poblacionCentro(centro);
  const estadoInfo = ESTADOS_CENTRO.find((e) => e.valor === c.estado);
  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];
  const ubicacion = [c.estado_federativo, c.municipio, centro.parroquia.replace(/^Parroquia\s/i, "")]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      {/* Foto */}
      <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
        {c.foto_url ? (
          <img src={c.foto_url} alt={centro.nombre} className="h-44 w-full object-cover" />
        ) : (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            Sin foto del centro
          </div>
        )}
      </div>

      {/* Cabecera */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Centro N.° {centro.nro} · {centro.grupo}
        </p>
        <h2 className="text-base font-bold leading-snug text-foreground">{centro.nombre}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {estadoInfo && (
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: `${estadoInfo.color}66`, color: estadoInfo.color }}
            >
              {estadoInfo.label}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ borderColor: `${colorSemaforo}66`, color: colorSemaforo }}
          >
            {ETIQUETA_SEMAFORO[analisis.semaforo]}
          </Badge>
        </div>
      </div>

      {/* Ubicación administrativa + cuerpo */}
      <div className="space-y-2">
        {c.fecha_levantamiento && (
          <p className="text-[10px] text-muted-foreground">
            Levantamiento:{" "}
            {new Date(`${c.fecha_levantamiento}T12:00:00`).toLocaleDateString("es-VE", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
        <div
          className="inline-flex items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-2.5"
          style={{ borderColor: meta.color }}
        >
          <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
            {meta.logo ? (
              <img src={meta.logo} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-sm leading-none">{meta.icono}</span>
            )}
          </span>
          <span className="text-xs font-semibold text-foreground">{meta.label}</span>
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {ubicacion && <p>{ubicacion}</p>}
          {centro.direccion && <p className="leading-snug">{centro.direccion}</p>}
        </div>
        {centro.mapsUrl && (
          <a
            href={centro.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Abrir en Google Maps
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      {/* II · Coordinación */}
      {(c.coord_politico.nombre || c.coord_ministerial.nombre) && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ClipboardList className="size-3.5" />
            Coordinación
          </p>
          <TarjetaContacto
            titulo="Coordinador político"
            contacto={c.coord_politico}
            icono={<Landmark className="size-3" />}
          />
          <TarjetaContacto titulo="Coordinador ministerial" contacto={c.coord_ministerial} />
        </div>
      )}

      {/* III · Seguridad */}
      <TarjetaSeguridad seguridad={c.seguridad} organismoCatalogo={centro.cuerpo} />

      {/* IV · Salud */}
      <div>
        <p className="mb-2 text-xs font-semibold text-foreground">Salud y apoyo</p>
        <GridServicios servicios={c.servicios} />
      </div>

      {/* V · Población */}
      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Población afectada</p>
          <span className="text-[11px] text-muted-foreground">
            {poblacion.toLocaleString("es")} personas · {analisis.familias.toLocaleString("es")}{" "}
            familias
          </span>
        </div>
        {c.censo_en_proceso && (
          <Badge variant="outline" className="mb-2 border-amber-500/40 text-[10px] text-amber-500">
            Censo demográfico en proceso
          </Badge>
        )}
        {c.total_afectados > 0 && c.censo_en_proceso && (
          <p className="mb-2 text-[11px] text-muted-foreground">
            Total preliminar: {c.total_afectados.toLocaleString("es")} afectados (desglose pendiente)
          </p>
        )}
        <DemografiaResumen vulnerables={c.ocupacion} mostrarEstructura />
      </div>

      {/* Requerimientos logísticos */}
      {c.requerimientos.some((r) => r.concepto.trim() && r.cantidad > 0) && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Package className="size-3.5 text-amber-500" />
            Requerimientos
          </p>
          <ListaRequerimientos items={c.requerimientos} />
        </div>
      )}

      {/* Capacidad vs ocupación */}
      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Capacidad vs. ocupación</p>
          <span className="text-[11px] text-muted-foreground">
            {analisis.ocupados.toLocaleString("es")} alojados
          </span>
        </div>

        {analisis.cupoReal != null ? (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-center"
            style={{ background: `${colorSemaforo}1a` }}
          >
            <div className="text-2xl font-bold" style={{ color: colorSemaforo }}>
              {analisis.cupoReal.toLocaleString("es")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              personas más que puede recibir con seguridad
            </div>
            {analisis.cuelloBotella && analisis.cupoReal >= 0 && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Recurso que fija el límite:{" "}
                <span className="font-semibold text-foreground">
                  {analisis.cuelloBotella.label}
                </span>{" "}
                <span className="text-muted-foreground">(lo primero que se agota)</span>
              </div>
            )}
          </div>
        ) : (
          <p className="mb-3 text-[11px] text-muted-foreground">
            Aún no hay datos de capacidad. Registra camas, pocetas o duchas para calcular el cupo
            real.
          </p>
        )}

        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Recursos: hay · operativas · deberían (según población). Toca el ⓘ para ver el estándar.
        </p>
        <div className="space-y-2">
          {analisis.recursos.map((r) => (
            <BarraRecurso
              key={r.clave}
              recurso={r}
              esLimite={analisis.cuelloBotella?.clave === r.clave}
            />
          ))}
          <TarjetaAgua agua={analisis.agua} />
        </div>
      </div>

      {/* Responsables */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Users className="size-3.5" />
          Responsables ({c.responsables.length})
        </p>
        {c.responsables.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin responsables registrados.</p>
        ) : (
          <div className="space-y-2">
            {c.responsables.map((r) => {
              const cat = CATEGORIAS_RESPONSABLE.find((x) => x.valor === r.categoria);
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.nombre || "Sin nombre"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.funcion || cat?.label}
                    </p>
                  </div>
                  {r.telefono.trim() && <AccionesContacto telefono={r.telefono} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {c.novedades && (
        <div>
          <p className="text-xs font-semibold text-foreground">Novedades relevantes</p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{c.novedades}</p>
        </div>
      )}

      {c.notas && (
        <div>
          <p className="text-xs font-semibold text-foreground">Notas</p>
          <p className="mt-1 text-xs text-muted-foreground">{c.notas}</p>
        </div>
      )}

      {puedeEditar && (
        <Button className="w-full" onClick={onEditar}>
          <Pencil className="size-4" />
          Registrar / editar estado
        </Button>
      )}
    </div>
  );
}

const VERDE = "#22c55e";
const AMBAR = "#f59e0b";
const ROJO = "#ef4444";

function BarraRecurso({ recurso, esLimite }: { recurso: RecursoAnalisis; esLimite: boolean }) {
  const n = (x: number) => x.toLocaleString("es");
  // saldo > 0 → sobran; < 0 → faltan; 0 → justo.
  const saldo = recurso.operativas - recurso.requeridas;
  // Cobertura: MÁS es mejor. Verde ≥100%, ámbar ≥60%, rojo <60%.
  const color = recurso.cobertura >= 100 ? VERDE : recurso.cobertura >= 60 ? AMBAR : ROJO;
  const anchoBarra = Math.min(100, recurso.cobertura);

  let saldoTexto: string;
  let saldoColor: string;
  if (saldo > 0) {
    saldoTexto = `sobran ${n(saldo)} ${recurso.unidad}`;
    saldoColor = VERDE;
  } else if (saldo < 0) {
    saldoTexto = `faltan ${n(-saldo)} ${recurso.unidad}`;
    saldoColor = ROJO;
  } else {
    saldoTexto = "justo, sin margen";
    saldoColor = AMBAR;
  }

  return (
    <div className="rounded-lg border border-border px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          {ICONO_RECURSO[recurso.clave]}
          {recurso.label}
          <InfoEstandar titulo={`¿Cuántas ${recurso.unidad} deberían?`} texto={recurso.descripcionEstandar} />
          {esLimite && (
            <span className="rounded bg-muted px-1 py-px text-[9px] font-medium text-muted-foreground">
              fija el límite
            </span>
          )}
        </span>
        {recurso.medido ? (
          <span className="shrink-0 text-muted-foreground">
            <span className="font-semibold text-foreground">{n(recurso.instaladas)}</span> hay ·{" "}
            <span className="font-semibold text-foreground">{n(recurso.operativas)}</span> oper.
          </span>
        ) : (
          <span className="shrink-0 text-muted-foreground">sin datos</span>
        )}
      </div>

      {recurso.medido && !recurso.sinNecesidad && (
        <>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${anchoBarra}%`, background: color }}
            />
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              deberían: {n(recurso.requeridas)} {recurso.unidad}
            </span>
            <span className="font-medium" style={{ color: saldoColor }}>
              {saldoTexto}
            </span>
          </div>
        </>
      )}

      {recurso.medido && recurso.sinNecesidad && (
        <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
          sin población que atender
        </div>
      )}
    </div>
  );
}

const ETIQUETA_AGUA: Record<string, string> = {
  ok: "Suministro OK",
  atencion: "Vigilar",
  critico: "Atención urgente",
  sin_datos: "Sin datos",
};

/** Tarjeta de agua: no cuenta como "unidades" sino como autonomía + acción. */
function TarjetaAgua({ agua }: { agua: AnalisisAgua }) {
  const n = (x: number) => x.toLocaleString("es");
  const color = COLOR_ESTADO_AGUA[agua.estado];

  return (
    <div className="rounded-lg border border-border px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Droplets className="size-3.5 text-sky-400" />
          Agua potable
          <InfoEstandar titulo="Cómo se evalúa el agua" texto={agua.descripcionEstandar} />
        </span>
        {agua.medido ? (
          <span className="shrink-0 text-muted-foreground">
            tanque <span className="font-semibold text-foreground">{n(agua.litros)} L</span>
          </span>
        ) : (
          <span className="shrink-0 text-muted-foreground">sin datos</span>
        )}
      </div>

      {agua.medido && (
        <>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span>
              consumo ~{n(agua.consumoDiaL)} L/día
              <span className="text-muted-foreground/70"> ({agua.litrosPersonaDia} L·pers.)</span>
            </span>
            {agua.autonomiaDias != null && (
              <span>
                autonomía:{" "}
                <span className="font-semibold" style={{ color }}>
                  {agua.autonomiaDias < 1
                    ? "< 1 día"
                    : `~${Math.floor(agua.autonomiaDias)} día${Math.floor(agua.autonomiaDias) === 1 ? "" : "s"}`}
                </span>
              </span>
            )}
            <Badge
              variant="outline"
              className="px-1 py-0 text-[9px]"
              style={{ borderColor: `${color}66`, color }}
            >
              {agua.operativa ? ETIQUETA_AGUA[agua.estado] : "Sin suministro"}
            </Badge>
          </div>
          <p
            className="mt-1 rounded-md px-2 py-1 text-[10px] leading-snug"
            style={{ background: `${color}14`, color }}
          >
            {agua.recomendacion}
          </p>
        </>
      )}

      {!agua.medido && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">{agua.recomendacion}</p>
      )}
    </div>
  );
}
