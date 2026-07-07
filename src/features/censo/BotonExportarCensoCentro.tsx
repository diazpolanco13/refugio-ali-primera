import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type { RegistroCensoGuardado } from "@/data/reposCenso";
import { Button } from "@/components/ui/button";
import { exportarCensoCentroExcel, exportarCensoCentroPdf } from "./exportarCensoCentro";

export function BotonExportarCensoCentro({
  filas,
  centroNombre,
  deshabilitado,
}: {
  filas: RegistroCensoGuardado[];
  centroNombre: string;
  deshabilitado?: boolean;
}) {
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);

  async function exportar(tipo: "pdf" | "excel") {
    setExportando(tipo);
    try {
      if (tipo === "pdf") await exportarCensoCentroPdf(filas, centroNombre);
      else await exportarCensoCentroExcel(filas, centroNombre);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar los datos");
    } finally {
      setExportando(null);
    }
  }

  const ocupado = exportando != null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={deshabilitado || ocupado}
        onClick={() => void exportar("excel")}
      >
        {exportando === "excel" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
        Descargar Excel
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={deshabilitado || ocupado}
        onClick={() => void exportar("pdf")}
      >
        {exportando === "pdf" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileText className="size-4" />
        )}
        Descargar PDF
      </Button>
    </div>
  );
}
