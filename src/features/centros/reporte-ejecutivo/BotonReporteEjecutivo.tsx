import { FileText, Loader2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReporteEjecutivoCampamentos } from "@/domain/reporteEjecutivoCampamentos";

const DescargaReporteEjecutivo = lazy(() =>
  import("./DescargaReporteEjecutivo").then((m) => ({
    default: m.DescargaReporteEjecutivo,
  })),
);

export function BotonReporteEjecutivo({
  reporte,
}: {
  reporte: ReporteEjecutivoCampamentos;
}) {
  const [solicitado, setSolicitado] = useState(false);

  if (!solicitado) {
    return (
      <Button
        type="button"
        size="sm"
        variant="default"
        className="h-8 gap-1.5"
        onClick={() => setSolicitado(true)}
      >
        <FileText className="size-3.5" />
        PDF Ejecutivo
      </Button>
    );
  }

  return (
    <Suspense
      fallback={
        <Button type="button" size="sm" variant="default" className="h-8 gap-1.5" disabled>
          <Loader2 className="size-3.5 animate-spin" />
          Cargando PDF
        </Button>
      }
    >
      <DescargaReporteEjecutivo reporte={reporte} />
    </Suspense>
  );
}
