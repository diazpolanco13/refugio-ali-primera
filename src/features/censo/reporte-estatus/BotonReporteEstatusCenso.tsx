import { FileText, Loader2 } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ResumenCensoNominalCentro } from "@/domain/censoNominalRed";
import type { DatosReporteEstatusCenso } from "./ReporteEstatusCensoRedPdf";

const DescargaReporteEstatusCenso = lazy(() =>
  import("./DescargaReporteEstatusCenso").then((m) => ({
    default: m.DescargaReporteEstatusCenso,
  })),
);

/** Copia plana para que el PDF no dependa de referencias mutables del hook. */
function clonarResumenes(
  resumenes: ResumenCensoNominalCentro[],
): ResumenCensoNominalCentro[] {
  return resumenes.map((r) => ({ ...r }));
}

export function BotonReporteEstatusCenso({
  resumenes,
  cargando,
}: {
  resumenes: ResumenCensoNominalCentro[];
  /** true mientras centros o alojamientos siguen cargando */
  cargando?: boolean;
}) {
  const [solicitado, setSolicitado] = useState(false);
  const [generadoTs, setGeneradoTs] = useState(0);

  // Datos en vivo: si el usuario pulsó antes de terminar de cargar,
  // BlobProvider regenera cuando llegan los censados.
  const datos = useMemo<DatosReporteEstatusCenso>(
    () => ({
      resumenes: clonarResumenes(resumenes),
      generadoTs: generadoTs || Date.now(),
    }),
    [resumenes, generadoTs],
  );

  const bloqueado = Boolean(cargando) || resumenes.length === 0;

  if (!solicitado) {
    return (
      <Button
        type="button"
        size="sm"
        variant="default"
        className="h-8 gap-1.5"
        disabled={bloqueado}
        title={
          cargando
            ? "Espera a que termine de cargar el censo nominal"
            : undefined
        }
        onClick={() => {
          setGeneradoTs(Date.now());
          setSolicitado(true);
        }}
      >
        {cargando ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileText className="size-3.5" />
        )}
        {cargando ? "Cargando datos…" : "PDF estatus"}
      </Button>
    );
  }

  // Si aún está cargando tras el click, no montar BlobProvider con ceros.
  if (cargando) {
    return (
      <Button type="button" size="sm" variant="default" className="h-8 gap-1.5" disabled>
        <Loader2 className="size-3.5 animate-spin" />
        Esperando censo…
      </Button>
    );
  }

  return (
    <Suspense
      fallback={
        <Button type="button" size="sm" variant="default" className="h-8 gap-1.5" disabled>
          <Loader2 className="size-3.5 animate-spin" />
          Cargando PDF
        </Button>
      }
    >
      <DescargaReporteEstatusCenso datos={datos} />
    </Suspense>
  );
}
