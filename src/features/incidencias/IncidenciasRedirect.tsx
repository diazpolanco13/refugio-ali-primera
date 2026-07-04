import { Navigate } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";
import { puedeEscribir } from "@/domain/permisos";

/** Redirige `/incidencias` a la bandeja operativa o analítica según el rol. */
export function IncidenciasRedirect({ sesion }: { sesion: Sesion }) {
  const dest = puedeEscribir(sesion.user.rol)
    ? "/incidencias/funcionarios"
    : "/incidencias/analitica";
  return <Navigate to={dest} replace />;
}
