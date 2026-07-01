import {
  calcularCobertura,
  estadoSector,
  generarAlertas,
  kpisGlobales,
} from "../../domain/brechas";
import { esMantenimiento, formatoDuracion, infoLimpieza } from "../../domain/limpieza";
import {
  CATEGORIAS_RESPONSABLE,
  ESTADO_SECTOR_COLOR,
  META_POR_TIPO,
  type CategoriaResponsable,
  type PuntoServicio,
  type Sector,
} from "../../domain/tipos";

const CAT_POR_VALOR = Object.fromEntries(
  CATEGORIAS_RESPONSABLE.map((c) => [c.valor, c]),
) as Record<CategoriaResponsable, (typeof CATEGORIAS_RESPONSABLE)[number]>;

const telHref = (t: string) => `tel:${t.replace(/[^\d+]/g, "")}`;
const waHref = (t: string) => `https://wa.me/${t.replace(/\D/g, "")}`;

interface Props {
  sectores: Sector[];
  puntos: PuntoServicio[];
  ahora: number;
  onMarcarLimpio: (id: string) => void;
  onIrASector: (id: string) => void;
}

export function Tablero({ sectores, puntos, ahora, onMarcarLimpio, onIrASector }: Props) {
  const kpis = kpisGlobales(sectores, puntos);
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
        <Kpi label="Vulnerables" valor={kpis.vulnerablesTotal} />
        <Kpi label="Sectores" valor={kpis.sectores} />
        <Kpi label="Puntos operativos" valor={kpis.puntosOperativos} />
        <Kpi label="Puntos totales" valor={kpis.puntosTotal} />
      </div>

      {/* Semáforo de sectores */}
      <div className="flex gap-2 text-xs">
        <Semaforo color={ESTADO_SECTOR_COLOR.verde} n={kpis.sectoresVerde} label="OK" />
        <Semaforo color={ESTADO_SECTOR_COLOR.amarillo} n={kpis.sectoresAmarillo} label="Alerta" />
        <Semaforo color={ESTADO_SECTOR_COLOR.rojo} n={kpis.sectoresRojo} label="Crítico" />
      </div>

      {/* Alertas */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">
          Alertas ({alertas.length})
        </h3>
        {alertas.length === 0 ? (
          <p className="text-xs text-slate-500">Sin alertas activas.</p>
        ) : (
          <ul className="space-y-1.5">
            {alertas.slice(0, 30).map((a, i) => (
              <li
                key={i}
                className={`rounded-md border-l-4 bg-slate-800/60 px-3 py-2 text-xs ${
                  a.nivel === "critico" ? "border-red-500" : "border-amber-500"
                }`}
              >
                <div className="font-medium text-slate-200">{a.titulo}</div>
                <div className="text-slate-400">{a.detalle}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Limpieza y recolección */}
      {mantenimiento.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            Limpieza y recolección
            {vencidos > 0 && (
              <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-[11px] text-red-300">
                {vencidos} vencido{vencidos > 1 ? "s" : ""}
              </span>
            )}
          </h3>
          <div className="space-y-1.5">
            {mantenimiento.map(({ p, info }) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/50 px-2.5 py-2"
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: info?.color ?? "#94a3b8" }}
                />
                <span className="text-sm">{META_POR_TIPO[p.tipo].icono}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-200">
                    {p.nombre || META_POR_TIPO[p.tipo].label}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {p.ultimaLimpieza
                      ? `Hace ${formatoDuracion(ahora - p.ultimaLimpieza)}`
                      : "Sin registro"}
                    {info?.venceEnMs != null &&
                      info.estado !== "sin_programar" &&
                      (info.venceEnMs >= 0
                        ? ` · vence en ${formatoDuracion(info.venceEnMs)}`
                        : ` · vencida hace ${formatoDuracion(info.venceEnMs)}`)}
                  </div>
                </div>
                <button
                  onClick={() => onMarcarLimpio(p.id)}
                  className="shrink-0 rounded-md bg-green-700/70 px-2 py-1 text-xs font-medium text-white hover:bg-green-600"
                  title="Marcar como limpiado/recogido ahora"
                >
                  🧹 Limpio
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cobertura por sector */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Sectores</h3>
        {sectores.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aún no hay sectores. Dibuja el primero desde el mapa.
          </p>
        ) : (
          <div className="space-y-2">
            {sectores.map((s) => {
              const estado = estadoSector(s, puntos);
              const cobertura = calcularCobertura(s, puntos);
              return (
                <div
                  key={s.id}
                  className="rounded-lg border border-slate-700 bg-slate-800/50 p-3"
                  style={{ borderLeft: `4px solid ${s.color || "#2dd4bf"}` }}
                >
                  <button
                    onClick={() => onIrASector(s.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-semibold text-slate-100">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: ESTADO_SECTOR_COLOR[estado] }}
                          title="Estado de cobertura"
                        />
                        Sector {s.nombre}
                      </span>
                      <span className="text-xs text-slate-400">
                        {s.poblacion_estimada} pers · {s.familias} fam
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {cobertura.map((c) => (
                        <span
                          key={c.tipo}
                          title={`${c.disponible}/${c.requerido} — ${c.descripcion}`}
                          className={`rounded px-1.5 py-0.5 text-[11px] ${
                            c.porcentaje >= 100
                              ? "bg-green-900/50 text-green-300"
                              : c.porcentaje >= 50
                                ? "bg-amber-900/50 text-amber-300"
                                : "bg-red-900/50 text-red-300"
                          }`}
                        >
                          {META_POR_TIPO[c.tipo].icono} {c.porcentaje}%
                        </span>
                      ))}
                    </div>
                  </button>

                  {s.responsables.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-slate-700/60 pt-2">
                      {s.responsables.map((r) => {
                        const cat = CAT_POR_VALOR[r.categoria];
                        return (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-slate-300">
                                {r.funcion || "General"}:
                              </span>{" "}
                              <span className="text-slate-100">{r.nombre}</span>
                              {cat && (
                                <span
                                  className="ml-1 rounded px-1 py-0.5 text-[10px]"
                                  style={{ background: `${cat.color}33`, color: cat.color }}
                                >
                                  {cat.label}
                                </span>
                              )}
                            </span>
                            {r.telefono && (
                              <span className="flex shrink-0 gap-1">
                                <a
                                  href={telHref(r.telefono)}
                                  className="rounded bg-slate-700 px-1.5 py-0.5 hover:bg-slate-600"
                                  title={`Llamar ${r.telefono}`}
                                >
                                  📞
                                </a>
                                <a
                                  href={waHref(r.telefono)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded bg-green-700/60 px-1.5 py-0.5 hover:bg-green-700"
                                  title="WhatsApp"
                                >
                                  💬
                                </a>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
      <div className="text-lg font-bold text-slate-100">{valor.toLocaleString("es")}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

function Semaforo({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-700 bg-slate-800/50 px-2 py-1.5">
      <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
      <span className="font-bold text-slate-100">{n}</span>
      <span className="text-slate-400">{label}</span>
    </div>
  );
}
