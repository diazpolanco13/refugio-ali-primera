import { Link } from "react-router-dom";
import {
  aVulnerables,
  estadoCensoCentro,
  estadoContrasteCenso,
  type ResumenCensoCentro,
} from "@/domain/censoResumen";
import { DemografiaResumen } from "@/features/tablero/DemografiaResumen";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalidadCensoResumen } from "./CalidadCensoResumen";
import { ContrasteCensoParte } from "./ContrasteCensoParte";

const META_ESTADO = {
  sin_iniciar: {
    label: "Sin iniciar",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  en_curso: {
    label: "En curso",
    clase: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  completado_declarado: {
    label: "Cierre declarado",
    clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  sin_ocupantes: {
    label: "Sin ocupantes",
    clase: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
} as const;

const META_CONTRASTE = {
  sin_parte: null,
  sin_censo: null,
  en_progreso: {
    label: "En progreso",
    clase: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  cuadra: {
    label: "Cuadra",
    clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  excede_parte: {
    label: "Discrepancia",
    clase: "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300",
  },
} as const;

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeEstado(resumen: ResumenCensoCentro) {
  const contraste = estadoContrasteCenso(resumen);
  const contrasteMeta = META_CONTRASTE[contraste];
  if (contrasteMeta) return contrasteMeta;
  return META_ESTADO[estadoCensoCentro(resumen)];
}

interface Props {
  resumen: ResumenCensoCentro;
}

export function TarjetaCensoResumen({ resumen }: Props) {
  const estadoBadge = badgeEstado(resumen);
  const contraste = estadoContrasteCenso(resumen);
  const bordeCard =
    contraste === "excede_parte"
      ? "border-red-500/40 shadow-red-500/5"
      : contraste === "cuadra"
        ? "border-emerald-500/25"
        : "border-teal-500/20";

  return (
    <Link
      to={`/centros/registro/${resumen.centroId}`}
      className="block rounded-xl transition-colors hover:bg-teal-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
      <Card className={cn("h-full shadow-sm", bordeCard)}>
        <CardHeader className="gap-2 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-sm leading-snug">{resumen.centroNombre}</CardTitle>
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", estadoBadge.clase)}>
              {estadoBadge.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <ContrasteCensoParte resumen={resumen} />

          <p className="text-[10px] text-muted-foreground">
            Último registro: {formatearFecha(resumen.ultimoRegistroEn)}
          </p>
          {resumen.cierreEn && (
            <p
              className={cn(
                "text-[10px]",
                estadoCensoCentro(resumen) === "sin_ocupantes"
                  ? "text-violet-700 dark:text-violet-300"
                  : "text-emerald-700 dark:text-emerald-300",
              )}
            >
              {estadoCensoCentro(resumen) === "sin_ocupantes"
                ? "Cerrado sin ocupantes"
                : "Cierre declarado"}
              : {formatearFecha(resumen.cierreEn)}
              {resumen.cierreFuncionario ? ` · ${resumen.cierreFuncionario}` : ""}
            </p>
          )}

          <CalidadCensoResumen resumen={resumen} />

          <DemografiaResumen vulnerables={aVulnerables(resumen)} compacto />
        </CardContent>
      </Card>
    </Link>
  );
}
