// QR y enlace público de denuncias/sugerencias del campamento (token tipo
// `publico` → /denuncia). Lo ven admin, analista SAE y supervisores (estos
// últimos solo en sus campamentos asignados vía RLS). El QR se genera en el
// navegador.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copiarTexto } from "@/lib/portapapeles";
import { enlaceDenuncia } from "@/lib/tokenTerreno";
import { obtenerTokenActivoCentro } from "@/data/tokensCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { FlyerDenunciaCentro } from "./FlyerDenunciaCentro";

export function AccesoDenunciaCentro({ centro }: { centro: CentroTransitorio }) {
  const [enlace, setEnlace] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setEnlace("");
    setQrDataUrl("");
    obtenerTokenActivoCentro(centro.id, "publico")
      .then(async (token) => {
        if (cancelado || !token) return;
        const url = enlaceDenuncia(token);
        const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 1 });
        if (cancelado) return;
        setEnlace(url);
        setQrDataUrl(dataUrl);
      })
      .catch(() => {
        // Rol sin acceso a tokens (o error puntual): la sección no se muestra.
      });
    return () => {
      cancelado = true;
    };
  }, [centro.id]);

  if (!enlace) return null;

  async function copiarEnlace() {
    if (await copiarTexto(enlace)) {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <MessageSquareWarning className="size-3.5" aria-hidden="true" />
        Canal de denuncias
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={`QR de denuncias de ${centro.nombre}`}
            className="size-28 shrink-0 rounded-md border bg-white p-1"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs leading-snug text-muted-foreground">
            Enlace y QR públicos para que los damnificados envíen denuncias o sugerencias
            anónimas de este campamento. Péguelo en carteleras o zonas comunes.
          </p>
          <p className="truncate rounded-md border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {enlace}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={copiarEnlace}
            >
              {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copiado ? "Copiado" : "Copiar enlace"}
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <a href={qrDataUrl} download={`qr-denuncia-${centro.id}.png`}>
                <Download className="size-3.5" />
                Descargar QR
              </a>
            </Button>
            {qrDataUrl && (
              <FlyerDenunciaCentro
                centro={centro}
                qrDataUrl={qrDataUrl}
                enlace={enlace}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
