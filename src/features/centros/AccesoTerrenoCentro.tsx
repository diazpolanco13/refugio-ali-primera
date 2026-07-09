// Acceso de terreno del campamento: enlace con token secreto + QR para el
// personal que trabaja dentro del refugio (abre /terreno ya autorizado para
// ESTE campamento, sin usuario). Solo la ven admin/analista_sae: la RLS de
// `tokens_centros` oculta el token al resto de roles y la sección no se pinta.
// El QR se genera en el navegador (lib `qrcode`), sin servicios externos.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, QrCode as QrCodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copiarTexto } from "@/lib/portapapeles";
import { enlaceTerreno } from "@/lib/tokenTerreno";
import { obtenerTokenActivoCentro } from "@/data/tokensCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

export function AccesoTerrenoCentro({ centro }: { centro: CentroTransitorio }) {
  const [enlace, setEnlace] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setEnlace("");
    setQrDataUrl("");
    obtenerTokenActivoCentro(centro.id, "personal")
      .then(async (token) => {
        if (cancelado || !token) return;
        const url = enlaceTerreno(token);
        // 512px de ancho: nítido tanto en pantalla como impreso en una hoja.
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
        <QrCodeIcon className="size-3.5" aria-hidden="true" />
        Acceso de terreno
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt={`QR de acceso de terreno de ${centro.nombre}`}
            className="size-28 shrink-0 rounded-md border bg-white p-1"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs leading-snug text-muted-foreground">
            Abre el portal de terreno (censo y reporte) autorizado solo para este campamento.
            Repártalo únicamente al personal del centro: quien tenga el enlace puede registrar y
            consultar su censo.
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
              <a href={qrDataUrl} download={`qr-terreno-${centro.id}.png`}>
                <Download className="size-3.5" />
                Descargar QR
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
