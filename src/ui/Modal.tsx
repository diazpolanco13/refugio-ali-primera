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
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-100">{titulo}</h2>
          <button
            onClick={onCerrar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
