import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import {
  actualizarCenso,
  registroDesdeGuardado,
  type RegistroCenso,
  type RegistroCensoGuardado,
} from "@/data/reposCenso";
import { FormularioRegistroCenso } from "@/features/censo/FormularioRegistroCenso";
import { registroCensoCompleto, registroVacio } from "@/features/censo/censoFormularioShared";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  fila: RegistroCensoGuardado | null;
  onOpenChange: (open: boolean) => void;
  onGuardado: () => void;
}

export function CensoEditarRegistroSheet({ fila, onOpenChange, onGuardado }: Props) {
  const [registro, setRegistro] = useState<RegistroCenso>(registroVacio);
  const [resaltarFaltantes, setResaltarFaltantes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  useEffect(() => {
    if (fila) {
      setRegistro(registroDesdeGuardado(fila));
      setResaltarFaltantes(false);
      setErrorGuardar("");
    }
  }, [fila]);

  function cambiarRegistro(parcial: Partial<RegistroCenso>) {
    setRegistro((r) => ({ ...r, ...parcial }));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!fila || guardando) return;
    if (!registroCensoCompleto(registro)) {
      setResaltarFaltantes(true);
      return;
    }
    setErrorGuardar("");
    setGuardando(true);
    try {
      const esMenor = registro.edad != null && registro.edad < 18;
      const datos = esMenor
        ? registro
        : { ...registro, jefe_tipo_doc: "" as const, jefe_documento: "", parentesco_jefe: "" };
      await actualizarCenso(fila.id, datos);
      onOpenChange(false);
      onGuardado();
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No se pudo guardar el registro");
    } finally {
      setGuardando(false);
    }
  }

  const nombre = fila
    ? [fila.primer_nombre, fila.primer_apellido].filter(Boolean).join(" ")
    : "";

  return (
    <Sheet open={fila != null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Pencil className="size-4 text-primary" />
            Corregir registro
          </SheetTitle>
          <SheetDescription>
            {nombre ? `Editando a ${nombre}` : "Modifique los datos y guarde los cambios."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {fila && (
            <FormularioRegistroCenso
              registro={registro}
              onChange={cambiarRegistro}
              onSubmit={(e) => void guardar(e)}
              mostrarFaltantes={resaltarFaltantes}
              editando
              guardando={guardando}
              errorGuardar={errorGuardar}
              idPrefix="censo-edit"
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
