import type { ReactNode } from "react";

interface Props {
  titulo: string;
  children: ReactNode;
  onCerrar: () => void;
}

export function Modal({ titulo, children, onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      {/* No se cierra al hacer clic fuera: solo con ✕, Cancelar o Guardar,
          para evitar cierres accidentales al llenar el formulario. */}
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-100">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
