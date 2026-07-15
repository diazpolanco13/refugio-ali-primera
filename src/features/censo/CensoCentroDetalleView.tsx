// Acceso: roles de red (admin, analista SAE, autoridad, censo_rapido) y
// supervisor en el campamento asignado.

import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useCensoNominalRed } from "@/data/useCensoNominalRed";
import { puedeVerCensoCentro, puedeVerCensoRapidoRed } from "@/domain/permisos";
import { CensoCentroPanel } from "@/features/censo/CensoCentroPanel";
import { Button } from "@/components/ui/button";
import { VistaPagina } from "@/components/VistaPagina";

export function CensoCentroDetalleView({ sesion }: { sesion: Sesion }) {
  const { centroId } = useParams<{ centroId: string }>();
  const navigate = useNavigate();
  const tieneAccesoRed = puedeVerCensoRapidoRed(sesion.user.rol);
  const tieneAcceso =
    centroId != null && puedeVerCensoCentro(sesion.user, centroId);
  const { resumenes } = useCensoNominalRed();

  if (!centroId) {
    navigate("/centros/censo", { replace: true });
    return null;
  }

  const resumen = resumenes.find((r) => r.centroId === centroId);
  const centroNombre = resumen?.centroNombre ?? "Campamento";

  return (
    <VistaPagina
      icono={ClipboardList}
      acento="teal"
      titulo={centroNombre}
      descripcion="Avance del censo nominal vs parte y personas registradas en este campamento"
      cuerpoClassName="p-4 lg:p-6"
      acciones={
        tieneAccesoRed ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/centros/censo">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
        ) : tieneAcceso ? (
          <Button size="sm" variant="outline" asChild>
            <Link to={`/centro/${centroId}?vista=censo_rapido`}>
              <ArrowLeft className="size-4" />
              Volver al campamento
            </Link>
          </Button>
        ) : undefined
      }
    >
      <CensoCentroPanel
        centroId={centroId}
        centroNombre={centroNombre}
        sesion={sesion}
      />
    </VistaPagina>
  );
}
