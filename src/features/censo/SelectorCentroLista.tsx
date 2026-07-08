// Lista de campamentos con búsqueda (sin popover; usable en móvil con
// teclado). Compartida por la planilla de censo (/censo) y el portal de
// terreno (/terreno) para elegir el campamento a censar o reportar.

import { useMemo, useState } from "react";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CentroCenso } from "@/data/reposCenso";
import { cn } from "@/lib/utils";

export function SelectorCentroLista({
  centros,
  centroId,
  onSelect,
  cargando,
  onContinuar,
}: {
  centros: CentroCenso[];
  centroId: string;
  onSelect: (id: string) => void;
  cargando: boolean;
  onContinuar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return centros;
    return centros.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [centros, busqueda]);

  function elegir(id: string) {
    onSelect(id);
    onContinuar();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar campamento por nombre…"
          className="h-11 pl-9"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>

      {cargando ? (
        <div className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Cargando campamentos…
        </div>
      ) : (
        <div className="relative mt-3 flex min-h-0 flex-1 flex-col">
          <ul
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border touch-pan-y [-webkit-overflow-scrolling:touch]"
            role="listbox"
            aria-label="Campamentos disponibles"
          >
          {filtrados.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              No se encontró ningún campamento.
            </li>
          ) : (
            filtrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={centroId === c.id}
                  onClick={() => elegir(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-4 py-3.5 text-left text-sm transition-colors last:border-b-0 active:bg-accent",
                    centroId === c.id && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  <MapPin className="size-4 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 leading-snug">{c.nombre}</span>
                  {centroId === c.id && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))
          )}
          </ul>
          {filtrados.length > 6 && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg bg-gradient-to-t from-background via-background/80 to-transparent"
              aria-hidden
            />
          )}
        </div>
      )}

      <p className="mt-3 shrink-0 text-[11px] text-muted-foreground">
        {centros.length} campamento{centros.length === 1 ? "" : "s"} disponible
        {centros.length === 1 ? "" : "s"}.
        {filtrados.length > 6
          ? " Deslice la lista para ver más y toque uno para continuar."
          : " Toque uno para continuar."}
      </p>
    </div>
  );
}
