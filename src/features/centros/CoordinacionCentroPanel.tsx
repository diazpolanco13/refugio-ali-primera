import { useState } from "react";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { guardarCentro } from "@/data/reposSupabase";
import { normalizarCentro, type CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  asegurarIdsResponsablesCoordinacion,
  prepararResponsablesCoordinacionParaGuardar,
  syncCentroDesdeCoordinacion,
  type CategoriaResponsabilidadCoordinacion,
  type ResponsableCoordinacion,
} from "@/domain/coordinacionCentro";
import { Button } from "@/components/ui/button";
import { DialogoResponsableCoordinacion } from "./DialogoResponsableCoordinacion";
import { ListaResponsablesCoordinacion } from "./ResponsablesCoordinacion";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
}

/** Pestaña Coordinación: listado + diálogo para crear/editar responsables. */
export function CoordinacionCentroPanel({ centro, puedeEditar }: Props) {
  const c = normalizarCentro(centro);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [responsableEditando, setResponsableEditando] = useState<ResponsableCoordinacion | null>(
    null,
  );
  const [categoriaInicial, setCategoriaInicial] = useState<
    CategoriaResponsabilidadCoordinacion | undefined
  >(undefined);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistir(lista: ResponsableCoordinacion[]) {
    setError(null);
    setGuardando(true);
    try {
      const preparada = prepararResponsablesCoordinacionParaGuardar(
        asegurarIdsResponsablesCoordinacion(lista),
      );
      const sync = syncCentroDesdeCoordinacion(centro, preparada);
      await guardarCentro({
        ...centro,
        responsables_coordinacion: preparada,
        personal: sync.personal,
        servicios: sync.servicios,
      });
      setDialogoAbierto(false);
      setResponsableEditando(null);
      setCategoriaInicial(undefined);
      return true;
    } catch (err) {
      console.error("[CoordinacionCentroPanel] error guardando:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la coordinación del campamento.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function abrirNuevo(categoria?: CategoriaResponsabilidadCoordinacion) {
    setResponsableEditando(null);
    setCategoriaInicial(categoria);
    setError(null);
    setDialogoAbierto(true);
  }

  function abrirEditar(responsable: ResponsableCoordinacion) {
    setResponsableEditando(responsable);
    setCategoriaInicial(undefined);
    setError(null);
    setDialogoAbierto(true);
  }

  function cerrarDialogo() {
    if (guardando) return;
    setDialogoAbierto(false);
    setResponsableEditando(null);
    setCategoriaInicial(undefined);
    setError(null);
  }

  async function guardarResponsable(responsable: ResponsableCoordinacion) {
    const actual = c.responsables_coordinacion;
    const existe = actual.some((r) => r.id === responsable.id);
    const lista = existe
      ? actual.map((r) => (r.id === responsable.id ? responsable : r))
      : [...actual, responsable];
    await persistir(lista);
  }

  async function eliminarResponsable(id: string) {
    await persistir(c.responsables_coordinacion.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      {puedeEditar && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {modoEdicion ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setModoEdicion(false)}
            >
              <X className="size-3.5" />
              Listo
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setModoEdicion(true)}
            >
              <Pencil className="size-3.5" />
              Editar
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-teal-600 hover:bg-teal-500"
            disabled={guardando}
            onClick={() => abrirNuevo()}
          >
            {guardando && !dialogoAbierto ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Nuevo responsable
          </Button>
        </div>
      )}

      <ListaResponsablesCoordinacion
        responsables={c.responsables_coordinacion}
        modoEdicion={modoEdicion && puedeEditar}
        onEditar={abrirEditar}
        onEliminar={(id) => void eliminarResponsable(id)}
        onAgregarCategoria={puedeEditar ? (cat) => abrirNuevo(cat) : undefined}
      />

      <DialogoResponsableCoordinacion
        abierto={dialogoAbierto}
        onCerrar={cerrarDialogo}
        responsable={responsableEditando}
        categoriaInicial={categoriaInicial}
        guardando={guardando}
        error={error}
        onGuardar={(r) => void guardarResponsable(r)}
      />
    </div>
  );
}
