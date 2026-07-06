import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import {
  aVulnerables,
  estadoCensoCentro,
  type ResumenCensoCentro,
} from "@/domain/censoResumen";
import { DemografiaResumen } from "@/features/tablero/DemografiaResumen";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const META_ESTADO = {
  sin_iniciar: {
    label: "Sin iniciar",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  en_curso: {
    label: "En curso",
    clase: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  completado_declarado: {
    label: "Completado declarado",
    clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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

interface Props {
  resumen: ResumenCensoCentro;
  maxRegistradosRed: number;
}

export function TarjetaCensoResumen({ resumen, maxRegistradosRed }: Props) {
  const estado = estadoCensoCentro(resumen);
  const meta = META_ESTADO[estado];
  const progreso =
    maxRegistradosRed > 0
      ? Math.round((resumen.totalRegistrados / maxRegistradosRed) * 100)
      : 0;

  return (
    <Link
      to={`/centros/censo-rapido/${resumen.centroId}`}
      className="block rounded-xl transition-colors hover:bg-teal-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
    >
    <Card className="h-full border-teal-500/20 shadow-sm">
      <CardHeader className="gap-2 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 text-sm leading-snug">{resumen.centroNombre}</CardTitle>
          <Badge variant="outline" className={cn("shrink-0 text-[10px]", meta.clase)}>
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-3xl font-bold tabular-nums text-foreground">
              {resumen.totalRegistrados.toLocaleString("es")}
            </p>
            <p className="text-[11px] text-muted-foreground">registrados</p>
          </div>
          <Progress
            value={progreso}
            className="mt-2 h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-teal-500"
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Último registro: {formatearFecha(resumen.ultimoRegistroEn)}
          </p>
          {resumen.cierreEn && (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
              Cierre declarado: {formatearFecha(resumen.cierreEn)}
              {resumen.cierreFuncionario ? ` · ${resumen.cierreFuncionario}` : ""}
            </p>
          )}
        </div>

        <DemografiaResumen vulnerables={aVulnerables(resumen)} compacto />

        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Users className="size-3" />
            Condición y vivienda
          </p>
          <div className="flex flex-wrap gap-1">
            <BadgeCondicion
              valor={resumen.embarazadas}
              label="Embarazadas"
              clase="border-pink-500/30 text-pink-600 dark:text-pink-300"
            />
            <BadgeCondicion
              valor={resumen.discapacidad}
              label="Discapacidad"
              clase="border-amber-500/30 text-amber-600 dark:text-amber-300"
            />
            <BadgeCondicion
              valor={resumen.enfermedad}
              label="Enf. condicionante"
              clase="border-red-500/30 text-red-600 dark:text-red-300"
            />
            <BadgeCondicion
              valor={resumen.viviendaDestruida}
              label="Destruida"
              clase="border-orange-500/30 text-orange-600 dark:text-orange-300"
            />
            <BadgeCondicion
              valor={resumen.viviendaInhabitable}
              label="Inhabitable"
              clase="border-yellow-500/30 text-yellow-700 dark:text-yellow-300"
            />
            <BadgeCondicion
              valor={resumen.viviendaNoPosee}
              label="No posee"
              clase="border-slate-500/30 text-slate-600 dark:text-slate-300"
            />
            {resumen.embarazadas +
              resumen.discapacidad +
              resumen.enfermedad +
              resumen.viviendaDestruida +
              resumen.viviendaInhabitable +
              resumen.viviendaNoPosee ===
              0 && (
              <span className="text-[10px] text-muted-foreground">Sin condiciones registradas</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
