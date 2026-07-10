import { Search } from "lucide-react";
import type { Rol } from "@/data/authSupabase";
import { INFO_ROLES, ROLES } from "@/domain/permisos";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Props = {
  busqueda: string;
  onBusqueda: (v: string) => void;
  filtroRol: Rol | "todos";
  onFiltroRol: (v: Rol | "todos") => void;
  conteos: Map<Rol, number>;
  total: number;
  className?: string;
  disabled?: boolean;
};

/** Buscador + segmentación por rol (Tabs) para Gestión de usuarios. */
export function BarraFiltrosUsuarios({
  busqueda,
  onBusqueda,
  filtroRol,
  onFiltroRol,
  conteos,
  total,
  className,
  disabled,
}: Props) {
  const rolesConUsuarios = ROLES.filter((rol) => (conteos.get(rol) ?? 0) > 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={busqueda}
          onChange={(e) => onBusqueda(e.target.value)}
          placeholder="Buscar por nombre, usuario, cédula o centro…"
          className="h-9 pl-9"
          disabled={disabled}
          aria-label="Buscar usuarios"
        />
      </div>

      <Tabs
        value={filtroRol}
        onValueChange={(v) => onFiltroRol(v as Rol | "todos")}
        className="gap-0"
      >
        <TabsList
          variant="default"
          className="h-auto w-full max-w-full flex-nowrap justify-start overflow-x-auto p-1"
        >
          <TabsTrigger
            value="todos"
            className="shrink-0 gap-1.5 px-2.5 text-xs"
            disabled={disabled}
          >
            Todos
            <span className="tabular-nums text-muted-foreground">{total}</span>
          </TabsTrigger>
          {rolesConUsuarios.map((rol) => {
            const n = conteos.get(rol) ?? 0;
            return (
              <TabsTrigger
                key={rol}
                value={rol}
                className="shrink-0 gap-1.5 px-2.5 text-xs"
                disabled={disabled}
              >
                {INFO_ROLES[rol].etiqueta}
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
