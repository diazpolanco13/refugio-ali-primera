import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { CentrosView } from "./features/centros/CentrosView";
import { FichaCentroView } from "./features/centros/FichaCentroView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { Login } from "./features/auth/Login";
import { GestionUsuarios } from "./features/usuarios/GestionUsuarios";
import { initAuth, useSesion } from "./data/authSupabase";
import { MarcaAgua } from "./components/MarcaAgua";
import { PantallaCarga } from "./components/PantallaCarga";

export function App() {
  const sesion = useSesion();
  const [arrancando, setArrancando] = useState(true);

  // Arranque: inicializa la suscripción a `onAuthStateChange` de Supabase Auth
  // y carga la sesión persistida (si existe). Reemplaza al `iniciarSync` del
  // motor Dexie↔Fastify (ya no hay sync: cada mutación es directa a Supabase).
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
        <Route path="/" element={<CentrosView sesion={sesion} />} />
        <Route path="/centro/:id" element={<FichaCentroView sesion={sesion} />} />
        <Route path="/dashboard" element={<DashboardView sesion={sesion} />} />
        <Route path="/usuarios" element={<GestionUsuarios sesion={sesion} />} />
        <Route path="*" element={<CentrosView sesion={sesion} />} />
      </Routes>
      {mostrarMarcaAgua && <MarcaAgua usuario={sesion.user} />}
    </>
  );
}
