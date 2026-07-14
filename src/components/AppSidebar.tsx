import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import {
  BedDouble,
  ChevronRight,
  ClipboardList,
  ContactRound,
  Home,
  Landmark,
  LayoutGrid,
  MapPinned,
  MonitorPlay,
  ScrollText,
  Settings,
  Shield,
  Siren,
  Trash2,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import {
  puedeGestionarUnidadesSebin,
  puedeGestionarUsuarios,
  puedeVerBuzonCentro,
  puedeVerCensoCentro,
  puedeVerCensoRapidoRed,
  puedeVerLogs,
  puedeVerPapeleraDenuncias,
  puedeVerPoblacionRed,
  puedeVerTraslados,
  esRolCensoRapido,
  esRolTerreno,
} from "@/domain/permisos";
import { useCasosSaludCentros } from "@/data/useCasosSaludCentros";
import { totalCasosSaludActivosRed } from "@/domain/seguimientoReportes";
import { usePathnameNavegacion } from "@/contexts/PathnameNavegacionContext";
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
import { irAlPortalTerreno, tokenTerrenoActual, type TareaTerreno } from "@/lib/tokenTerreno";
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
  const { marcarNavegacion } = usePathnameNavegacion();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={activo} tooltip={label}>
        <Link to={to} onClick={() => marcarNavegacion(to)}>
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

/** Ítem que sale del AppShell hacia el bootstrap ligero (/terreno, /censo). */
function ItemMenuPortal({
  icono: Icono,
  label,
  activo = false,
  onClick,
}: {
  icono: IconoMenu;
  label: string;
  activo?: boolean;
  onClick: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        isActive={activo}
        tooltip={label}
        onClick={onClick}
      >
        <Icono />
        <TextoMenu>{label}</TextoMenu>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ItemMenuReportesDiarios({
  pathname,
  search,
  veCensoRapido,
  veCensoFicha,
  veBuzonFicha,
}: {
  pathname: string;
  search: string;
  veCensoRapido: boolean;
  veCensoFicha: boolean;
  veBuzonFicha: boolean;
}) {
  const { marcarNavegacion } = usePathnameNavegacion();
  const [searchParamsLive] = useSearchParams();
  const enReportesRed = esRutaReportesRed(pathname);
  const esFichaCentro = esFichaCentroPathname(pathname);
  const esReportesCentro = esReportesCentroPathname(pathname);
  const centroId = centroIdDePathname(pathname);
  const [submenuAbierto, setSubmenuAbierto] = useState(true);

  const seccionParam =
    new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(
      "vista",
    ) ?? searchParamsLive.get("vista");
  const seccionActiva = normalizarSeccionFichaCentro(seccionParam);
  const enListadoReportes = pathname === "/centros/reportes";
  const activo = enReportesRed || esFichaCentro;
  const enCampamento = centroId != null && (esReportesCentro || esFichaCentro);
  const seccionesSubmenu = SECCIONES_FICHA_CENTRO.filter((s) => {
    if (s.id === "censo_rapido") return veCensoFicha || veCensoRapido;
    if (s.id === "buzon") return veBuzonFicha;
    return true;
  });

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
                <Link
                  to="/centros/reportes"
                  onClick={() => marcarNavegacion("/centros/reportes")}
                >
                  Por campamento
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            {enCampamento &&
              seccionesSubmenu.map((seccion) => {
                const to = rutaSeccion(seccion.id);
                return (
                  <SidebarMenuSubItem key={seccion.id}>
                    <SidebarMenuSubButton
                      asChild
                      isActive={enCampamento && seccionActiva === seccion.id}
                    >
                      <Link to={to} onClick={() => marcarNavegacion(to)}>
                        {seccion.label}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
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

/** Menú reducido del operador del QR: mismas tareas del portal /terreno. */
function NavTerreno({ sesion }: Props) {
  const { pathname } = usePathnameNavegacion();
  const centroId =
    centroIdDePathname(pathname) ?? sesion.user.centros_asignados[0] ?? "";
  const rutaReporte = centroId
    ? `/centros/reportes/${encodeURIComponent(centroId)}?vista=reporte`
    : "/centros/reportes";
  const enReporte = rutaActiva(pathname, "/centros/reportes");

  function irPortal(tarea?: TareaTerreno) {
    irAlPortalTerreno(tarea ? { tarea } : undefined);
  }

  function irCenso() {
    const token = tokenTerrenoActual();
    const params = new URLSearchParams();
    if (centroId) params.set("centro", centroId);
    if (token) params.set("t", token);
    const q = params.toString();
    window.location.assign(q ? `/censo?${q}` : "/censo");
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Trabajo en terreno</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <ItemMenuPortal icono={Home} label="Inicio" onClick={() => irPortal()} />
          <ItemMenu
            to={rutaReporte}
            icono={ClipboardList}
            label="Reporte"
            activo={enReporte}
          />
          <ItemMenuPortal
            icono={MapPinned}
            label="Geolocalizar"
            onClick={() => irPortal("geo")}
          />
          <ItemMenuPortal
            icono={Landmark}
            label="Autoridades"
            onClick={() => irPortal("autoridades")}
          />
          <ItemMenuPortal
            icono={BedDouble}
            label="Capacidad"
            onClick={() => irPortal("capacidad")}
          />
          <ItemMenuPortal icono={Users} label="Censo" onClick={irCenso} />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavContenido({ sesion }: Props) {
  const { pathname, search } = usePathnameNavegacion();
  const esCensoRapido = esRolCensoRapido(sesion.user.rol);
  const esTerreno = esRolTerreno(sesion.user.rol);
  const esAdmin = puedeGestionarUsuarios(sesion.user.rol);
  const gestionaUnidades = puedeGestionarUnidadesSebin(sesion.user.rol);
  const veLogs = puedeVerLogs(sesion.user.rol);
  const vePapeleraDenuncias = puedeVerPapeleraDenuncias(sesion.user.rol);
  const veCensoRed = puedeVerCensoRapidoRed(sesion.user.rol);
  const vePoblacionRed = puedeVerPoblacionRed(sesion.user.rol);
  const veTraslados = puedeVerTraslados(sesion.user.rol);
  const centroIdRuta = centroIdDePathname(pathname);
  const veCensoFicha =
    centroIdRuta != null && puedeVerCensoCentro(sesion.user, centroIdRuta);
  const veBuzonFicha =
    centroIdRuta != null && puedeVerBuzonCentro(sesion.user, centroIdRuta);
  const { casos: casosSalud } = useCasosSaludCentros({ soloActivos: true });
  const abiertas = esCensoRapido ? 0 : totalCasosSaludActivosRed(casosSalud);
  const urgentes = esCensoRapido
    ? 0
    : casosSalud.filter((c) => c.estatus === "activo").length;

  if (esTerreno) {
    return <NavTerreno sesion={sesion} />;
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
              to="/centros/censo"
              icono={ContactRound}
              label="Censo (red)"
              activo={rutaActiva(pathname, "/centros/censo")}
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
            <ItemMenuReportesDiarios
              pathname={pathname}
              search={search}
              veCensoRapido={veCensoRed}
              veCensoFicha={veCensoFicha}
              veBuzonFicha={veBuzonFicha}
            />
            {veCensoRed && (
              <ItemMenu
                to="/centros/censo"
                icono={ContactRound}
                label="Censo (red)"
                activo={rutaActiva(pathname, "/centros/censo")}
              />
            )}
            {vePoblacionRed && (
              <ItemMenu
                to="/centros/refugiados"
                icono={Users}
                label="Población (red)"
                activo={rutaActiva(pathname, "/centros/refugiados")}
              />
            )}
            {veTraslados && (
              <ItemMenu
                to="/centros/traslados"
                icono={Truck}
                label="Traslados entre campamentos"
                activo={rutaActiva(pathname, "/centros/traslados")}
              />
            )}
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
            <ItemMenu
              to="/incidencias/refugiados"
              icono={UserRound}
              label="Bandeja damnificados"
              activo={rutaActiva(pathname, "/incidencias/refugiados")}
            />
            {vePapeleraDenuncias && (
              <ItemMenu
                to="/incidencias/eliminadas"
                icono={Trash2}
                label="Denuncias eliminadas"
                activo={rutaActiva(pathname, "/incidencias/eliminadas")}
              />
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {(esAdmin || gestionaUnidades || veLogs) && (
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
              {gestionaUnidades && (
                <ItemMenu
                  to="/config/unidades-sebin"
                  icono={Shield}
                  label="Unidades SEBIN"
                  activo={rutaActiva(pathname, "/config/unidades-sebin")}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}

/** Sidebar completo para vistas con rail colapsado. */
export function AppSidebar({ sesion }: Props) {
  const { marcarNavegacion } = usePathnameNavegacion();
  const esTerreno = esRolTerreno(sesion.user.rol);

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {esTerreno ? (
              <SidebarMenuButton
                type="button"
                size="lg"
                tooltip="Volver al portal de terreno"
                className="group-data-[collapsible=icon]:justify-center"
                onClick={() => irAlPortalTerreno()}
              >
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
                  <Home className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-sm font-semibold">
                    Reportes en el terreno
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    Volver al inicio
                  </span>
                </span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                size="lg"
                tooltip="Campamentos Transitorios"
                className="group-data-[collapsible=icon]:justify-center"
              >
                <Link
                  to="/centros/mapa"
                  onClick={() => marcarNavegacion("/centros/mapa")}
                >
                  <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/30">
                    <MapPinned className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col leading-none group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold">
                      Campamentos Transitorios
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      Caracas
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            )}
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
