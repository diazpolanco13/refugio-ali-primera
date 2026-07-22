// Tarjeta de progreso del censo nominal vs parte (tablero red).

import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import type { ResumenCensoNominalCentro } from "@/domain/censoNominalRed";
import { estadoCensoNominalRed } from "@/domain/censoNominalRed";
import { BarraAvanceCenso } from "@/features/censo/AvanceCensoNominal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const META_BADGE = {
  sin_iniciar: {
    label: "Sin iniciar",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  en_curso: {
    label: "En progreso",
    clase: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  meta_alcanzada: {
    label: "Cuadra",
    clase:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  discrepancia: {
    label: "Discrepancia",
    clase: "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300",
  },
} as const;

const META_CONTRASTE_EXTRA = {
  sin_parte: {
    label: "Sin parte",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  sin_censo: {
    label: "Sin registro",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  en_progreso: null,
  cuadra: null,
  excede_parte: null,
} as const;

function formatearFechaTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatearDia(dia: string | null): string {
  if (!dia) return "—";
  const [y, m, d] = dia.split("-").map(Number);
  if (!y || !m || !d) return dia;
  return new Date(y, m - 1, d).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BadgeCondicion({
  valor,
  label,
  clase,
}: {
  valor: number;
  label: string;
  clase?: string;
}) {
  if (valor <= 0) return null;
  return (
    <Badge variant="outline" className={cn("gap-1 px-1.5 text-[10px]", clase)}>
      {label}
      <span className="tabular-nums">{valor.toLocaleString("es")}</span>
    </Badge>
  );
}

function mensajeAvance(r: ResumenCensoNominalCentro): string {
  const faltan = Math.max(0, r.metaRefugiados - r.registrados);
  if (r.contraste === "excede_parte") {
    return `Discrepancia: el registro supera el parte numérico${r.parteDia ? ` del ${formatearDia(r.parteDia)}` : ""}.`;
  }
  if (r.contraste === "cuadra") {
    return "Registro cuadra con el último parte";
  }
  if (r.registrados <= 0) {
    return r.metaRefugiados > 0
      ? `Parte: ${r.metaRefugiados.toLocaleString("es")} · sin personas nominales aún`
      : "Sin parte numérico ni registro nominal";
  }
  if (r.metaRefugiados <= 0) {
    return `${r.registrados.toLocaleString("es")} registrado${r.registrados === 1 ? "" : "s"} · sin parte para contrastar`;
  }
  return `Registro en progreso — faltan ${faltan.toLocaleString("es")} por registrar`;
}

interface Props {
  resumen: ResumenCensoNominalCentro;
}

export function TarjetaCensoNominal({ resumen }: Props) {
  const estado = estadoCensoNominalRed(resumen);
  const badge =
    META_CONTRASTE_EXTRA[resumen.contraste] ?? META_BADGE[estado];
  const bordeCard =
    resumen.contraste === "excede_parte"
      ? "border-red-500/40 shadow-red-500/5"
      : resumen.contraste === "cuadra"
        ? "border-emerald-500/25"
        : "border-teal-500/20";

  const titulo =
    resumen.nro != null
      ? `N.° ${resumen.nro} · ${resumen.centroNombre}`
      : resumen.centroNombre;

  return (
    <Link
      to={`/centros/registro/${resumen.centroId}`}
      className="block rounded-xl transition-colors hover:bg-teal-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
      <Card className={cn("h-full shadow-sm", bordeCard)}>
        <CardHeader className="gap-2 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-sm leading-snug">
              {titulo}
            </CardTitle>
            <Badge
              variant="outline"
              className={cn("shrink-0 text-[10px]", badge.clase)}
            >
              {badge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border bg-muted/30 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Parte
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {resumen.metaRefugiados > 0
                  ? resumen.metaRefugiados.toLocaleString("es")
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 px-2 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Registrados
              </p>
              <p className="text-lg font-semibold tabular-nums text-primary">
                {resumen.registrados.toLocaleString("es")}
              </p>
            </div>
          </div>

          {resumen.metaRefugiados > 0 ? (
            <BarraAvanceCenso
              etiqueta="Damnificados"
              actual={resumen.registrados}
              meta={resumen.metaRefugiados}
              pct={resumen.pctRefugiados}
            />
          ) : null}

          <p
            className={cn(
              "text-[11px] leading-snug",
              resumen.contraste === "excede_parte"
                ? "text-red-600 dark:text-red-300"
                : "text-muted-foreground",
            )}
          >
            {mensajeAvance(resumen)}
          </p>

          <p className="text-[10px] text-muted-foreground">
            Familias:{" "}
            <span className="tabular-nums text-foreground">
              {resumen.familias.toLocaleString("es")}
            </span>
            {resumen.metaFamilias > 0
              ? ` / ${resumen.metaFamilias.toLocaleString("es")}`
              : ""}
            {" · "}
            Último registro: {formatearFechaTs(resumen.ultimoRegistroTs)}
          </p>

          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Users className="size-3" />
              Demografía nominal
            </p>
            <div className="flex flex-wrap gap-1">
              <BadgeCondicion
                valor={resumen.mujeres}
                label="Mujeres"
                clase="border-pink-500/30 text-pink-600 dark:text-pink-300"
              />
              <BadgeCondicion
                valor={resumen.hombres}
                label="Hombres"
                clase="border-sky-500/30 text-sky-600 dark:text-sky-300"
              />
              <BadgeCondicion
                valor={resumen.adultosMayores}
                label="Adultos 60+"
                clase="border-violet-500/30 text-violet-600 dark:text-violet-300"
              />
              <BadgeCondicion
                valor={resumen.menores}
                label="Menores"
                clase="border-teal-500/30 text-teal-600 dark:text-teal-300"
              />
              {resumen.registrados === 0 ? (
                <span className="text-[10px] text-muted-foreground">
                  Sin personas nominales
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
