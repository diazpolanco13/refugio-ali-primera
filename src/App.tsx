import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { CentrosView } from "./features/centros/CentrosView";
import { DashboardView } from "./features/dashboard/DashboardView";
import { Login } from "./features/auth/Login";
import { GestionUsuarios } from "./features/usuarios/GestionUsuarios";
import { useSesion } from "./data/auth";
import { detenerSync, iniciarSync } from "./data/sync";
import { MarcaAgua } from "./components/MarcaAgua";
import { PantallaCarga } from "./components/PantallaCarga";

export function App() {
  const sesion = useSesion();
  const [arrancando, setArrancando] = useState(true);

  useEffect(() => {
    setArrancando(false);
  }, []);

  useEffect(() => {
    if (sesion) iniciarSync();
    else detenerSync();
  }, [sesion?.token]);

  if (arrancando) return <PantallaCarga />;
  if (!sesion) return <Login />;
  const mostrarMarcaAgua = sesion.user.marca_agua !== false;

  return (
    <>
      <Routes>
        <Route path="/" element={<CentrosView sesion={sesion} />} />
        <Route path="/dashboard" element={<DashboardView sesion={sesion} />} />
        <Route path="/usuarios" element={<GestionUsuarios sesion={sesion} />} />
        <Route path="*" element={<CentrosView sesion={sesion} />} />
      </Routes>
      {mostrarMarcaAgua && <MarcaAgua usuario={sesion.user} />}
    </>
  );
}
