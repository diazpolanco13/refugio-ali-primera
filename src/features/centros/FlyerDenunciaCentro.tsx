// Flyer imprimible del canal de denuncias de un campamento (hoja carta).
// Formatos: 1 (carta), 2/3 (misma pieza girada 90° en franjas) y 6
// (rejilla 3 arriba × 3 abajo, piezas verticales compactas).

import { useEffect, useId, useState } from "react";
import {
  Handshake,
  Loader2,
  Megaphone,
  Package,
  Printer,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

export type FormatoFlyer = "1" | "2" | "3" | "6";

/** Alto útil de la hoja carta (aprox. 11in − márgenes de impresión). */
const ALTO_HOJA = "10.3in";
const ANCHO_HOJA = "8.5in";

const FORMATOS: {
  id: FormatoFlyer;
  label: string;
  detalle: string;
}[] = [
  { id: "1", label: "Carta completa", detalle: "1 flyer vertical por hoja" },
  { id: "2", label: "2 por hoja", detalle: "Misma pieza girada · cortar" },
  { id: "3", label: "3 por hoja", detalle: "Misma pieza girada · cortar" },
  { id: "6", label: "6 por hoja", detalle: "3 arriba · 3 abajo · cortar" },
];

const CATEGORIAS_FLYER = [
  { label: "Comida", Icon: Utensils },
  { label: "Dotaciones", Icon: Package },
  { label: "Trato", Icon: Handshake },
  { label: "Seguridad", Icon: ShieldCheck },
] as const;

function IconosCategorias({ size }: { size: "lg" | "md" | "sm" | "xs" }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-center",
        size === "lg" && "gap-6",
        size === "md" && "gap-4",
        size === "sm" && "gap-3",
        size === "xs" && "gap-2",
      )}
    >
      {CATEGORIAS_FLYER.map(({ label, Icon }) => (
        <div key={label} className="flex flex-col items-center gap-0.5">
          <div
            className={cn(
              "flex items-center justify-center rounded-full bg-white text-sky-800 ring-1 ring-sky-200/70",
              size === "lg" && "size-11",
              size === "md" && "size-9",
              size === "sm" && "size-7",
              size === "xs" && "size-6",
            )}
          >
            <Icon
              className={cn(
                size === "lg" && "size-5",
                size === "md" && "size-4",
                size === "sm" && "size-3.5",
                size === "xs" && "size-3",
              )}
              strokeWidth={1.75}
            />
          </div>
          <span
            className={cn(
              "font-medium text-slate-600",
              size === "lg" && "text-[10px]",
              size === "md" && "text-[9px]",
              size === "sm" && "text-[8px]",
              size === "xs" && "text-[7px]",
            )}
          >
            {label}
          </span>
        </div>
      ))}
      {size !== "xs" && (
        <div className="flex flex-col items-center gap-1 self-center pb-0.5">
          <span
            className={cn(
              "font-semibold text-slate-500",
              size === "lg" && "text-xs",
              size === "md" && "text-[10px]",
              size === "sm" && "text-[9px]",
            )}
          >
            y otros
          </span>
        </div>
      )}
    </div>
  );
}

type EscalaPieza = "carta" | "media" | "tercio" | "mini";

/** Misma composición vertical; bloque compacto centrado (sin huecos altos). */
function PiezaFlyer({
  centro,
  qrDataUrl,
  escala,
  className,
}: {
  centro: CentroTransitorio;
  qrDataUrl: string;
  escala: EscalaPieza;
  className?: string;
}) {
  const mini = escala === "mini";
  const sm = escala === "tercio";
  const md = escala === "media";

  return (
    <article
      className={cn(
        "flyer-pieza relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-slate-900",
        escala === "carta" && "px-10 py-6",
        md && "px-6 py-3",
        sm && "px-4 py-2",
        mini && "px-2 py-1.5",
        className,
      )}
      style={{ background: "#ffffff" }}
    >
      {/* Bloque único: título → QR → textos, sin justify-between */}
      <div
        className={cn(
          "flex w-full max-w-lg flex-col items-center",
          escala === "carta" && "gap-3",
          md && "gap-2",
          sm && "gap-1.5",
          mini && "gap-1",
        )}
      >
        <header className={cn("w-full text-center", mini ? "space-y-0" : "space-y-1")}>
          <p
            className={cn(
              "font-semibold uppercase tracking-[0.18em] text-slate-500",
              mini
                ? "text-[7px] tracking-[0.12em]"
                : sm
                  ? "text-[9px]"
                  : md
                    ? "text-[11px]"
                    : "text-xs",
            )}
          >
            Campamentos Transitorios · Caracas
          </p>
          <h2
            className={cn(
              "font-black uppercase leading-[1.05] tracking-tight text-slate-900",
              mini ? "text-xs" : sm ? "text-xl" : md ? "text-2xl" : "text-[2.15rem]",
            )}
          >
            Tu voz nos ayuda
            {!mini && (
              <>
                <br />a mejorar
              </>
            )}
            {mini && " a mejorar"}
          </h2>
          <p
            className={cn(
              "font-semibold leading-tight text-slate-700",
              mini ? "text-[10px]" : sm ? "text-sm" : md ? "text-base" : "text-lg",
            )}
          >
            {centro.nro != null ? `N.º ${centro.nro} · ` : ""}
            {centro.nombre}
          </p>
        </header>

        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,23,42,0.1)] ring-1 ring-slate-200/80",
            escala === "carta" && "p-3",
            md && "p-2.5",
            sm && "rounded-xl p-1.5",
            mini && "rounded-lg p-1",
          )}
        >
          <img
            src={qrDataUrl}
            alt={`QR de denuncias de ${centro.nombre}`}
            className={cn(
              "block",
              escala === "carta" && "size-[15rem]",
              md && "size-44",
              sm && "size-36",
              mini && "size-[5.5rem]",
            )}
          />
        </div>

        <div
          className={cn(
            "flex w-full flex-col items-center",
            mini ? "gap-0.5" : sm ? "gap-1" : md ? "gap-1.5" : "gap-2",
          )}
        >
          <p
            className={cn(
              "flex items-center justify-center gap-1.5 text-center font-medium text-slate-700",
              mini ? "text-[8px] leading-tight" : sm ? "text-xs" : md ? "text-sm" : "text-sm",
            )}
          >
            <Megaphone
              className={cn(
                "shrink-0 text-sky-700",
                mini ? "size-3" : sm ? "size-3.5" : "size-4",
              )}
              aria-hidden="true"
            />
            <span>
              {mini
                ? "Escanea para enviar tu reporte"
                : "Escanea este código para enviarnos tu opinión o reporte sobre:"}
            </span>
          </p>
          <IconosCategorias size={mini ? "xs" : sm ? "sm" : md ? "md" : "lg"} />
          <p
            className={cn(
              "text-center leading-snug text-slate-600",
              mini
                ? "max-w-[24ch] text-[8px]"
                : sm
                  ? "max-w-[38ch] text-[11px]"
                  : md
                    ? "max-w-[40ch] text-xs"
                    : "max-w-[40ch] text-sm",
            )}
          >
            Este canal es{" "}
            <strong className="font-semibold text-slate-900">100% confidencial y seguro</strong>
            {mini || sm
              ? ", para el bienestar de todos."
              : ", diseñado para asegurar el bienestar de todos y la mejora continua del campamento."}
          </p>
        </div>

        <footer className="w-full text-center">
          <div
            className={cn(
              "mx-auto h-px bg-slate-300/90",
              mini ? "mb-0.5 w-8" : sm ? "mb-1 w-14" : "mb-1.5 w-20",
            )}
          />
          <p
            className={cn(
              "font-semibold uppercase tracking-[0.16em] text-slate-500",
              mini ? "text-[6.5px]" : sm ? "text-[8px]" : "text-[10px]",
            )}
          >
            Red de Campamentos Transitorios
          </p>
        </footer>
      </div>
    </article>
  );
}

/**
 * Guía de recorte: rectángulo con trazo punteado (SVG).
 * Fina y visible en la vista previa escalada y al imprimir.
 */
function GuiaCorte({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "flyer-recorte pointer-events-none absolute inset-0 z-10 h-full w-full",
        className,
      )}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <rect
        x="0.35"
        y="0.35"
        width="99.3"
        height="99.3"
        fill="none"
        stroke="#64748b"
        strokeWidth="0.4"
        strokeDasharray="1.1 1"
      />
    </svg>
  );
}

/** Celda con guía de recorte un poco inset hacia el contenido. */
function MarcoRecorte({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flyer-recorte-marco relative min-h-0 min-w-0", className)}>
      <div className="pointer-events-none absolute inset-[6px] z-10" aria-hidden="true">
        <GuiaCorte />
      </div>
      <div className="relative z-0 h-full w-full overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * Franja de la hoja carta: la pieza vertical se gira −90° para ocupar el
 * ancho de la hoja. Al cortar y girar el papel, se lee en vertical.
 */
function CeldaGirada({
  altoFranja,
  centro,
  qrDataUrl,
  escala,
}: {
  altoFranja: string;
  centro: CentroTransitorio;
  qrDataUrl: string;
  escala: EscalaPieza;
}) {
  return (
    <MarcoRecorte className="w-full">
      <div className="relative w-full" style={{ height: altoFranja }}>
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: altoFranja,
            height: ANCHO_HOJA,
            transform: "translate(-50%, -50%) rotate(-90deg)",
          }}
        >
          <PiezaFlyer centro={centro} qrDataUrl={qrDataUrl} escala={escala} />
        </div>
      </div>
    </MarcoRecorte>
  );
}

function HojaImprimible({
  formato,
  centro,
  qrDataUrl,
  className,
}: {
  formato: FormatoFlyer;
  centro: CentroTransitorio;
  qrDataUrl: string;
  className?: string;
}) {
  if (formato === "1") {
    return (
      <div
        className={cn("flyer-hoja relative bg-white text-black", className)}
        style={{ width: ANCHO_HOJA, minHeight: ALTO_HOJA }}
        data-formato={formato}
      >
        {/* Guía un poco más cerca del bloque de contenido. */}
        <div className="pointer-events-none absolute inset-[0.7in] z-10" aria-hidden="true">
          <GuiaCorte />
        </div>
        <div style={{ height: ALTO_HOJA }}>
          <PiezaFlyer centro={centro} qrDataUrl={qrDataUrl} escala="carta" />
        </div>
      </div>
    );
  }

  // 6 por hoja: rejilla 3 columnas × 2 filas (vertical, sin girar).
  if (formato === "6") {
    return (
      <div
        className={cn(
          "flyer-hoja grid grid-cols-3 grid-rows-2 bg-white text-black",
          className,
        )}
        style={{ width: ANCHO_HOJA, height: ALTO_HOJA }}
        data-formato={formato}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <MarcoRecorte key={i} className="h-full min-h-0">
            <PiezaFlyer centro={centro} qrDataUrl={qrDataUrl} escala="mini" />
          </MarcoRecorte>
        ))}
      </div>
    );
  }

  const piezas = Number(formato) as 2 | 3;
  const altoFranja = `calc(${ALTO_HOJA} / ${piezas})`;
  const escala: EscalaPieza = formato === "2" ? "media" : "tercio";

  return (
    <div
      className={cn("flyer-hoja flex flex-col bg-white text-black", className)}
      style={{ width: ANCHO_HOJA, minHeight: ALTO_HOJA }}
      data-formato={formato}
    >
      {Array.from({ length: piezas }, (_, i) => (
        <CeldaGirada
          key={i}
          altoFranja={altoFranja}
          centro={centro}
          qrDataUrl={qrDataUrl}
          escala={escala}
        />
      ))}
    </div>
  );
}

interface Props {
  centro: CentroTransitorio;
  qrDataUrl: string;
  enlace: string;
}

/** Diálogo + hoja imprimible del flyer de denuncias del campamento. */
export function FlyerDenunciaCentro({ centro, qrDataUrl }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [formato, setFormato] = useState<FormatoFlyer>("1");
  const [imprimiendo, setImprimiendo] = useState(false);
  const scopeId = useId().replace(/:/g, "");

  useEffect(() => {
    if (!abierto) return;
    const onAfterPrint = () => setImprimiendo(false);
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, [abierto]);

  function imprimir() {
    setImprimiendo(true);
    window.setTimeout(() => window.print(), 50);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setAbierto(true)}
      >
        <Printer className="size-3.5" />
        Imprimir flyer
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Flyer de denuncias</DialogTitle>
            <DialogDescription>
              Hoja carta imprimible para carteleras de {centro.nombre}. Elija el formato y corte
              por las guías.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 px-4 pt-3 sm:px-6">
            {FORMATOS.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={formato === f.id ? "default" : "outline"}
                className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
                onClick={() => setFormato(f.id)}
              >
                <span className="text-xs font-semibold">{f.label}</span>
                <span className="text-[10px] font-normal opacity-80">{f.detalle}</span>
              </Button>
            ))}
          </div>

          <div className="overflow-hidden bg-white p-3 sm:px-6">
            <div className="mx-auto w-[8.5in] origin-top scale-[0.42] border border-slate-200 sm:scale-50">
              <HojaImprimible formato={formato} centro={centro} qrDataUrl={qrDataUrl} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
            <Button type="button" onClick={imprimir} disabled={imprimiendo}>
              {imprimiendo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div
        id={`flyer-print-${scopeId}`}
        className="flyer-denuncia-imprimible pointer-events-none fixed left-0 top-0 -z-10 opacity-0"
        aria-hidden="true"
        data-activo={abierto ? "1" : "0"}
      >
        <style>{`
          @media print {
            @page { size: letter portrait; margin: 0.35in; }
            body * { visibility: hidden !important; }
            .flyer-denuncia-imprimible,
            .flyer-denuncia-imprimible * { visibility: visible !important; }
            .flyer-denuncia-imprimible {
              position: absolute !important;
              inset: 0 !important;
              z-index: 99999 !important;
              opacity: 1 !important;
              width: 100% !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .flyer-hoja {
              min-height: 10in !important;
              width: 100% !important;
              page-break-after: avoid;
            }
            .flyer-pieza {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .flyer-recorte {
              stroke: #64748b !important;
            }
          }
        `}</style>
        {abierto && (
          <HojaImprimible formato={formato} centro={centro} qrDataUrl={qrDataUrl} />
        )}
      </div>
    </>
  );
}
