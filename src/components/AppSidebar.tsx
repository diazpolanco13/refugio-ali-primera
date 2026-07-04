import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Archive,
  BarChart3,
  ClipboardList,
  ChevronRight,
  LayoutGrid,
  List,
  MapPinned,
  MonitorPlay,
  Plus,
  ScrollText,
  Settings,
  Siren,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import {
  puedeCrearCentros,
  puedeGestionarUsuarios,
  puedeVerLogs,
} from "@/domain/permisos";
import { useIncidencias } from "@/data/useIncidencias";
import { incidenciasAbiertas } from "@/domain/incidencias";
import { useMapaCentrosOptional } from "@/contexts/MapaCentrosContext";
import { BadgeEnDesarrollo } from "@/components/BadgeEnDesarrollo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
  /** Cierra el drawer del mapa tras navegar o ejecutar una acción. */
  onNavigate?: () => void;
  /** Modo drawer (mapa): sin SidebarHeader/Footer externos. */
  modoDrawer?: boolean;
}

function ItemEnDesarrollo({
  icono: Icono,
  label,
}: {
  icono: typeof Siren;
  label: string;
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        aria-disabled
        className="pointer-events-none opacity-60"
        onClick={(e) => e.preventDefault()}
      >
        <Icono />
        <span>{label}</span>
        <BadgeEnDesarrollo />
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function NavContenido({ sesion, onNavigate }: Omit<Props, "modoDrawer">) {
  const location = useLocation();
  const navigate = useNavigate();
  const mapaCtx = useMapaCentrosOptional();
  const puedeCrear = puedeCrearCentros(sesion.user.rol);
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const veLogs = puedeVerLogs(sesion.user.rol);
  const incidencias = useIncidencias({ estado: "abierta" });
  const abiertas = incidenciasAbiertas(incidencias).length;
  const urgentes = incidencias.filter((i) => i.etiqueta === "urgente").length;

  function alAbrirListaCentros() {
    onNavigate?.();
    if (location.pathname !== "/centros/mapa") {
      navigate("/centros/mapa");
      sessionStorage.setItem("abrirListaCentros", "1");
    } else {
      mapaCtx?.abrirListaCentros();
    }
  }

  function alRegistrarCentro() {
    onNavigate?.();
    if (location.pathname !== "/centros/mapa") {
      navigate("/centros/mapa");
      sessionStorage.setItem("abrirNuevoCentro", "1");
    } else {
      mapaCtx?.abrirNuevoCentro();
    }
  }

  const enMapa = location.pathname === "/centros/mapa";
  const enTablero = location.pathname === "/centros/tablero";
  const enIncFunc = location.pathname === "/incidencias/funcionarios";
  const enIncArch = location.pathname === "/incidencias/archivadas";
  const enIncAnal = location.pathname === "/incidencias/analitica";
  const enUsuarios = location.pathname === "/usuarios";
  const enLogs = location.pathname === "/logs";

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Sala situacional</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Pantalla completa">
                <Link to="/dashboard" onClick={() => onNavigate?.()}>
                  <MonitorPlay />
                  <span>Pantalla</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup>
        <SidebarGroupLabel>Centros</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Centros transitorios">
                    <MapPinned />
                    <span>Centros</span>
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={enMapa}>
                        <Link to="/centros/mapa" onClick={() => onNavigate?.()}>
                          <MapPinned />
                          <span>Mapa</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={enTablero}>
                        <Link to="/centros/tablero" onClick={() => onNavigate?.()}>
                          <LayoutGrid />
                          <span>Tablero comparativo</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={enMapa && !!mapaCtx?.panelCentrosAbierto}
                        onClick={alAbrirListaCentros}
                      >
                        <List />
                        <span>Lista de centros</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {puedeCrear && (
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton onClick={alRegistrarCentro}>
                          <Plus />
                          <span>Registrar centro</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )}
                    <ItemEnDesarrollo icono={Truck} label="Traslados entre centros" />
                    <ItemEnDesarrollo icono={ClipboardList} label="Reportes diarios (red)" />
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Incidencias</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip="Incidencias">
                    <Siren />
                    <span>Incidencias</span>
                    {abiertas > 0 && (
                      <SidebarMenuBadge
                        className={cn(urgentes > 0 && "bg-red-500/20 text-red-400")}
                      >
                        {abiertas}
                      </SidebarMenuBadge>
                    )}
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={enIncFunc}>
                        <Link
                          to="/incidencias/funcionarios"
                          onClick={() => onNavigate?.()}
                        >
                          <Siren />
                          <span>Bandeja funcionarios</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <ItemEnDesarrollo icono={UserRound} label="Bandeja refugiados" />
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={enIncArch}>
                        <Link
                          to="/incidencias/archivadas"
                          onClick={() => onNavigate?.()}
                        >
                          <Archive />
                          <span>Archivadas</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={enIncAnal}>
                        <Link
                          to="/incidencias/analitica"
                          onClick={() => onNavigate?.()}
                        >
                          <BarChart3 />
                          <span>Calendario / analítica</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {(esAdmin || veLogs) && (
        <SidebarGroup>
          <SidebarGroupLabel>Configuración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Configuración">
                      <Settings />
                      <span>Configuración</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {esAdmin && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={enUsuarios}>
                            <Link to="/usuarios" onClick={() => onNavigate?.()}>
                              <Users />
                              <span>Gestión de usuarios</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
                      {veLogs && (
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={enLogs}>
                            <Link to="/logs" onClick={() => onNavigate?.()}>
                              <ScrollText />
                              <span>Bitácora de acciones</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )}
                      <ItemEnDesarrollo icono={Settings} label="Preferencias de cuenta" />
                      <ItemEnDesarrollo icono={Settings} label="Catálogos / parámetros" />
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

/** Sidebar completo para vistas con rail colapsado. */
export function AppSidebar({ sesion, onNavigate, modoDrawer = false }: Props) {
  if (modoDrawer) {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
        <div className="shrink-0 border-b border-sidebar-border px-4 py-3">
          <p className="text-sm font-semibold text-sidebar-foreground">Menú</p>
          <p className="text-xs text-sidebar-foreground/70">Campamentos Transitorios — Caracas</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <NavContenido sesion={sesion} onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-2">
        <p className="truncate text-sm font-semibold">Campamentos Transitorios</p>
        <p className="truncate text-xs text-sidebar-foreground/70">Caracas</p>
      </SidebarHeader>
      <SidebarContent>
        <NavContenido sesion={sesion} onNavigate={onNavigate} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <p className="px-2 text-[10px] text-sidebar-foreground/60">
          @{sesion.user.username}
        </p>
      </SidebarFooter>
    </>
  );
}
