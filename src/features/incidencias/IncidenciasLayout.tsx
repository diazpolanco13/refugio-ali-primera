import { NavLink, Outlet } from "react-router-dom";
import { Archive, BarChart3, Siren } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useSupabaseConectado } from "@/data/useSupabaseConectado";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
}

const TABS = [
  {
    to: "/incidencias/funcionarios",
    label: "Bandeja funcionarios",
    icon: Siren,
  },
  {
    to: "/incidencias/archivadas",
    label: "Archivadas",
    icon: Archive,
  },
  {
    to: "/incidencias/analitica",
    label: "Analítica",
    icon: BarChart3,
  },
] as const;

function IndicadorConexion({ conectado }: { conectado: boolean }) {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  if (!online || !conectado) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Sin conexión
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-400" />
      En vivo
    </Badge>
  );
}

/** Layout compartido de las subrutas de incidencias. */
export function IncidenciasLayout({ sesion: _sesion }: Props) {
  const conectado = useSupabaseConectado();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-lg font-bold leading-tight text-foreground lg:text-xl">
              <Siren className="size-5 shrink-0 text-red-400" />
              Incidencias de la red
            </h1>
            <p className="truncate text-xs text-muted-foreground lg:text-sm">
              Seguimiento operativo y análisis global
            </p>
          </div>
          <IndicadorConexion conectado={conectado} />
        </div>
        <nav className="flex flex-wrap gap-1">
          {TABS.map(({ to, label, icon: Icono }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )
              }
            >
              <Icono className="size-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
