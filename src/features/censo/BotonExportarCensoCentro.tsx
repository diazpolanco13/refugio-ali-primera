import { useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type { RegistroCensoGuardado } from "@/data/reposCenso";
import { Button } from "@/components/ui/button";
import { exportarCensoCentroExcel, exportarCensoCentroPdf } from "./exportarCensoCentro";

export function BotonExportarCensoCentro({
  obtenerFilas,
  centroNombre,
  totalEsperado,
  deshabilitado,
}: {
  obtenerFilas: (
    onProgreso?: (cargados: number, total: number) => void,
  ) => Promise<RegistroCensoGuardado[]>;
  centroNombre: string;
  totalEsperado?: number;
  deshabilitado?: boolean;
}) {
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);
  const [progreso, setProgreso] = useState<{ cargados: number; total: number } | null>(null);

  async function exportar(tipo: "pdf" | "excel") {
    setExportando(tipo);
    setProgreso(null);
    try {
      const filas = await obtenerFilas((cargados, total) => {
        setProgreso({ cargados, total });
      });
      if (filas.length === 0) {
        alert("No hay registros para exportar.");
        return;
      }
      if (tipo === "pdf") await exportarCensoCentroPdf(filas, centroNombre);
      else await exportarCensoCentroExcel(filas, centroNombre);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar los datos");
    } finally {
      setExportando(null);
      setProgreso(null);
    }
  }

  const ocupado = exportando != null;
  const etiquetaProgreso =
    progreso != null
      ? `${progreso.cargados.toLocaleString("es")}/${progreso.total.toLocaleString("es")}`
      : totalEsperado != null && totalEsperado > 0
        ? totalEsperado.toLocaleString("es")
        : null;

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
        {exportando === "excel" && etiquetaProgreso
          ? `Excel ${etiquetaProgreso}`
          : "Descargar Excel"}
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
        {exportando === "pdf" && etiquetaProgreso
          ? `PDF ${etiquetaProgreso}`
          : "Descargar PDF"}
      </Button>
    </div>
  );
}
