// Pestaña Resumen de la ficha del centro: foto compacta, KPIs, seguimiento del día,
// identificación, acceso de terreno y alertas de servicios.

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { claveDia, guardarCentro } from "@/data/reposSupabase";
import { subirFotoCentro, supabaseDisponible } from "@/data/supabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import {
  normalizarCentro,
  normalizarServicios,
  poblacionCentro,
  type CentroTransitorio,
  type ServiciosCentro,
} from "@/domain/centrosTransitorios";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SeccionFotoCentro,
  SeccionIdentificacionCentro,
} from "./DetalleCentro";
import { AlertasDelDiaCentro, type VistaFichaCentro } from "./AlertasDelDiaCentro";
import { AccesoTerrenoCentro } from "./AccesoTerrenoCentro";
import { ProgresoCensoPoblacion } from "@/features/refugiados/ProgresoCensoPoblacion";
import { ultimoSnapshotAntes } from "./ParteNumericoResumen";

interface Props {
  centro: CentroTransitorio;
  puedeEditar?: boolean;
  onIrAPestana: (vista: VistaFichaCentro) => void;
}

/** Variación vs día anterior: verde +N, rojo -N. */
function Delta({ valor, anterior }: { valor: number; anterior?: number }) {
  if (anterior === undefined) return null;
  const d = valor - anterior;
  if (d === 0) return null;
  if (d > 0) {
    return (
      <span className="text-[10px] font-bold text-emerald-400">+{d.toLocaleString("es")}</span>
    );
  }
  return <span className="text-[10px] font-bold text-rose-400">{d.toLocaleString("es")}</span>;
}

/** KPIs compactos con delta vs ayer y cupo disponible. */
function KpisResumen({ centro }: { centro: CentroTransitorio }) {
  const c = normalizarCentro(centro);
  const analisis = analisisCentro(centro);
  const refugiados = poblacionCentro(centro);
  const hoy = useMemo(() => claveDia(Date.now()), []);
  const desde = useMemo(() => {
    const [y, m, d] = hoy.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 14);
    return claveDia(dt.getTime());
  }, [hoy]);

  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });
  const ayer = ultimoSnapshotAntes(snapshots, hoy);

  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];
  const cupoTexto =
    analisis.cupoReal != null ? analisis.cupoReal.toLocaleString("es") : "—";

  const items = [
    {
      etiqueta: "Damnificados",
      valor: refugiados,
      anterior: ayer?.total_afectados,
      clase: "text-sky-300",
    },
    {
      etiqueta: "Familias",
      valor: analisis.familias,
      anterior: ayer?.familias,
    },
    {
      etiqueta: "Personal",
      valor: analisis.personal,
      clase: "text-violet-300",
    },
    {
      etiqueta: "Cupo disponible",
      valor: cupoTexto,
      color: colorSemaforo,
      esCupo: true,
    },
  ];

  return (
    <div className="min-w-0 space-y-2">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.etiqueta}
            className="rounded-lg border border-border bg-card px-2 py-2 text-center sm:px-3 sm:py-2.5"
          >
            <div className="flex items-baseline justify-center gap-1">
              <div
                className={cn(
                  "text-lg font-bold tabular-nums leading-none text-foreground sm:text-xl",
                  item.clase,
                )}
                style={item.esCupo ? { color: item.color } : undefined}
              >
                {typeof item.valor === "number"
                  ? item.valor.toLocaleString("es")
                  : item.valor}
              </div>
              {!item.esCupo && typeof item.valor === "number" && (
                <Delta valor={item.valor} anterior={item.anterior} />
              )}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{item.etiqueta}</div>
          </div>
        ))}
      </div>
      {c.censo_en_proceso && (
        <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-500">
          Censo demográfico en proceso
        </Badge>
      )}
    </div>
  );
}

const CLAVES_SERVICIOS: { clave: keyof ServiciosCentro; label: string }[] = [
  { clave: "medicos", label: "Médicos" },
  { clave: "ambulancias", label: "Ambulancias" },
  { clave: "psicologo", label: "Psicólogo" },
  { clave: "contacto_juez_paz", label: "Juez de paz" },
];

/** Servicios con respuesta No o En proceso. */
function serviciosConAlerta(servicios: ServiciosCentro): string[] {
  return CLAVES_SERVICIOS.filter(({ clave }) => {
    const v = servicios[clave];
    return v === false || v === null;
  }).map(({ label }) => label);
}

/** Chip de alerta si algún servicio está No o En proceso. */
function ChipAlertaServicios({
  centro,
  onIrAPestana,
}: {
  centro: CentroTransitorio;
  onIrAPestana: (vista: VistaFichaCentro) => void;
}) {
  const c = normalizarCentro(centro);
  const pendientes = serviciosConAlerta(normalizarServicios(c.servicios));
  if (pendientes.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => onIrAPestana("poblacion")}
      className="flex w-full items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left transition-colors hover:bg-amber-500/15"
    >
      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">Servicios pendientes</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {pendientes.join(" · ")}
        </p>
      </div>
    </button>
  );
}

/** Foto editable desde Resumen: clic para subir/cambiar, se guarda al instante. */
function FotoCentroEditable({
  centro,
  puedeEditar,
}: {
  centro: CentroTransitorio;
  puedeEditar: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = normalizarCentro(centro);
  const hayFoto = Boolean(c.foto_url);
  const hayStorage = supabaseDisponible();
  const editable = puedeEditar && hayStorage && !subiendo;

  async function persistirFoto(url: string) {
    await guardarCentro({ ...centro, foto_url: url });
  }

  async function onArchivo(file: File) {
    if (!editable) return;
    setError(null);
    setSubiendo(true);
    try {
      const url = await subirFotoCentro(centro.id, file);
      await persistirFoto(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function quitarFoto() {
    if (!puedeEditar || subiendo) return;
    setError(null);
    setSubiendo(true);
    try {
      await persistirFoto("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted/20",
          editable && "group",
        )}
      >
        {hayFoto ? (
          <img
            src={c.foto_url}
            alt={centro.nombre}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            {subiendo ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="size-5 text-muted-foreground/70" />
            )}
            <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
              {subiendo ? "Subiendo…" : "Sin foto"}
            </span>
          </div>
        )}

        {subiendo && hayFoto && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2 className="size-5 animate-spin text-white" />
          </div>
        )}

        {editable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onArchivo(file);
              }}
            />
            <button
              type="button"
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 text-white transition-colors",
                "hover:bg-black/45 focus-visible:bg-black/45 focus-visible:outline-none",
                !hayFoto && "bg-transparent hover:bg-black/25",
              )}
              onClick={() => inputRef.current?.click()}
              aria-label={hayFoto ? "Cambiar foto del campamento" : "Añadir foto del campamento"}
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm",
                  hayFoto
                    ? "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    : "opacity-100",
                )}
              >
                <Camera className="size-3.5" />
                {hayFoto ? "Cambiar foto" : "Añadir foto"}
              </span>
            </button>
            {hayFoto && (
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                className="absolute right-1.5 top-1.5 z-10 size-7 bg-black/55 text-white hover:bg-black/70"
                title="Quitar foto"
                onClick={(e) => {
                  e.stopPropagation();
                  void quitarFoto();
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
      {!hayStorage && puedeEditar && (
        <p className="text-[10px] text-amber-400">
          Subida desactivada: falta configurar Supabase.
        </p>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

/** Composición de la pestaña Resumen. */
export function ResumenCentroPanel({ centro, puedeEditar = false, onIrAPestana }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-stretch">
        <div className="sm:col-span-1">
          {puedeEditar ? (
            <FotoCentroEditable centro={centro} puedeEditar />
          ) : (
            <SeccionFotoCentro
              centro={centro}
              className="h-full max-h-40 sm:max-h-none sm:aspect-auto"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:col-span-3">
          <KpisResumen centro={centro} />
          <ProgresoCensoPoblacion centro={centro} compacto />
          <AlertasDelDiaCentro centro={centro} onIrAPestana={onIrAPestana} />
        </div>
      </div>
      <SeccionIdentificacionCentro centro={centro} />
      <AccesoTerrenoCentro centro={centro} />
      <ChipAlertaServicios centro={centro} onIrAPestana={onIrAPestana} />
    </div>
  );
}
