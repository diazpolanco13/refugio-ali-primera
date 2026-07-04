import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { CentrosView } from "./features/centros/CentrosView";
import { FichaCentroView } from "./features/centros/FichaCentroView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { IncidenciasRedirect } from "./features/incidencias/IncidenciasRedirect";
import { IncidenciasLayout } from "./features/incidencias/IncidenciasLayout";
import { IncidenciasFuncionariosView } from "./features/incidencias/IncidenciasFuncionariosView";
import { IncidenciasArchivadasView } from "./features/incidencias/IncidenciasArchivadasView";
import { IncidenciasAnaliticaView } from "./features/incidencias/IncidenciasAnaliticaView";
import { IncidenciasRefugiadosView } from "./features/incidencias/IncidenciasRefugiadosView";
import { Login } from "./features/auth/Login";
import { GestionUsuarios } from "./features/usuarios/GestionUsuarios";
import { LogsView } from "./features/logs/LogsView";
import { initAuth, useSesion } from "./data/authSupabase";
import { MarcaAgua } from "./components/MarcaAgua";
import { PantallaCarga } from "./components/PantallaCarga";
import { EnDesarrollo } from "./components/EnDesarrollo";
import { AppShell } from "./layouts/AppShell";

export function App() {
  const sesion = useSesion();
  const [arrancando, setArrancando] = useState(true);

  useEffect(() => {
    void initAuth();
    setArrancando(false);
  }, []);

  if (arrancando) return <PantallaCarga />;
  if (!sesion) return <Login />;
  const mostrarMarcaAgua = sesion.user.marca_agua !== false;

  return (
    <>
      <Routes>
        <Route path="/dashboard" element={<DashboardView sesion={sesion} />} />

        <Route element={<AppShell sesion={sesion} />}>
          <Route path="/" element={<Navigate to="/centros/mapa" replace />} />
          <Route path="/centros/mapa" element={<CentrosView />} />
          <Route path="/centros/tablero" element={<CentrosView />} />
          <Route
            path="/centros/traslados"
            element={
              <EnDesarrollo
                titulo="Traslados entre centros"
                descripcion="Registro y seguimiento de movimientos de refugiados entre centros de la red."
              />
            }
          />
          <Route
            path="/centros/reportes"
            element={
              <EnDesarrollo
                titulo="Reportes diarios (red)"
                descripcion="Vista agregada de reportes diarios de todos los centros."
              />
            }
          />
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
      {mostrarMarcaAgua && <MarcaAgua usuario={sesion.user} />}
    </>
  );
}
