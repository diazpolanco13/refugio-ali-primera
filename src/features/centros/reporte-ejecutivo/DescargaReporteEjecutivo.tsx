import { BlobProvider } from "@react-pdf/renderer";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReporteEjecutivoCampamentos } from "@/domain/reporteEjecutivoCampamentos";
import { ReporteEjecutivoCampamentosPdf } from "./ReporteEjecutivoCampamentosPdf";

function nombreArchivo(dia: string): string {
  return `parte-global-campamentos-${dia}.pdf`;
}

export function DescargaReporteEjecutivo({
  reporte,
}: {
  reporte: ReporteEjecutivoCampamentos;
}) {
  return (
    <BlobProvider document={<ReporteEjecutivoCampamentosPdf reporte={reporte} />}>
      {({ url, loading, error }) => {
        if (loading) {
          return (
            <Button type="button" size="sm" variant="default" className="h-8 gap-1.5" disabled>
              <Loader2 className="size-3.5 animate-spin" />
              Generando PDF
            </Button>
          );
        }

        if (error || !url) {
          return (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5"
              title={error?.message ?? "No se pudo generar el PDF"}
              disabled
            >
              <FileText className="size-3.5" />
              PDF no disponible
            </Button>
          );
        }

        return (
          <Button asChild size="sm" variant="default" className="h-8 gap-1.5">
            <a href={url} download={nombreArchivo(reporte.dia)} target="_blank" rel="noreferrer">
              <Download className="size-3.5" />
              PDF Ejecutivo
            </a>
          </Button>
        );
      }}
    </BlobProvider>
  );
}
