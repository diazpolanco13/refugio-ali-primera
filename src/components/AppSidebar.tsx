import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  MapPinned,
  MonitorPlay,
  ScrollText,
  Settings,
  Siren,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import {
  puedeGestionarUsuarios,
  puedeVerCensoRapidoRed,
  puedeVerLogs,
  esRolCensoRapido,
  esRolTerreno,
} from "@/domain/permisos";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { totalCasosSaludActivosRed } from "@/domain/seguimientoReportes";
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
import {
  SECCIONES_FICHA_CENTRO,
  centroIdDePathname,
  esFichaCentroPathname,
  esReportesCentroPathname,
  esRutaReportesRed,
  normalizarSeccionFichaCentro,
  rutaSeccionFichaCentro,
  rutaSeccionReportesCentro,
} from "@/features/centros/seccionesFichaCentro";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
}

type IconoMenu = typeof Siren;

function rutaActiva(pathname: string, ruta: string): boolean {
  if (ruta === "/") return pathname === ruta;
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

function TextoMenu({ children }: { children: string }) {
  return <span className="group-data-[collapsible=icon]:hidden">{children}</span>;
}

function ItemMenu({
  to,
  icono: Icono,
  label,
  activo,
  badge,
  badgeClassName,
}: {
  to: string;
  icono: IconoMenu;
  label: string;
  activo: boolean;
  badge?: number;
  badgeClassName?: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={activo} tooltip={label}>
        <Link to={to}>
          <Icono />
          <TextoMenu>{label}</TextoMenu>
        </Link>
      </SidebarMenuButton>
      {badge != null && badge > 0 && (
        <SidebarMenuBadge className={badgeClassName}>{badge}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

function ItemMenuReportesDiarios({
  pathname,
  veCensoRapido,
}: {
  pathname: string;
  veCensoRapido: boolean;
}) {
  const [searchParams] = useSearchParams();
  const enReportesRed = esRutaReportesRed(pathname);
  const esFichaCentro = esFichaCentroPathname(pathname);
  const esReportesCentro = esReportesCentroPathname(pathname);
  const centroId = centroIdDePathname(pathname);
  const [submenuAbierto, setSubmenuAbierto] = useState(true);

  const seccionParam = searchParams.get("vista");
  const seccionActiva = normalizarSeccionFichaCentro(seccionParam);
  const enListadoReportes = pathname === "/centros/reportes";
  const activo = enReportesRed || esFichaCentro;
  const enCampamento = centroId != null && (esReportesCentro || esFichaCentro);
  const seccionesSubmenu = SECCIONES_FICHA_CENTRO.filter(
    (s) => s.id !== "censo_rapido" || veCensoRapido,
  );

  if (!enReportesRed && !esFichaCentro) {
    return (
      <ItemMenu
        to="/centros/reportes"
        icono={ClipboardList}
        label="Reportes diarios (red)"
        activo={false}
      />
    );
  }

  function rutaSeccion(seccion: (typeof SECCIONES_FICHA_CENTRO)[number]["id"]): string {
    if (!centroId) return "/centros/reportes";
    if (esReportesCentro || pathname.startsWith("/centros/reportes/")) {
      return rutaSeccionReportesCentro(centroId, seccion);
    }
    return rutaSeccionFichaCentro(pathname, centroId, seccion);
  }

  return (
    <Collapsible
      open={submenuAbierto}
      onOpenChange={setSubmenuAbierto}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={activo} tooltip="Reportes diarios (red)">
            <ClipboardList />
            <TextoMenu>Reportes diarios (red)</TextoMenu>
            <ChevronRight
              className={cn(
                "ml-auto size-4 shrink-0 transition-transform duration-200",
                submenuAbierto && "rotate-90",
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild isActive={enListadoReportes}>
                <Link to="/centros/reportes">Por campamento</Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            {enCampamento &&
              seccionesSubmenu.map((seccion) => (
                <SidebarMenuSubItem key={seccion.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={enCampamento && seccionActiva === seccion.id}
                  >
                    <Link to={rutaSeccion(seccion.id)}>{seccion.label}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function ItemEnDesarrollo({
  icono: Icono,
  label,
}: {
  icono: IconoMenu;
  label: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-disabled
        tooltip={label}
        className="pointer-events-none opacity-60"
        onClick={(e) => e.preventDefault()}
      >
        <Icono />
        <TextoMenu>{label}</TextoMenu>
        <BadgeEnDesarrollo className="group-data-[collapsible=icon]:hidden" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavContenido({ sesion }: Props) {
  const location = useLocation();
  const esCensoRapido = esRolCensoRapido(sesion.user.rol);
  const esTerreno = esRolTerreno(sesion.user.rol);
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const veLogs = puedeVerLogs(sesion.user.rol);
  const veCensoRed = puedeVerCensoRapidoRed(sesion.user.rol);
  const { casos: casosSalud } = useCasosSaludCentros({ soloActivos: true });
  const abiertas = esCensoRapido ? 0 : totalCasosSaludActivosRed(casosSalud);
  const urgentes = esCensoRapido
    ? 0
    : casosSalud.filter((c) => c.estatus === "activo").length;

  const pathname = location.pathname;

  if (esTerreno) {
    // Sesión del QR de terreno: una sola tarea — los reportes de sus
    // campamentos. El resto del menú no aplica (y las rutas redirigen).
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Campamentos transitorios</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <ItemMenu
              to="/centros/reportes"
              icono={ClipboardList}
              label="Reportes diarios"
              activo={pathname === "/" || rutaActiva(pathname, "/centros/reportes")}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (esCensoRapido) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Campamentos transitorios</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <ItemMenu
              to="/centros/mapa"
              icono={MapPinned}
              label="Mapa"
              activo={pathname === "/" || rutaActiva(pathname, "/centros/mapa")}
            />
            <ItemMenu
              to="/centros/censo-rapido"
              icono={ClipboardList}
              label="Censo rápido (red)"
              activo={rutaActiva(pathname, "/centros/censo-rapido")}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const esSeccionCampamentos =
    rutaActiva(pathname, "/centros/tablero") ||
    rutaActiva(pathname, "/centros/refugiados") ||
    pathname === "/centro/nuevo";

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Sala situacional</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <ItemMenu
              to="/dashboard"
              icono={MonitorPlay}
              label="Pantalla"
              activo={rutaActiva(pathname, "/dashboard")}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup>
        <SidebarGroupLabel>Campamentos transitorios</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <ItemMenu
              to="/centros/mapa"
              icono={MapPinned}
              label="Mapa"
              activo={pathname === "/" || rutaActiva(pathname, "/centros/mapa")}
            />
            <ItemMenu
              to="/centros/tablero"
              icono={LayoutGrid}
              label="Campamentos"
              activo={esSeccionCampamentos}
            />
            <ItemMenuReportesDiarios pathname={pathname} veCensoRapido={veCensoRed} />
            {veCensoRed && (
              <ItemMenu
                to="/centros/censo-rapido"
                icono={ClipboardList}
                label="Censo rápido (red)"
                activo={rutaActiva(pathname, "/centros/censo-rapido")}
              />
            )}
            <ItemMenu
              to="/centros/refugiados"
              icono={Users}
              label="Población (red)"
              activo={rutaActiva(pathname, "/centros/refugiados")}
            />
            <ItemEnDesarrollo icono={Truck} label="Traslados entre campamentos" />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Incidencias</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <ItemMenu
              to="/incidencias/funcionarios"
              icono={Siren}
              label="Bandeja funcionarios"
              activo={rutaActiva(pathname, "/incidencias/funcionarios")}
              badge={abiertas}
              badgeClassName={cn(urgentes > 0 && "bg-red-500/20 text-red-400")}
            />
            <ItemEnDesarrollo icono={UserRound} label="Bandeja damnificados" />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {(esAdmin || veLogs) && (
        <SidebarGroup>
          <SidebarGroupLabel>Configuración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {esAdmin && (
                <ItemMenu
                  to="/usuarios"
                  icono={Users}
                  label="Gestión de usuarios"
                  activo={rutaActiva(pathname, "/usuarios")}
                />
              )}
              {veLogs && (
                <ItemMenu
                  to="/logs"
                  icono={ScrollText}
                  label="Bitácora de acciones"
                  activo={rutaActiva(pathname, "/logs")}
                />
              )}
              <ItemEnDesarrollo icono={Settings} label="Preferencias de cuenta" />
              <ItemEnDesarrollo icono={Settings} label="Catálogos / parámetros" />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

/** Sidebar completo para vistas con rail colapsado. */
export function AppSidebar({ sesion }: Props) {
  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Campamentos Transitorios"
              className="group-data-[collapsible=icon]:justify-center"
            >
              <Link to="/centros/mapa">
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
                  <MapPinned className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-semibold">Campamentos Transitorios</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Caracas</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavContenido sesion={sesion} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <p className="truncate px-2 text-[10px] text-sidebar-foreground/60 group-data-[collapsible=icon]:sr-only">
          @{sesion.user.username}
        </p>
      </SidebarFooter>
    </>
  );
}
