import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Login } from "./features/auth/Login";
import { initAuth, useSesion, type Sesion } from "./data/authSupabase";
import { MarcaAgua } from "./components/MarcaAgua";
import { PantallaCarga } from "./components/PantallaCarga";
import { EnDesarrollo } from "./components/EnDesarrollo";
import { AppShell } from "./layouts/AppShell";
import { ocultarSplash } from "./lib/splash";
import { rutaPermitidaParaRol } from "./domain/permisos";

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
const importIncidenciasArchivadasView = () =>
  import("./features/incidencias/IncidenciasArchivadasView");
const importIncidenciasAnaliticaView = () =>
  import("./features/incidencias/IncidenciasAnaliticaView");
const importIncidenciasRefugiadosView = () =>
  import("./features/incidencias/IncidenciasRefugiadosView");
const importGestionUsuarios = () => import("./features/usuarios/GestionUsuarios");
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
const IncidenciasArchivadasView = lazy(() =>
  importIncidenciasArchivadasView().then((m) => ({ default: m.IncidenciasArchivadasView })),
);
const IncidenciasAnaliticaView = lazy(() =>
  importIncidenciasAnaliticaView().then((m) => ({ default: m.IncidenciasAnaliticaView })),
);
const IncidenciasRefugiadosView = lazy(() =>
  importIncidenciasRefugiadosView().then((m) => ({ default: m.IncidenciasRefugiadosView })),
);
const GestionUsuarios = lazy(() =>
  importGestionUsuarios().then((m) => ({ default: m.GestionUsuarios })),
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
function precargarRutaInicial(pathname: string): Promise<unknown> {
  if (pathname.startsWith("/centros/censo-rapido/personas")) return importCensoRedListadoView();
  if (pathname.startsWith("/centros/censo-rapido/")) return importCensoCentroDetalleView();
  if (pathname.startsWith("/centros/censo-rapido")) return importCensoRedView();
  if (pathname.startsWith("/censo")) return importCensoView();
  if (pathname.startsWith("/dashboard")) return importDashboardView();
  if (pathname.startsWith("/centros/tablero")) return importCentrosView();
  if (pathname.startsWith("/centros/reportes")) return importReportesDiariosRedView();
  if (pathname.startsWith("/centros/refugiados/")) return importRefugiadoDetalleRedView();
  if (pathname.startsWith("/centros/refugiados")) return importRefugiadosRedView();
  if (pathname.startsWith("/centros/dotaciones-pendientes"))
    return importDotacionesPendientesView();
  if (pathname.startsWith("/centro/nuevo")) return importNuevoCentroView();
  if (pathname.startsWith("/centro/")) return importFichaCentroView();
  if (pathname.startsWith("/incidencias"))
    return Promise.all([importIncidenciasLayout(), importIncidenciasRedirect()]);
  if (pathname.startsWith("/usuarios")) return importGestionUsuarios();
  if (pathname.startsWith("/logs")) return importLogsView();
  return importCentrosView();
}

/** Redirige al mapa si el rol no tiene acceso a la ruta actual. */
function RutaAutorizada({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  const { pathname } = useLocation();
  if (!rutaPermitidaParaRol(pathname, sesion.user.rol)) {
    return <Navigate to="/centros/mapa" replace />;
  }
  return children;
}

export function App() {
  const sesion = useSesion();
  const location = useLocation();
  const [arrancando, setArrancando] = useState(true);

  useEffect(() => {
    const esCenso =
      window.location.pathname === "/censo" ||
      window.location.pathname.startsWith("/censo/");

    // La planilla pública no necesita restaurar sesión: evita una ida a Supabase
    // Auth antes de pintar. (En /censo el bootstrap ligero ni siquiera monta App.)
    const sesionLista = esCenso ? Promise.resolve() : initAuth();
    const chunkListo = precargarRutaInicial(window.location.pathname).catch(() => undefined);
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
      <Suspense fallback={<PantallaCarga />}>
        <CensoView />
      </Suspense>
    );
  }

  if (!sesion) return <Login />;
  const mostrarMarcaAgua = sesion.user.marca_agua !== false;

  return (
    <>
      <Suspense fallback={<PantallaCarga />}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RutaAutorizada sesion={sesion}>
                <DashboardView sesion={sesion} />
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
            <Route path="/centros/mapa" element={<CentrosView />} />
            <Route path="/centros/tablero" element={<CentrosView />} />
            <Route
              path="/centros/traslados"
              element={
                <EnDesarrollo
                  titulo="Traslados entre campamentos"
                  descripcion="Registro y seguimiento de movimientos de damnificados entre campamentos de la red."
                />
              }
            />
            <Route path="/centros/reportes" element={<ReportesDiariosRedView />} />
            <Route
              path="/centros/censo-rapido/personas"
              element={<CensoRedListadoView sesion={sesion} />}
            />
            <Route
              path="/centros/censo-rapido/:centroId"
              element={<CensoCentroDetalleView sesion={sesion} />}
            />
            <Route path="/centros/censo-rapido" element={<CensoRedView sesion={sesion} />} />
            <Route path="/centros/refugiados" element={<RefugiadosRedView />} />
            <Route path="/centros/refugiados/:alojamientoId" element={<RefugiadoDetalleRedView />} />
            <Route path="/centros/dotaciones-pendientes" element={<DotacionesPendientesView />} />
            <Route path="/centro/nuevo" element={<NuevoCentroView sesion={sesion} />} />
            <Route path="/centro/:id" element={<FichaCentroView sesion={sesion} />} />
            <Route path="/incidencias" element={<IncidenciasLayout sesion={sesion} />}>
              <Route index element={<IncidenciasRedirect sesion={sesion} />} />
              <Route
                path="funcionarios"
                element={<IncidenciasFuncionariosView sesion={sesion} />}
              />
              <Route path="archivadas" element={<IncidenciasArchivadasView />} />
              <Route path="analitica" element={<IncidenciasAnaliticaView />} />
              <Route path="refugiados" element={<IncidenciasRefugiadosView />} />
            </Route>
            <Route path="/usuarios" element={<GestionUsuarios sesion={sesion} />} />
            <Route path="/logs" element={<LogsView sesion={sesion} />} />
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
              element={
                <EnDesarrollo
                  titulo="Catálogos y parámetros"
                  descripcion="Administración de cuerpos, categorías de incidencias y umbrales Esfera."
                />
              }
            />
            <Route path="*" element={<Navigate to="/centros/mapa" replace />} />
          </Route>
        </Routes>
      </Suspense>
      {mostrarMarcaAgua && <MarcaAgua usuario={sesion.user} />}
    </>
  );
}
