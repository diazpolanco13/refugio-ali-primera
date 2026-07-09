import { NavLink, Outlet } from "react-router-dom";
import { Archive, BarChart3, Megaphone, Siren } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useSupabaseConectado } from "@/data/useSupabaseConectado";
import { Badge } from "@/components/ui/badge";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
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
    to: "/incidencias/refugiados",
    label: "Bandeja damnificados",
    icon: Megaphone,
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
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col"
    >
      <VistaEncabezado
        icono={Siren}
        acento="rojo"
        titulo="Incidencias de la red"
        descripcion="Seguimiento de salud y novedades del reporte diario"
        acciones={<IndicadorConexion conectado={conectado} />}
        debajo={
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
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </MarcoVista>
  );
}
