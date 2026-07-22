import { BlobProvider } from "@react-pdf/renderer";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMembretePdf } from "@/data/useMembretePdf";
import {
  ReporteVerificacionCensoPdf,
  type DatosReporteVerificacionCenso,
} from "./ReporteVerificacionCensoPdf";

function nombreArchivo(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `verificacion-poblacional-${yyyy}${mm}${dd}-${hh}${mi}.pdf`;
}

export function DescargaReporteVerificacionCenso({
  datos,
}: {
  datos: DatosReporteVerificacionCenso;
}) {
  const membrete = useMembretePdf();

  if (!membrete) {
    return (
      <Button type="button" size="sm" variant="default" className="h-8 gap-1.5" disabled>
        <Loader2 className="size-3.5 animate-spin" />
        Generando PDF
      </Button>
    );
  }

  return (
    <BlobProvider
      document={<ReporteVerificacionCensoPdf datos={datos} membrete={membrete} />}
    >
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
            <a
              href={url}
              download={nombreArchivo(datos.fechaCorteTs)}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="size-3.5" />
              Descargar PDF
            </a>
          </Button>
        );
      }}
    </BlobProvider>
  );
}
