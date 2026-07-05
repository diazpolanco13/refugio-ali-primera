// Detalle de refugiado desde la vista global (/centros/refugiados/:alojamientoId).

import { useNavigate, useParams } from "react-router-dom";
import { useSesion } from "@/data/authSupabase";
import { puedeEditarCentro } from "@/domain/permisos";
import { useAlojamientoDetalle } from "@/data/useAlojamientoDetalle";
import { FichaRefugiadoView } from "./FichaRefugiadoView";

export function RefugiadoDetalleRedView() {
  const { alojamientoId } = useParams<{ alojamientoId: string }>();
  const navigate = useNavigate();
  const sesion = useSesion();
  const { alojamiento } = useAlojamientoDetalle(alojamientoId);

  const puedeEditar =
    sesion && alojamiento ? puedeEditarCentro(sesion.user, alojamiento.centro_id) : false;

  if (!alojamientoId) {
    navigate("/centros/refugiados", { replace: true });
    return null;
  }

  return (
    <FichaRefugiadoView
      alojamientoId={alojamientoId}
      puedeEditar={puedeEditar}
      onVolver={() => navigate("/centros/refugiados")}
      onAbrirMiembro={(id) => navigate(`/centros/refugiados/${id}`)}
    />
  );
}
