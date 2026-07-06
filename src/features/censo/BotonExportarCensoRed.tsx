import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import type { RegistroCensoRed } from "@/data/reposCenso";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportarCensoRedExcel, exportarCensoRedPdf } from "./exportarCensoRed";

export function BotonExportarCensoRed({
  filas,
  deshabilitado,
}: {
  filas: RegistroCensoRed[];
  deshabilitado?: boolean;
}) {
  const [exportando, setExportando] = useState<"pdf" | "excel" | null>(null);

  async function exportar(tipo: "pdf" | "excel") {
    setExportando(tipo);
    try {
      if (tipo === "pdf") await exportarCensoRedPdf(filas);
      else await exportarCensoRedExcel(filas);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar los datos");
    } finally {
      setExportando(null);
    }
  }

  const ocupado = exportando != null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={deshabilitado || ocupado}>
          {ocupado ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Exportar datos
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Formato de exportación</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={ocupado} onSelect={() => void exportar("pdf")}>
          <FileText className="size-4" />
          PDF
          {exportando === "pdf" && <Loader2 className="ml-auto size-3.5 animate-spin" />}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={ocupado} onSelect={() => void exportar("excel")}>
          <FileSpreadsheet className="size-4" />
          Excel
          {exportando === "excel" && <Loader2 className="ml-auto size-3.5 animate-spin" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
