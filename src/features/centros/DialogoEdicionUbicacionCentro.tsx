import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SelectoresGeo } from "@/components/SelectoresGeo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  normalizarUbicacionCentro,
  type UbicacionAdministrativa,
} from "@/domain/catalogosHumanitarios";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

interface Props {
  abierto: boolean;
  centro: CentroTransitorio;
  guardando?: boolean;
  error?: string | null;
  onCerrar: () => void;
  onGuardar: (ubicacion: UbicacionAdministrativa) => void;
}

/** Diálogo para corregir estado / municipio / parroquia desde la ficha. */
export function DialogoEdicionUbicacionCentro({
  abierto,
  centro,
  guardando = false,
  error = null,
  onCerrar,
  onGuardar,
}: Props) {
  const [ubicacion, setUbicacion] = useState<UbicacionAdministrativa>(() =>
    normalizarUbicacionCentro(centro),
  );

  useEffect(() => {
    if (!abierto) return;
    setUbicacion(normalizarUbicacionCentro(centro));
  }, [
    abierto,
    centro.id,
    centro.estado_federativo,
    centro.municipio,
    centro.parroquia,
  ]);

  const inicial = normalizarUbicacionCentro(centro);
  const sinCambios =
    ubicacion.estado_federativo === inicial.estado_federativo &&
    ubicacion.municipio === inicial.municipio &&
    ubicacion.parroquia === inicial.parroquia;
  const incompleto =
    !ubicacion.estado_federativo.trim() ||
    !ubicacion.municipio.trim() ||
    !ubicacion.parroquia.trim();

  function confirmar() {
    if (incompleto || guardando || sinCambios) return;
    onGuardar(normalizarUbicacionCentro(ubicacion));
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && !guardando && onCerrar()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
          <DialogTitle className="text-base">Editar ubicación administrativa</DialogTitle>
          <DialogDescription className="text-xs">
            {centro.nro != null ? `N.° ${centro.nro} · ` : ""}
            Estado, municipio y parroquia del catálogo oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-4 py-4 sm:px-6">
          <SelectoresGeo
            pais="Venezuela"
            estado={ubicacion.estado_federativo}
            municipio={ubicacion.municipio}
            parroquia={ubicacion.parroquia}
            onPaisChange={() => {}}
            onEstadoChange={(estado_federativo) =>
              setUbicacion((prev) => ({ ...prev, estado_federativo }))
            }
            onMunicipioChange={(municipio) =>
              setUbicacion((prev) => ({ ...prev, municipio }))
            }
            onParroquiaChange={(parroquia) =>
              setUbicacion((prev) => ({ ...prev, parroquia }))
            }
            disabled={guardando}
            mostrarPais={false}
            paisBloqueado
            soloEstadosMetropolitanos
          />
          {incompleto && (
            <p className="text-[11px] text-destructive">
              Completa estado, municipio y parroquia.
            </p>
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
            disabled={guardando || incompleto || sinCambios}
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
