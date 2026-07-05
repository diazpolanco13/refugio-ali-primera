// Pestaña Resumen de la ficha del centro: KPIs, alertas del día, identificación,
// novedades/notas y accesos rápidos a otras pestañas.

import { useMemo } from "react";
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  HardHat,
  Siren,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { claveDia } from "@/data/reposSupabase";
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
  SeccionNovedadesNotasCentro,
} from "./DetalleCentro";
import { AlertasDelDiaCentro, type VistaFichaCentro } from "./AlertasDelDiaCentro";
import { ultimoSnapshotAntes } from "./ParteNumericoResumen";

interface Props {
  centro: CentroTransitorio;
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
      etiqueta: "Refugiados",
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
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.etiqueta}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-center"
          >
            <div className="flex items-baseline justify-center gap-1">
              <div
                className={cn(
                  "text-xl font-bold tabular-nums leading-none text-foreground",
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
      {(analisis.refugiados > 0 || analisis.personal > 0) && (
        <p className="text-center text-[10px] text-muted-foreground">
          {analisis.refugiados.toLocaleString("es")} refugiados
          {analisis.personal > 0 && (
            <> + {analisis.personal.toLocaleString("es")} personal</>
          )}
          {" · "}
          {analisis.personasLogistica.toLocaleString("es")} total logístico
        </p>
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

const ENLACES: {
  vista: VistaFichaCentro;
  label: string;
  icono: React.ReactNode;
}[] = [
  { vista: "coordinacion", label: "Coordinación", icono: <ClipboardList className="size-3.5" /> },
  { vista: "poblacion", label: "Población", icono: <Users className="size-3.5" /> },
  { vista: "reporte", label: "Reporte", icono: <UtensilsCrossed className="size-3.5" /> },
  { vista: "incidencias", label: "Incidencias", icono: <Siren className="size-3.5" /> },
  { vista: "capacidad", label: "Capacidad", icono: <HardHat className="size-3.5" /> },
];

/** Botones de acceso rápido al resto de pestañas. */
function EnlacesRapidos({
  onIrAPestana,
}: {
  onIrAPestana: (vista: VistaFichaCentro) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <BarChart3 className="size-3.5" />
        Accesos rápidos
      </p>
      <div className="flex flex-wrap gap-2">
        {ENLACES.map(({ vista, label, icono }) => (
          <Button
            key={vista}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onIrAPestana(vista)}
          >
            {icono}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Composición de la pestaña Resumen. */
export function ResumenCentroPanel({ centro, onIrAPestana }: Props) {
  return (
    <div className="space-y-4">
      <SeccionFotoCentro centro={centro} />
      <KpisResumen centro={centro} />
      <AlertasDelDiaCentro centro={centro} onIrAPestana={onIrAPestana} />
      <SeccionIdentificacionCentro centro={centro} />
      <ChipAlertaServicios centro={centro} onIrAPestana={onIrAPestana} />
      <SeccionNovedadesNotasCentro centro={centro} />
      <EnlacesRapidos onIrAPestana={onIrAPestana} />
    </div>
  );
}
