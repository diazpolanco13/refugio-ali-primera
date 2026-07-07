import { Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Botón minimalista para activar edición in-place en una sección de la ficha. */
export function BotonEditarSeccion({
  onClick,
  className,
  titulo = "Editar",
}: {
  onClick: () => void;
  className?: string;
  titulo?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("size-7 text-muted-foreground hover:text-foreground", className)}
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
    >
      <Pencil className="size-3.5" />
    </Button>
  );
}

/** Acciones Guardar / Cancelar al pie de una sección en edición. */
export function PieEdicionSeccion({
  guardando,
  error,
  onCancelar,
  onGuardar,
}: {
  guardando: boolean;
  error: string | null;
  onCancelar: () => void;
  onGuardar: () => void;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={guardando}
          onClick={onCancelar}
        >
          <X className="size-3.5" />
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
          disabled={guardando}
          onClick={onGuardar}
        >
          {guardando ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar"
          )}
        </Button>
      </div>
    </div>
  );
}
