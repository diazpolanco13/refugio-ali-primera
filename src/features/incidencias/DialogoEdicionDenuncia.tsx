import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CATEGORIAS_DENUNCIA,
  type CategoriaDenuncia,
  type Denuncia,
} from "@/domain/denuncias";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface DatosFormularioDenuncia {
  categoria: CategoriaDenuncia;
  titulo: string;
  texto: string;
  contacto: string;
}

interface Props {
  denuncia: Denuncia | null;
  abierto: boolean;
  guardando?: boolean;
  error?: string | null;
  onCerrar: () => void;
  onGuardar: (datos: DatosFormularioDenuncia) => void;
}

function datosDesde(denuncia: Denuncia): DatosFormularioDenuncia {
  return {
    categoria: denuncia.categoria,
    titulo: denuncia.titulo ?? "",
    texto: denuncia.texto,
    contacto: denuncia.contacto ?? "",
  };
}

/** Diálogo para editar una denuncia de damnificados (admin / analista SAE). */
export function DialogoEdicionDenuncia({
  denuncia,
  abierto,
  guardando = false,
  error = null,
  onCerrar,
  onGuardar,
}: Props) {
  const [datos, setDatos] = useState<DatosFormularioDenuncia>({
    categoria: "otro",
    titulo: "",
    texto: "",
    contacto: "",
  });

  useEffect(() => {
    if (!abierto || !denuncia) return;
    setDatos(datosDesde(denuncia));
  }, [abierto, denuncia]);

  const tituloOk = datos.titulo.trim().length >= 3 && datos.titulo.trim().length <= 120;
  const textoOk = datos.texto.trim().length >= 10 && datos.texto.trim().length <= 1200;
  const puedeGuardar = tituloOk && textoOk && !guardando;

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="text-base">Editar denuncia</DialogTitle>
          <DialogDescription className="text-xs">
            Corrige categoría, título, texto o contacto. Queda registrado en la bitácora.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Categoría</Label>
            <Select
              value={datos.categoria}
              onValueChange={(v) =>
                setDatos((prev) => ({ ...prev, categoria: v as CategoriaDenuncia }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_DENUNCIA.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Título</Label>
            <Input
              value={datos.titulo}
              maxLength={120}
              onChange={(e) => setDatos((prev) => ({ ...prev, titulo: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground">
              {datos.titulo.trim().length}/120 · mínimo 3
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Texto</Label>
            <Textarea
              value={datos.texto}
              maxLength={1200}
              rows={5}
              onChange={(e) => setDatos((prev) => ({ ...prev, texto: e.target.value }))}
            />
            <p className="text-[10px] text-muted-foreground">
              {datos.texto.trim().length}/1200 · mínimo 10
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">
              Contacto voluntario (opcional)
            </Label>
            <Input
              value={datos.contacto}
              maxLength={120}
              onChange={(e) => setDatos((prev) => ({ ...prev, contacto: e.target.value }))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t border-border px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!puedeGuardar}
            onClick={() => onGuardar(datos)}
          >
            {guardando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
