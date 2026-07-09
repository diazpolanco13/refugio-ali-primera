// Detalle interno: listado de personas registradas en un campamento (censo rápido en terreno).
// Acceso restringido a admin, analista SAE y autoridad.

import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useCensoRedResumen } from "@/data/useCensoRedResumen";
import { puedeVerCensoRapidoRed } from "@/domain/permisos";
import { CensoCentroPanel } from "@/features/censo/CensoCentroPanel";
import { Button } from "@/components/ui/button";
import { VistaPagina } from "@/components/VistaPagina";

export function CensoCentroDetalleView({ sesion }: { sesion: Sesion }) {
  const { centroId } = useParams<{ centroId: string }>();
  const navigate = useNavigate();
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const { resumenes } = useCensoRedResumen();

  if (!centroId) {
    navigate("/centros/censo-rapido", { replace: true });
    return null;
  }

  const centroNombre =
    resumenes.find((r) => r.centroId === centroId)?.centroNombre ?? "Campamento";

  return (
    <VistaPagina
      icono={ClipboardList}
      acento="teal"
      titulo={centroNombre}
      descripcion="Personas registradas en el censo rápido de este campamento"
      cuerpoClassName="p-4 lg:p-6"
      acciones={
        tieneAcceso ? (
          <Button size="sm" variant="outline" asChild>
            <Link to="/centros/censo-rapido">
              <ArrowLeft className="size-4" />
              Volver
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
