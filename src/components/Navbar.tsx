import {
  LayoutGrid,
  LogOut,
  MapPinned,
  MonitorPlay,
  ScrollText,
  Siren,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";
import { cerrarSesion } from "@/data/authSupabase";
import { puedeVerLogs } from "@/domain/permisos";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BadgeRol } from "@/components/BadgeRol";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavbarProps {
  sesion: Sesion;
  puedeEditar: boolean;
  esAdmin: boolean;
  online: boolean;
  /**
   * ¿Hay conexión a Supabase (canal Realtime activo Y sesión válida)?
   * Reemplaza al `estadoSync` legacy ("sincronizando"/"error"/"ok"). Con
   * Supabase cada mutación es directa, así que solo mostramos
   * "conectado" (verde) o "desconectado" (ámbar).
   */
  conectado: boolean;
  /** Vista activa en CentrosView (mapa o tablero de prioridades). */
  vista?: "mapa" | "tablero";
  onCambiarVista?: (vista: "mapa" | "tablero") => void;
}

function iniciales(nombre: string | null, username: string): string {
  const base = (nombre || username).trim();
  const partes = base.split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/**
 * Ícono de la app con un borde que "se enciende" (glow pulsante) según el
 * estado de conexión a Supabase. Reemplaza al badge "En línea" por una señal
 * visual compacta:
 *   · conectado + online → brillo esmeralda (pulsando)
 *   · sin conexión       → brillo ámbar tenue (estático)
 * El tooltip expone el texto del estado al pasar el cursor. Con Supabase no
 * hay estados intermedios de "sincronizando" (cada mutación es directa).
 */
function IconoAppConEstado({
  online,
  conectado,
}: {
  online: boolean;
  conectado: boolean;
}) {
  const ok = online && conectado;
  const { color, etiqueta, pulsar } = ok
    ? {
        color: "rgba(16, 185, 129, 0.85)",
        etiqueta: "Conectado a Supabase",
        pulsar: true,
      }
    : {
        color: "rgba(245, 158, 11, 0.55)",
        etiqueta: online ? "Reconectando…" : "Sin conexión",
        pulsar: false,
      };

  return (
    <div
      title={etiqueta}
      aria-label={etiqueta}
      role="img"
      style={{ "--glow-color": color } as React.CSSProperties}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/30",
        pulsar && "app-icon-glow",
      )}
    >
      <MapPinned className="size-4" />
    </div>
  );
}

export function Navbar({
  sesion,
  puedeEditar,
  esAdmin,
  online,
  conectado,
  vista,
  onCambiarVista,
}: NavbarProps) {
  const nombre = sesion.user.nombre || sesion.user.username;
  const inicialesUsuario = iniciales(sesion.user.nombre, sesion.user.username);

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-2 backdrop-blur-sm sm:px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconoAppConEstado online={online} conectado={conectado} />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight text-foreground">
            <span className="sm:hidden">Centros Transitorios</span>
            <span className="hidden sm:inline">
              Sala Situacional — Centros Transitorios Caracas
            </span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onCambiarVista && vista && (
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={vista === "mapa" ? "secondary" : "ghost"}
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => onCambiarVista("mapa")}
            >
              <MapPinned className="size-3.5" />
              <span className="hidden sm:inline">Mapa</span>
            </Button>
            <Button
              size="sm"
              variant={vista === "tablero" ? "secondary" : "ghost"}
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => onCambiarVista("tablero")}
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Centros</span>
            </Button>
          </div>
        )}

        <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
          <Link to="/incidencias" title="Ver incidencias de toda la red">
            <Siren className="size-4" />
            <span className="hidden sm:inline">Incidencias</span>
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
          <Link to="/dashboard" title="Abrir sala situacional en pantalla completa">
            <MonitorPlay className="size-4" />
            <span className="hidden sm:inline">Pantalla</span>
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2 pl-1.5 pr-2.5",
                !puedeEditar && "border-muted-foreground/20",
              )}
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-primary/20 text-[10px] font-semibold text-primary">
                  {inicialesUsuario}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-24 truncate text-xs font-medium md:inline">
                {nombre}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1.5">
                <p className="truncate text-sm font-medium text-foreground">{nombre}</p>
                <p className="truncate text-xs text-muted-foreground">@{sesion.user.username}</p>
                <div className="flex flex-wrap items-center gap-1">
                  <BadgeRol rol={sesion.user.rol} />
                  {!puedeEditar && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Solo lectura
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>

            {(esAdmin || puedeVerLogs(sesion.user.rol)) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {esAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/usuarios">
                        <Users />
                        Gestionar usuarios
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {puedeVerLogs(sesion.user.rol) && (
                    <DropdownMenuItem asChild>
                      <Link to="/logs">
                        <ScrollText />
                        Bitácora de acciones
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => cerrarSesion()}>
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
