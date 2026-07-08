import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PaginadorTabla({
  pagina,
  totalPaginas,
  totalFilas,
  filasPorPagina,
  cargando,
  onPagina,
  className,
}: {
  pagina: number;
  totalPaginas: number;
  totalFilas: number;
  filasPorPagina: number;
  cargando?: boolean;
  onPagina: (pagina: number) => void;
  className?: string;
}) {
  if (totalFilas === 0) return null;

  const desde = pagina * filasPorPagina + 1;
  const hasta = Math.min((pagina + 1) * filasPorPagina, totalFilas);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        Mostrando {desde.toLocaleString("es")}–{hasta.toLocaleString("es")} de{" "}
        {totalFilas.toLocaleString("es")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={cargando || pagina <= 0}
          onClick={() => onPagina(pagina - 1)}
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <span className="min-w-24 text-center text-xs tabular-nums text-muted-foreground">
          Página {pagina + 1} de {totalPaginas.toLocaleString("es")}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={cargando || pagina >= totalPaginas - 1}
          onClick={() => onPagina(pagina + 1)}
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
