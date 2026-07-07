import { FileSpreadsheet, IdCard, MapPinOff } from "lucide-react";
import { pctConCedula, type ResumenCensoCentro } from "@/domain/censoResumen";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function CalidadCensoResumen({ resumen }: { resumen: ResumenCensoCentro }) {
  if (resumen.totalRegistrados <= 0) return null;

  const pctCedula = pctConCedula(resumen);
  const pctImportados =
    resumen.totalRegistrados > 0
      ? Math.round((resumen.importadosPlanilla / resumen.totalRegistrados) * 100)
      : 0;
  const pctSinVivienda =
    resumen.totalRegistrados > 0
      ? Math.round((resumen.sinCondicionVivienda / resumen.totalRegistrados) * 100)
      : 0;

  const alertaCalidad =
    resumen.importadosPlanilla > 0 ||
    resumen.sinCedula > resumen.totalRegistrados * 0.3 ||
    resumen.sinCondicionVivienda > resumen.totalRegistrados * 0.5;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">Calidad del censo</p>
      <div className="flex flex-wrap gap-1">
        <Badge
          variant="outline"
          className={cn(
            "gap-1 px-1.5 text-[10px]",
            pctCedula < 70
              ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
              : "border-border text-muted-foreground",
          )}
        >
          <IdCard className="size-3" />
          {pctCedula}% con cédula
          {resumen.sinCedula > 0 && (
            <span className="tabular-nums">({resumen.sinCedula} S/C)</span>
          )}
        </Badge>

        {resumen.importadosPlanilla > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-violet-500/40 px-1.5 text-[10px] text-violet-700 dark:text-violet-300"
          >
            <FileSpreadsheet className="size-3" />
            {resumen.importadosPlanilla.toLocaleString("es")} import. planilla
            <span className="tabular-nums">({pctImportados}%)</span>
          </Badge>
        )}

        {resumen.sinCondicionVivienda > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "gap-1 px-1.5 text-[10px]",
              pctSinVivienda >= 50
                ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                : "border-border text-muted-foreground",
            )}
          >
            <MapPinOff className="size-3" />
            {resumen.sinCondicionVivienda.toLocaleString("es")} sin vivienda
          </Badge>
        )}

        {resumen.sinEdad > 0 && (
          <Badge variant="outline" className="gap-1 px-1.5 text-[10px] text-muted-foreground">
            {resumen.sinEdad.toLocaleString("es")} sin edad
          </Badge>
        )}
      </div>
      {alertaCalidad && resumen.importadosPlanilla > 0 && (
        <p className="text-[10px] leading-snug text-violet-700 dark:text-violet-300">
          Hay registros cargados por planilla: conviene completar el formulario en terreno (cédula,
          condición de vivienda, etc.).
        </p>
      )}
    </div>
  );
}
