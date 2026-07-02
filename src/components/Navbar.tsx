import {
  BarChart3,
  LogOut,
  Tent,
  Trash2,
  Users,
} from "lucide-react";
import type { Rol } from "@/data/auth";
import type { Sesion } from "@/data/auth";
import { cerrarSesion } from "@/data/auth";
import type { InfoRol } from "@/domain/permisos";
import type { EstadoSync } from "@/data/sync";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface NavbarProps {
  sesion: Sesion;
  permisos: InfoRol;
  puedeEditar: boolean;
  esAdmin: boolean;
  online: boolean;
  estadoSync: EstadoSync;
  tableroAbierto: boolean;
  onToggleTablero: () => void;
  onAbrirUsuarios: () => void;
  onLimpiarDatos: () => void;
}

function iniciales(nombre: string | null, username: string): string {
  const base = (nombre || username).trim();
  const partes = base.split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function badgeRolVariant(rol: Rol): "default" | "secondary" | "outline" | "ghost" {
  switch (rol) {
    case "admin":
      return "default";
    case "coordinador":
      return "secondary";
    case "campo":
      return "outline";
    default:
      return "ghost";
  }
}

function IndicadorSync({ online, estado }: { online: boolean; estado: EstadoSync }) {
  if (!online) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-400" />
        Sin conexión
      </Badge>
    );
  }
  if (estado === "sincronizando") {
    return (
      <Badge variant="outline" className="gap-1 border-sky-500/40 text-sky-300">
        <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />
        Sincronizando…
      </Badge>
    );
  }
  if (estado === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <span className="size-1.5 rounded-full bg-red-400" />
        Sin sync
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-400" />
      En línea
    </Badge>
  );
}

export function Navbar({
  sesion,
  permisos,
  puedeEditar,
  esAdmin,
  online,
  estadoSync,
  tableroAbierto,
  onToggleTablero,
  onAbrirUsuarios,
  onLimpiarDatos,
}: NavbarProps) {
  const nombre = sesion.user.nombre || sesion.user.username;
  const inicialesUsuario = iniciales(sesion.user.nombre, sesion.user.username);

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/95 px-2 backdrop-blur-sm sm:px-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Tent className="size-4" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight text-foreground">
            <span className="sm:hidden">Sala Situacional</span>
            <span className="hidden sm:inline">
              Sala Situacional — Refugio Parque del Oeste
            </span>
          </h1>
          <div className="mt-0.5">
            <IndicadorSync online={online} estado={estadoSync} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant={tableroAbierto ? "secondary" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={onToggleTablero}
        >
          <BarChart3 className="size-4" />
          <span className="hidden sm:inline">Tablero</span>
        </Button>

        {esAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={onAbrirUsuarios}
          >
            <Users className="size-4" />
            <span className="hidden sm:inline">Usuarios</span>
          </Button>
        )}

        <Separator orientation="vertical" className="mx-0.5 hidden h-6 sm:block" />

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
                  <Badge variant={badgeRolVariant(sesion.user.rol)}>
                    {permisos.etiqueta}
                  </Badge>
                  {!puedeEditar && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Solo lectura
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>

            {esAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={onAbrirUsuarios}>
                    <Users />
                    Gestionar usuarios
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => cerrarSesion()}>
              <LogOut />
              Cerrar sesión
            </DropdownMenuItem>

            {esAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (
                        confirm(
                          "¿Vaciar todo el mapa? Se borra en este dispositivo y en el servidor (sectores, puntos y líneas).",
                        )
                      ) {
                        onLimpiarDatos();
                      }
                    }}
                  >
                    <Trash2 />
                    Vaciar mapa
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
