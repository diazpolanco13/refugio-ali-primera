// Hoja imprimible de QRs de terreno (/qrs-terreno, solo admin/analista_sae):
// una página por campamento con sus dos códigos — el del PERSONAL (reporte y
// censo, secreto) y el PÚBLICO de denuncias (para pegar en carteleras). Los
// QRs se generan en el navegador (lib `qrcode`) y se imprimen con
// window.print(); un truco CSS de visibilidad deja en el papel solo las
// hojas, sin el marco de la app. Al sumar campamentos nuevos basta reimprimir.

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Printer } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { listarTokensTerrenoActivos } from "@/data/tokensCentros";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { puedeCrearCentros } from "@/domain/permisos";
import { Button } from "@/components/ui/button";
import { enlaceDenuncia, enlaceTerreno } from "@/lib/tokenTerreno";

interface Props {
  sesion: Sesion;
}

interface QrsCentro {
  personal?: string;
  publico?: string;
}

export function HojaQrsTerrenoView({ sesion }: Props) {
  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );

  const [qrs, setQrs] = useState<Map<string, QrsCentro>>(new Map());
  const [error, setError] = useState("");
  const [generando, setGenerando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const tokens = await listarTokensTerrenoActivos();
        const mapa = new Map<string, QrsCentro>();
        for (const t of tokens) {
          const url = t.tipo === "personal" ? enlaceTerreno(t.token) : enlaceDenuncia(t.token);
          const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 1 });
          if (cancelado) return;
          const previo = mapa.get(t.centro_id) ?? {};
          mapa.set(t.centro_id, { ...previo, [t.tipo]: dataUrl });
        }
        if (!cancelado) setQrs(mapa);
      } catch (err) {
        if (!cancelado)
          setError(err instanceof Error ? err.message : "No se pudieron cargar los tokens");
      } finally {
        if (!cancelado) setGenerando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (!puedeCrearCentros(sesion.user.rol)) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Esta vista es solo para administración y análisis.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .hoja-qrs-imprimible, .hoja-qrs-imprimible * { visibility: visible; }
          .hoja-qrs-imprimible { position: absolute; inset: 0; width: 100%; }
          .hoja-qrs-pagina { page-break-after: always; border: none !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Hoja de QRs por campamento</h1>
          <p className="text-xs text-muted-foreground">
            Una página por campamento: el QR del personal (guárdelo con el equipo del centro) y el
            QR público de denuncias (péguelo en carteleras, comedores y baños).
          </p>
        </div>
        <Button type="button" onClick={() => window.print()} disabled={generando || centros.length === 0}>
          <Printer className="size-4" />
          Imprimir ({centros.length})
        </Button>
      </div>

      {error && <p className="text-sm text-destructive print:hidden">{error}</p>}
      {generando && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground print:hidden">
          <Loader2 className="size-4 animate-spin" /> Generando códigos…
        </p>
      )}

      <div className="hoja-qrs-imprimible space-y-6 bg-white text-black">
        {centros.map((c) => {
          const q = qrs.get(c.id);
          if (!q) return null;
          return (
            <section
              key={c.id}
              className="hoja-qrs-pagina space-y-5 rounded-lg border border-neutral-300 bg-white p-6"
            >
              <header className="space-y-0.5 text-center">
                <p className="text-xs uppercase tracking-widest text-neutral-500">
                  Campamento Transitorio N.º {c.nro}
                </p>
                <h2 className="text-xl font-bold leading-tight">{c.nombre}</h2>
                {c.parroquia && <p className="text-sm text-neutral-600">{c.parroquia}</p>}
              </header>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 rounded-lg border-2 border-neutral-800 p-4 text-center">
                  <p className="text-sm font-bold uppercase tracking-wide">Uso del personal</p>
                  {q.personal && (
                    <img
                      src={q.personal}
                      alt={`QR del personal de ${c.nombre}`}
                      className="mx-auto w-full max-w-56"
                    />
                  )}
                  <p className="text-xs leading-snug text-neutral-600">
                    Reporte diario y censo del campamento. <strong>No publicar:</strong> entréguelo
                    solo al equipo que trabaja en el centro.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border-2 border-neutral-800 p-4 text-center">
                  <p className="text-sm font-bold uppercase tracking-wide">
                    Denuncias y sugerencias
                  </p>
                  {q.publico && (
                    <img
                      src={q.publico}
                      alt={`QR de denuncias de ${c.nombre}`}
                      className="mx-auto w-full max-w-56"
                    />
                  )}
                  <p className="text-xs leading-snug text-neutral-600">
                    Para los damnificados: escanee y reporte de forma <strong>anónima</strong>{" "}
                    cualquier problema con la comida, dotaciones, trato o seguridad. Péguelo en
                    carteleras y zonas comunes.
                  </p>
                </div>
              </div>

              <p className="text-center text-[10px] text-neutral-500">
                Red de Campamentos Transitorios — Caracas · {c.id}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
