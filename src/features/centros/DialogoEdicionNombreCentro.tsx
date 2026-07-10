import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  abierto: boolean;
  centro: CentroTransitorio;
  guardando?: boolean;
  error?: string | null;
  onCerrar: () => void;
  onGuardar: (nombre: string) => void;
}

/** Diálogo para corregir el nombre del campamento desde la ficha. */
export function DialogoEdicionNombreCentro({
  abierto,
  centro,
  guardando = false,
  error = null,
  onCerrar,
  onGuardar,
}: Props) {
  const [nombre, setNombre] = useState(centro.nombre);

  useEffect(() => {
    if (!abierto) return;
    setNombre(centro.nombre);
  }, [abierto, centro.id, centro.nombre]);

  const limpio = nombre.trim();
  const sinCambios = limpio === centro.nombre.trim();
  const invalido = limpio.length === 0;

  function confirmar() {
    if (invalido || guardando) return;
    onGuardar(limpio);
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !guardando && onCerrar()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="text-base">Editar nombre del campamento</DialogTitle>
          <DialogDescription className="text-xs">
            {centro.nro != null ? `N.° ${centro.nro} · ` : ""}
            Corrige el nombre tal como debe figurar en la red.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-4 py-4 sm:px-6">
          <Label htmlFor="editar-nombre-centro" className="text-[11px] text-muted-foreground">
            Nombre
          </Label>
          <Input
            id="editar-nombre-centro"
            value={nombre}
            disabled={guardando}
            autoFocus
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmar();
              }
            }}
            placeholder="Nombre del campamento"
          />
          {invalido && (
            <p className="text-[11px] text-destructive">El nombre no puede quedar vacío.</p>
          )}
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={guardando}
            onClick={onCerrar}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-teal-600 hover:bg-teal-500"
            disabled={guardando || invalido || sinCambios}
            onClick={confirmar}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
