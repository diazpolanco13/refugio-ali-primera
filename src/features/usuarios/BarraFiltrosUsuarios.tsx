import { Search, Shield } from "lucide-react";
import type { Rol } from "@/data/authSupabase";
import { INFO_ROLES, ROLES } from "@/domain/permisos";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Props = {
  busqueda: string;
  onBusqueda: (v: string) => void;
  filtroRol: Rol | "todos";
  onFiltroRol: (v: Rol | "todos") => void;
  conteos: Map<Rol, number>;
  total: number;
  /** Cuerpos policiales con al menos un usuario vinculado (clave → label). */
  cuerpos?: { clave: string; label: string }[];
  filtroCuerpo?: string | "todos";
  onFiltroCuerpo?: (v: string | "todos") => void;
  className?: string;
  disabled?: boolean;
};

/** Buscador + filtro por cuerpo + segmentación por rol (Tabs). */
export function BarraFiltrosUsuarios({
  busqueda,
  onBusqueda,
  filtroRol,
  onFiltroRol,
  conteos,
  total,
  cuerpos = [],
  filtroCuerpo = "todos",
  onFiltroCuerpo,
  className,
  disabled,
}: Props) {
  const rolesConUsuarios = ROLES.filter((rol) => (conteos.get(rol) ?? 0) > 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
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
        {onFiltroCuerpo && cuerpos.length > 0 && (
          <Select
            value={filtroCuerpo}
            disabled={disabled}
            onValueChange={(v) => onFiltroCuerpo(v)}
          >
            <SelectTrigger
              className="h-9 w-40 shrink-0 sm:w-48"
              aria-label="Filtrar por cuerpo policial"
            >
              <Shield className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los cuerpos</SelectItem>
              {cuerpos.map((c) => (
                <SelectItem key={c.clave} value={c.clave}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
