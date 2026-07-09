import { Navigate } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";

/** Redirige `/incidencias` a la bandeja unificada de funcionarios. */
export function IncidenciasRedirect({ sesion: _sesion }: { sesion: Sesion }) {
  return <Navigate to="/incidencias/funcionarios" replace />;
}
