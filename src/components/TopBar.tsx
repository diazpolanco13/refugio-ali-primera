import { LogOut } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { cerrarSesion } from "@/data/authSupabase";
import { puedeEscribir } from "@/domain/permisos";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BadgeRol } from "@/components/BadgeRol";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MigasPanNav } from "@/components/MigasPanNav";
import { esRolTerreno } from "@/domain/permisos";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
}

function iniciales(nombre: string | null, username: string): string {
  const base = (nombre || username).trim();
  const partes = base.split(/\s+/);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** Barra superior mínima: migas de pan y usuario. */
export function TopBar({ sesion }: Props) {
  const [searchParams] = useSearchParams();
  const puedeEditar = puedeEscribir(sesion.user.rol);
  const nombre = sesion.user.nombre || sesion.user.username;
  const inicialesUsuario = iniciales(sesion.user.nombre, sesion.user.username);
  // Operador del QR en modo reporte: sin menú lateral (no debe salir del parte).
  const reporteTerrenoBloqueado =
    esRolTerreno(sesion.user.rol) && searchParams.get("reportar") === "1";

  return (
    <header className="z-20 flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/95 px-2 backdrop-blur-sm sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        {!reporteTerrenoBloqueado && <SidebarTrigger className="shrink-0" />}
        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MigasPanNav />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-2 pl-1.5 pr-2.5",
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
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => cerrarSesion()}>
            <LogOut />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
