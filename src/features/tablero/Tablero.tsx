import {
  AlertTriangle,
  BarChart3,
  Brush,
  Phone,
  MessageCircle,
} from "lucide-react";
import {
  calcularCobertura,
  estadoSector,
  generarAlertas,
  kpisGlobales,
} from "@/domain/brechas";
import { esMantenimiento, formatoDuracion, infoLimpieza } from "@/domain/limpieza";
import {
  CATEGORIAS_RESPONSABLE,
  ESTADO_SECTOR_COLOR,
  META_POR_TIPO,
  sumarVulnerables,
  type CategoriaResponsable,
  type PuntoServicio,
  type Sector,
} from "@/domain/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { DemografiaResumen } from "./DemografiaResumen";

const CAT_POR_VALOR = Object.fromEntries(
  CATEGORIAS_RESPONSABLE.map((c) => [c.valor, c]),
) as Record<CategoriaResponsable, (typeof CATEGORIAS_RESPONSABLE)[number]>;

const telHref = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
const waHref = (t: string) => `https://wa.me/${t.replace(/\D/g, "")}`;

interface Props {
  sectores: Sector[];
  puntos: PuntoServicio[];
  ahora: number;
  puedeEditar: boolean;
  onMarcarLimpio: (id: string) => void;
  onIrASector: (id: string) => void;
}

export function Tablero({
  sectores,
  puntos,
  ahora,
  puedeEditar,
  onMarcarLimpio,
  onIrASector,
}: Props) {
  const kpis = kpisGlobales(sectores, puntos);
  const demografiaGlobal = sumarVulnerables(sectores);
  const alertas = generarAlertas(sectores, puntos);

  const rank: Record<string, number> = { vencido: 0, pronto: 1, sin_programar: 2, ok: 3 };
  const mantenimiento = puntos
    .filter((p) => esMantenimiento(p.tipo))
    .map((p) => ({ p, info: infoLimpieza(p, ahora) }))
    .sort((a, b) => (rank[a.info?.estado ?? "ok"] ?? 3) - (rank[b.info?.estado ?? "ok"] ?? 3));
  const vencidos = mantenimiento.filter((m) => m.info?.estado === "vencido").length;

  return (
    <div className="space-y-4">
      {/* KPIs globales */}
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Población" valor={kpis.poblacionTotal} />
        <Kpi label="Familias" valor={kpis.familiasTotal} />
        <Kpi label="Vulnerables" valor={kpis.vulnerablesTotal} destacado="v" />
        <Kpi label="Sectores" valor={kpis.sectores} />
        <Kpi label="Puntos operativos" valor={kpis.puntosOperativos} />
        <Kpi label="Puntos totales" valor={kpis.puntosTotal} />
      </div>

      {/* Desglose demográfico por edad y sexo */}
      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Demografía por edad y sexo</CardTitle>
        </CardHeader>
        <CardContent>
          <DemografiaResumen vulnerables={demografiaGlobal} mostrarEstructura={sectores.length > 0} />
        </CardContent>
      </Card>

      {/* Semáforo de sectores */}
      <div className="flex gap-2">
        <Semaforo color={ESTADO_SECTOR_COLOR.verde} n={kpis.sectoresVerde} label="OK" />
        <Semaforo color={ESTADO_SECTOR_COLOR.amarillo} n={kpis.sectoresAmarillo} label="Alerta" />
        <Semaforo color={ESTADO_SECTOR_COLOR.rojo} n={kpis.sectoresRojo} label="Crítico" />
      </div>

      {/* Alertas */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-foreground">
            Alertas ({alertas.length})
          </h3>
        </div>
        {alertas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin alertas activas.</p>
        ) : (
          <ul className="space-y-1.5">
            {alertas.slice(0, 30).map((a, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border-l-4 bg-muted/30 px-3 py-2 text-xs",
                  a.nivel === "critico" ? "border-destructive" : "border-amber-500",
                )}
              >
                <div className="font-medium text-foreground">{a.titulo}</div>
                <div className="text-muted-foreground">{a.detalle}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Limpieza y recolección */}
      {mantenimiento.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Brush className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Limpieza y recolección</h3>
            {vencidos > 0 && (
              <Badge variant="destructive">{vencidos} vencido{vencidos > 1 ? "s" : ""}</Badge>
            )}
          </div>
          <div className="space-y-1.5">
            {mantenimiento.map(({ p, info }) => (
              <Card key={p.id} size="sm" className="py-2">
                <CardContent className="flex items-center gap-2 px-3">
                  <span
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ background: info?.color ?? "#94a3b8" }}
                  />
                  <span className="text-sm">{META_POR_TIPO[p.tipo]?.icono ?? "❓"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground">
                      {p.nombre || META_POR_TIPO[p.tipo]?.label || p.tipo}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.ultimaLimpieza
                        ? `Hace ${formatoDuracion(ahora - p.ultimaLimpieza)}`
                        : "Sin registro"}
                      {info?.venceEnMs != null &&
                        info.estado !== "sin_programar" &&
                        (info.venceEnMs >= 0
                          ? ` · vence en ${formatoDuracion(info.venceEnMs)}`
                          : ` · vencida hace ${formatoDuracion(Math.abs(info.venceEnMs))}`)}
                    </div>
                  </div>
                  {puedeEditar && (
                    <Button
                      size="xs"
                      variant="secondary"
                      className="shrink-0 bg-emerald-700/80 text-white hover:bg-emerald-600"
                      onClick={() => onMarcarLimpio(p.id)}
                      title="Marcar como limpiado/recogido ahora"
                    >
                      <Brush className="size-3" />
                      Limpio
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Cobertura por sector */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Sectores</h3>
        </div>
        {sectores.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aún no hay sectores. Dibuja el primero desde el mapa.
          </p>
        ) : (
          <div className="space-y-2">
            {sectores.map((s) => {
              const estado = estadoSector(s, puntos);
              const cobertura = calcularCobertura(s, puntos);
              return (
                <Card
                  key={s.id}
                  size="sm"
                  className="overflow-hidden"
                  style={{ borderLeft: `4px solid ${s.color || "#2dd4bf"}` }}
                >
                  <button
                    onClick={() => onIrASector(s.id)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <span
                            className="inline-block size-3 rounded-full"
                            style={{ background: ESTADO_SECTOR_COLOR[estado] }}
                            title="Estado de cobertura"
                          />
                          Sector {s.nombre}
                        </CardTitle>
                        <CardDescription className="shrink-0 text-[11px]">
                          {(s.carpas || 0) > 0 && `${s.carpas} carp · `}
                          {s.poblacion_estimada || 0} pers · {s.familias || 0} fam
                        </CardDescription>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cobertura.map((c) => (
                          <Badge
                            key={c.tipo}
                            variant="outline"
                            title={`${c.disponible}/${c.requerido} — ${c.descripcion}`}
                            className={cn(
                              "text-[11px]",
                              c.porcentaje >= 100
                                ? "border-emerald-500/40 text-emerald-300"
                                : c.porcentaje >= 50
                                  ? "border-amber-500/40 text-amber-300"
                                  : "border-destructive/40 text-red-300",
                            )}
                          >
                            {META_POR_TIPO[c.tipo]?.icono ?? "❓"} {c.porcentaje}%
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                  </button>

                  <CardContent className="space-y-3 pt-0">
                    <DemografiaResumen
                      vulnerables={s.vulnerables}
                      compacto
                      mostrarEstructura={(s.poblacion_estimada || 0) > 0 || (s.familias || 0) > 0}
                    />

                    {(s.responsables?.length ?? 0) > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1.5">
                          {s.responsables.map((r) => {
                            const cat = CAT_POR_VALOR[r.categoria];
                            return (
                              <div key={r.id} className="flex items-center gap-2 text-xs">
                                <span className="min-w-0 flex-1 truncate">
                                  <span className="text-muted-foreground">
                                    {r.funcion || "General"}:
                                  </span>{" "}
                                  <span className="text-foreground">{r.nombre}</span>
                                  {cat && (
                                    <Badge
                                      variant="outline"
                                      className="ml-1 px-1 py-0 text-[10px]"
                                      style={{ borderColor: `${cat.color}66`, color: cat.color }}
                                    >
                                      {cat.label}
                                    </Badge>
                                  )}
                                </span>
                                {r.telefono && (
                                  <span className="flex shrink-0 gap-1">
                                    <Button
                                      asChild
                                      size="icon-xs"
                                      variant="outline"
                                      className="size-7"
                                    >
                                      <a href={telHref(r.telefono)} title={`Llamar ${r.telefono}`}>
                                        <Phone className="size-3" />
                                      </a>
                                    </Button>
                                    <Button
                                      asChild
                                      size="icon-xs"
                                      variant="outline"
                                      className="size-7 border-emerald-500/30 text-emerald-400"
                                    >
                                      <a
                                        href={waHref(r.telefono)}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="WhatsApp"
                                      >
                                        <MessageCircle className="size-3" />
                                      </a>
                                    </Button>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({
  label,
  valor,
  destacado,
}: {
  label: string;
  valor: number;
  destacado?: "h" | "m" | "v";
}) {
  const color =
    destacado === "h"
      ? "text-sky-300"
      : destacado === "m"
        ? "text-pink-300"
        : destacado === "v"
          ? "text-amber-300"
          : "text-foreground";
  return (
    <Card size="sm" className="py-2">
      <CardContent className="px-3 py-1">
        <div className={cn("text-lg font-bold", color)}>{valor.toLocaleString("es")}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function Semaforo({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted/20 px-2 py-1.5 text-xs">
      <span className="inline-block size-3 rounded-full" style={{ background: color }} />
      <span className="font-bold text-foreground">{n}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
