// Barra de progreso del censo nominal vs meta del parte numérico.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useAlojamientosCentro } from "@/data/useAlojamientosCentro";
import {
  alojamientosActivos,
  contarFamiliasActivas,
  progresoCensoNominal,
} from "@/domain/refugiados";
import { normalizarCentro, poblacionCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  centro: CentroTransitorio;
}

export function ProgresoCensoPoblacion({ centro }: Props) {
  const navigate = useNavigate();
  const c = normalizarCentro(centro);
  const metaRefugiados = poblacionCentro(centro);
  const metaFamilias = c.familias_ocupadas ?? 0;

  const { alojamientos, cargando } = useAlojamientosCentro({ centroId: centro.id, estado: "activo" });

  const progreso = useMemo(() => {
    const activos = alojamientosActivos(alojamientos);
    return progresoCensoNominal(
      { refugiados: metaRefugiados, familias: metaFamilias },
      {
        refugiados: activos.length,
        familias: contarFamiliasActivas(activos),
      },
    );
  }, [alojamientos, metaRefugiados, metaFamilias]);

  const sinMeta = metaRefugiados === 0 && metaFamilias === 0;

  function irPoblacion() {
    navigate(`/centro/${centro.id}?vista=poblacion`);
  }

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ClipboardList className="size-4 text-muted-foreground" />
          Progreso del censo nominal
        </CardTitle>
        <CardDescription className="text-xs">
          Comparado con el parte numérico del campamento
          {cargando && " · actualizando…"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sinMeta ? (
          <p className="text-xs text-muted-foreground">Sin parte numérico registrado en el campamento.</p>
        ) : (
          <button
            type="button"
            onClick={irPoblacion}
            className={cn(
              "w-full space-y-3 rounded-lg text-left transition-colors",
              "hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <BarraProgreso
              etiqueta="Damnificados"
              actual={progreso.registradosRefugiados}
              meta={progreso.metaRefugiados}
              pct={progreso.pctRefugiados}
            />
            <BarraProgreso
              etiqueta="Familias"
              actual={progreso.registradosFamilias}
              meta={progreso.metaFamilias}
              pct={progreso.pctFamilias}
            />
            <p className="text-[10px] text-muted-foreground">
              Clic para ir a la pestaña Población y continuar el registro nominal.
            </p>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function BarraProgreso({
  etiqueta,
  actual,
  meta,
  pct,
}: {
  etiqueta: string;
  actual: number;
  meta: number;
  pct: number;
}) {
  const faltan = Math.max(0, meta - actual);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{etiqueta}</span>
        <span className="tabular-nums text-muted-foreground">
          {actual.toLocaleString("es")} / {meta.toLocaleString("es")}
          {faltan > 0 && (
            <span className="ml-1 text-amber-500">
              (faltan {faltan.toLocaleString("es")})
            </span>
          )}
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}
