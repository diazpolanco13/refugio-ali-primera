import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Login } from "./features/auth/Login";
import { initAuth, useSesion, type Sesion } from "./data/authSupabase";
import { AvisoActualizacionApp } from "./components/AvisoActualizacionApp";
import { BotonBorrarCacheFlotante } from "./components/BotonBorrarCacheFlotante";
import { MarcaAgua } from "./components/MarcaAgua";
import { PantallaCarga } from "./components/PantallaCarga";
import { EnDesarrollo } from "./components/EnDesarrollo";
import { SectionSuspense } from "./components/SectionSuspense";
import { AppShell } from "./layouts/AppShell";
import { señalarAppObsoleta, esErrorModuloObsoleto } from "./lib/avisoAppObsoleta";
import { ocultarSplash } from "./lib/splash";
import { rutaInicialDeRol, rutaPermitidaParaRol } from "./domain/permisos";
import { useIsMobile } from "./hooks/use-mobile";
import { DashboardViewSkeleton } from "./features/dashboard/DashboardViewSkeleton";
import { MapaSectionSkeleton } from "./features/centros/MapaSectionSkeleton";
import { TableroCampamentosSkeleton } from "./features/centros/TableroCampamentosSkeleton";
import { TablaRedSkeleton } from "./features/centros/TablaRedSkeleton";
import { CensoRedSkeleton } from "./features/censo/CensoRedSkeleton";
import { RefugiadosRedSkeleton } from "./features/refugiados/RefugiadosRedSkeleton";
import { FichaCentroSkeleton } from "./features/centros/FichaCentroSkeleton";
import { BandejaIncidenciasSkeleton } from "./features/incidencias/BandejaIncidenciasSkeleton";
import { GestionSkeleton } from "./features/usuarios/GestionSkeleton";
import { LogsSkeleton } from "./features/logs/LogsSkeleton";

// Rutas con carga perezosa: cada vista pesada (MapLibre, recharts, ficha
// humanitaria…) viaja en su propio chunk. El bundle inicial queda en el núcleo
// (React + Supabase + login) y el resto se descarga al navegar — clave para
// conexiones lentas. Los factories de import van aparte para poder PRECARGAR
// el chunk de la ruta inicial durante el arranque (mientras se restaura la
// sesión) y que el fallback de Suspense no destelle al soltar el splash.
const importCentrosView = () => import("./features/centros/CentrosView");
const importFichaCentroView = () => import("./features/centros/FichaCentroView");
const importNuevoCentroView = () => import("./features/centros/NuevoCentroView");
const importDashboardView = () => import("./features/dashboard/DashboardView");
const importIncidenciasRedirect = () => import("./features/incidencias/IncidenciasRedirect");
const importIncidenciasLayout = () => import("./features/incidencias/IncidenciasLayout");
const importIncidenciasFuncionariosView = () =>
  import("./features/incidencias/IncidenciasFuncionariosView");
const importIncidenciasRefugiadosView = () =>
  import("./features/incidencias/IncidenciasRefugiadosView");
const importDenunciasEliminadasView = () =>
  import("./features/incidencias/DenunciasEliminadasView");
const importGestionUsuarios = () => import("./features/usuarios/GestionUsuarios");
const importGestionUnidadesSebin = () =>
  import("./features/config/GestionUnidadesSebin");
const importLogsView = () => import("./features/logs/LogsView");
const importReportesDiariosRedView = () => import("./features/centros/ReportesDiariosRedView");
const importRefugiadosRedView = () => import("./features/refugiados/RefugiadosRedView");
const importRefugiadoDetalleRedView = () =>
  import("./features/refugiados/RefugiadoDetalleRedView");
const importDotacionesPendientesView = () =>
  import("./features/refugiados/DotacionesPendientesView");
const importCensoView = () => import("./features/censo/CensoView");
const importCensoRedView = () => import("./features/censo/CensoRedView");
const importCensoRedListadoView = () => import("./features/censo/CensoRedListadoView");
const importCensoCentroDetalleView = () => import("./features/censo/CensoCentroDetalleView");

const CentrosView = lazy(() => importCentrosView().then((m) => ({ default: m.CentrosView })));
const FichaCentroView = lazy(() =>
  importFichaCentroView().then((m) => ({ default: m.FichaCentroView })),
);
const NuevoCentroView = lazy(() =>
  importNuevoCentroView().then((m) => ({ default: m.NuevoCentroView })),
);
const DashboardView = lazy(() =>
  importDashboardView().then((m) => ({ default: m.DashboardView })),
);
const IncidenciasRedirect = lazy(() =>
  importIncidenciasRedirect().then((m) => ({ default: m.IncidenciasRedirect })),
);
const IncidenciasLayout = lazy(() =>
  importIncidenciasLayout().then((m) => ({ default: m.IncidenciasLayout })),
);
const IncidenciasFuncionariosView = lazy(() =>
  importIncidenciasFuncionariosView().then((m) => ({ default: m.IncidenciasFuncionariosView })),
);
const IncidenciasRefugiadosView = lazy(() =>
  importIncidenciasRefugiadosView().then((m) => ({ default: m.IncidenciasRefugiadosView })),
);
const DenunciasEliminadasView = lazy(() =>
  importDenunciasEliminadasView().then((m) => ({ default: m.DenunciasEliminadasView })),
);
const HojaQrsTerrenoView = lazy(() =>
  import("./features/centros/HojaQrsTerrenoView").then((m) => ({
    default: m.HojaQrsTerrenoView,
  })),
);
const GestionUsuarios = lazy(() =>
  importGestionUsuarios().then((m) => ({ default: m.GestionUsuarios })),
);
const GestionUnidadesSebin = lazy(() =>
  importGestionUnidadesSebin().then((m) => ({ default: m.GestionUnidadesSebin })),
);
const LogsView = lazy(() => importLogsView().then((m) => ({ default: m.LogsView })));
const ReportesDiariosRedView = lazy(() =>
  importReportesDiariosRedView().then((m) => ({ default: m.ReportesDiariosRedView })),
);
const RefugiadosRedView = lazy(() =>
  importRefugiadosRedView().then((m) => ({ default: m.RefugiadosRedView })),
);
const RefugiadoDetalleRedView = lazy(() =>
  importRefugiadoDetalleRedView().then((m) => ({ default: m.RefugiadoDetalleRedView })),
);
const DotacionesPendientesView = lazy(() =>
  importDotacionesPendientesView().then((m) => ({ default: m.DotacionesPendientesView })),
);
const CensoView = lazy(() => importCensoView().then((m) => ({ default: m.CensoView })));
const CensoRedView = lazy(() => importCensoRedView().then((m) => ({ default: m.CensoRedView })));
const CensoRedListadoView = lazy(() =>
  importCensoRedListadoView().then((m) => ({ default: m.CensoRedListadoView })),
);
const CensoCentroDetalleView = lazy(() =>
  importCensoCentroDetalleView().then((m) => ({ default: m.CensoCentroDetalleView })),
);

/**
 * Devuelve el import del chunk que renderizará la ruta actual, para
 * precargarlo en paralelo con la restauración de la sesión. Las rutas no
 * listadas caen al chunk del mapa (destino del fallback `*`).
 */
function esListadoCensoRed(pathname: string): boolean {
  return (
    pathname.startsWith("/centros/censo/personas") ||
    pathname.startsWith("/centros/censo-rapido/personas")
  );
}

function esDetalleCensoRed(pathname: string): boolean {
  return (
    /^\/centros\/censo\/[^/]+$/.test(pathname) ||
    /^\/centros\/censo-rapido\/[^/]+$/.test(pathname)
  );
}

function esTableroCensoRed(pathname: string): boolean {
  return pathname === "/centros/censo" || pathname === "/centros/censo-rapido";
}

/** Redirect legacy `/centros/censo-rapido/:centroId` → `/centros/censo/:centroId`. */
function RedirigirCensoRapidoCentro() {
  const { centroId } = useParams<{ centroId: string }>();
  return <Navigate to={`/centros/censo/${centroId ?? ""}`} replace />;
}

function precargarRutaInicial(pathname: string): Promise<unknown> {
  if (esListadoCensoRed(pathname)) return importCensoRedListadoView();
  if (esDetalleCensoRed(pathname)) return importCensoCentroDetalleView();
  if (esTableroCensoRed(pathname)) return importCensoRedView();
  if (pathname.startsWith("/censo")) return importCensoView();
  if (pathname.startsWith("/dashboard")) return importDashboardView();
  if (pathname.startsWith("/centros/tablero")) return importCentrosView();
  if (/^\/centros\/reportes\/[^/]+/.test(pathname)) return importFichaCentroView();
  if (pathname.startsWith("/centros/reportes")) return importReportesDiariosRedView();
  if (pathname.startsWith("/centros/refugiados/")) return importRefugiadoDetalleRedView();
  if (pathname.startsWith("/centros/refugiados")) return importRefugiadosRedView();
  if (pathname.startsWith("/centros/dotaciones-pendientes"))
    return importDotacionesPendientesView();
  if (pathname.startsWith("/centro/nuevo")) return importNuevoCentroView();
  if (pathname.startsWith("/centro/")) return importFichaCentroView();
  if (pathname.startsWith("/incidencias/eliminadas")) return importDenunciasEliminadasView();
  if (pathname.startsWith("/incidencias"))
    return Promise.all([importIncidenciasLayout(), importIncidenciasRedirect()]);
  if (pathname.startsWith("/usuarios")) return importGestionUsuarios();
  if (pathname.startsWith("/config/unidades-sebin")) return importGestionUnidadesSebin();
  if (pathname.startsWith("/logs")) return importLogsView();
  return importCentrosView();
}

/** Redirige a la vista inicial del rol si no tiene acceso a la ruta actual. */
function RutaAutorizada({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  const { pathname } = useLocation();
  if (!rutaPermitidaParaRol(pathname, sesion.user.rol)) {
    return <Navigate to={rutaInicialDeRol(sesion.user.rol)} replace />;
  }
  return children;
}

/** Lazy route con skeleton de sección (shell ya montado). */
function RutaConSkeleton({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  return <SectionSuspense fallback={fallback}>{children}</SectionSuspense>;
}

export function App() {
  const sesion = useSesion();
  const location = useLocation();
  const esMovil = useIsMobile();
  const [arrancando, setArrancando] = useState(true);

  const enMapa =
    location.pathname === "/centros/mapa" ||
    location.pathname === "/centros" ||
    location.pathname === "/";
  // En reporte diario el FAB tapa la barra de fases móvil.
  const enReporteDiario =
    new URLSearchParams(location.search).get("reportar") === "1";
  /** En móvil + mapa el botón va en la columna de controles, no como FAB. */
  const mostrarFabCache = !(esMovil && enMapa) && !enReporteDiario;

  useEffect(() => {
    const esCenso =
      window.location.pathname === "/censo" ||
      window.location.pathname.startsWith("/censo/");

    // La planilla pública no necesita restaurar sesión: evita una ida a Supabase
    // Auth antes de pintar. (En /censo el bootstrap ligero ni siquiera monta App.)
    const sesionLista = esCenso ? Promise.resolve() : initAuth();
    const chunkListo = precargarRutaInicial(window.location.pathname).catch((err) => {
      // Solo avisar si es el fallo típico de chunk obsoleto (no cualquier error
      // de red/compilación en localhost).
      console.warn("[app] Fallo al precargar la ruta inicial:", err);
      if (esErrorModuloObsoleto(err)) señalarAppObsoleta();
      return undefined;
    });
    void Promise.allSettled([sesionLista, chunkListo]).then(() => setArrancando(false));
  }, []);

  useEffect(() => {
    // El splash vive en index.html (fuera de React) para pintarse al instante;
    // se desvanece cuando la app ya decidió qué mostrar (home o login).
    if (!arrancando) ocultarSplash();
  }, [arrancando]);

  if (arrancando) return null;

  // Planilla de censo rápido en terreno: vista pública, sin login. Va antes
  // del gate de sesión para que los operadores accedan directo desde el enlace.
  if (location.pathname.startsWith("/censo")) {
    return (
      <>
        <AvisoActualizacionApp />
        {mostrarFabCache && <BotonBorrarCacheFlotante />}
        <Suspense fallback={<PantallaCarga />}>
          <CensoView />
        </Suspense>
      </>
    );
  }

  if (!sesion) {
    return (
      <>
        <AvisoActualizacionApp />
        {mostrarFabCache && <BotonBorrarCacheFlotante />}
        <Login />
      </>
    );
  }
  const mostrarMarcaAgua = sesion.user.marca_agua !== false;

  return (
    <>
      <AvisoActualizacionApp />
      {mostrarFabCache && <BotonBorrarCacheFlotante />}
      <Routes>
        <Route
          path="/dashboard"
          element={
            <RutaAutorizada sesion={sesion}>
              <RutaConSkeleton fallback={<DashboardViewSkeleton />}>
                <DashboardView sesion={sesion} />
              </RutaConSkeleton>
            </RutaAutorizada>
          }
        />

        <Route
          element={
            <RutaAutorizada sesion={sesion}>
              <AppShell sesion={sesion} />
            </RutaAutorizada>
          }
        >
          <Route path="/" element={<Navigate to="/centros/mapa" replace />} />
          <Route
            path="/centros/mapa"
            element={
              <RutaConSkeleton fallback={<MapaSectionSkeleton />}>
                <CentrosView />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/tablero"
            element={
              <RutaConSkeleton fallback={<TableroCampamentosSkeleton />}>
                <CentrosView />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/traslados"
            element={
              <EnDesarrollo
                titulo="Traslados entre campamentos"
                descripcion="Registro y seguimiento de movimientos de damnificados entre campamentos de la red."
              />
            }
          />
          <Route
            path="/centros/reportes/:centroId"
            element={
              <RutaConSkeleton fallback={<FichaCentroSkeleton />}>
                <FichaCentroView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/reportes"
            element={
              <RutaConSkeleton
                fallback={<TablaRedSkeleton etiqueta="Cargando reportes diarios" />}
              >
                <ReportesDiariosRedView />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/censo/personas"
            element={
              <RutaConSkeleton
                fallback={<TablaRedSkeleton conTabs etiqueta="Cargando listado de censo" />}
              >
                <CensoRedListadoView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/censo/:centroId"
            element={
              <RutaConSkeleton fallback={<FichaCentroSkeleton />}>
                <CensoCentroDetalleView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/censo"
            element={
              <RutaConSkeleton fallback={<CensoRedSkeleton />}>
                <CensoRedView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          {/* Alias legacy: censo-rapido → censo */}
          <Route
            path="/centros/censo-rapido/personas"
            element={<Navigate to="/centros/censo/personas" replace />}
          />
          <Route
            path="/centros/censo-rapido/:centroId"
            element={<RedirigirCensoRapidoCentro />}
          />
          <Route
            path="/centros/censo-rapido"
            element={<Navigate to="/centros/censo" replace />}
          />
          <Route
            path="/centros/refugiados"
            element={
              <RutaConSkeleton fallback={<RefugiadosRedSkeleton />}>
                <RefugiadosRedView />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/refugiados/:alojamientoId"
            element={
              <RutaConSkeleton fallback={<FichaCentroSkeleton />}>
                <RefugiadoDetalleRedView />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centros/dotaciones-pendientes"
            element={
              <RutaConSkeleton
                fallback={<TablaRedSkeleton etiqueta="Cargando dotaciones" />}
              >
                <DotacionesPendientesView />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centro/nuevo"
            element={
              <RutaConSkeleton fallback={<FichaCentroSkeleton />}>
                <NuevoCentroView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/centro/:id"
            element={
              <RutaConSkeleton fallback={<FichaCentroSkeleton />}>
                <FichaCentroView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/incidencias/eliminadas"
            element={
              <RutaConSkeleton fallback={<BandejaIncidenciasSkeleton />}>
                <DenunciasEliminadasView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/incidencias"
            element={
              <RutaConSkeleton fallback={<BandejaIncidenciasSkeleton />}>
                <IncidenciasLayout sesion={sesion} />
              </RutaConSkeleton>
            }
          >
            <Route index element={<IncidenciasRedirect sesion={sesion} />} />
            <Route
              path="funcionarios"
              element={<IncidenciasFuncionariosView sesion={sesion} />}
            />
            {/* Rutas absorbidas por la bandeja unificada de funcionarios. */}
            <Route
              path="archivadas"
              element={<Navigate to="/incidencias/funcionarios?estado=archivadas" replace />}
            />
            <Route
              path="analitica"
              element={<Navigate to="/incidencias/funcionarios" replace />}
            />
            <Route path="refugiados" element={<IncidenciasRefugiadosView sesion={sesion} />} />
          </Route>
          <Route
            path="/qrs-terreno"
            element={
              <RutaConSkeleton fallback={<TablaRedSkeleton etiqueta="Cargando QRs" />}>
                <HojaQrsTerrenoView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RutaConSkeleton fallback={<GestionSkeleton variante="usuarios" />}>
                <GestionUsuarios sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/config/unidades-sebin"
            element={
              <RutaConSkeleton fallback={<GestionSkeleton variante="unidades" />}>
                <GestionUnidadesSebin sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/logs"
            element={
              <RutaConSkeleton fallback={<LogsSkeleton />}>
                <LogsView sesion={sesion} />
              </RutaConSkeleton>
            }
          />
          <Route
            path="/config/perfil"
            element={
              <EnDesarrollo
                titulo="Preferencias de cuenta"
                descripcion="Configuración personal como marca de agua y notificaciones."
              />
            }
          />
          <Route
            path="/config/sistema"
            element={<Navigate to="/config/unidades-sebin" replace />}
          />
          <Route path="*" element={<Navigate to="/centros/mapa" replace />} />
        </Route>
      </Routes>
      {mostrarMarcaAgua && <MarcaAgua usuario={sesion.user} />}
    </>
  );
}
