// Pestaña Población: gráfico plegable (carga bajo demanda), tarjetas numéricas
// editables vía diálogo, y lista nominal de damnificados.

import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
} from "lucide-react";
import { claveDia, guardarCentro } from "@/data/reposSupabase";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SeccionPoblacionCentro } from "./DetalleCentro";
import {
  CalendarioSelectorDia,
  formatearDiaCalendario,
} from "./CalendarioSelectorDia";
import {
  DialogoEdicionPoblacionCentro,
  type DatosPoblacionCentro,
} from "./DialogoEdicionPoblacionCentro";
import { GraficoPoblacionCentro } from "./GraficoPoblacionCentro";
import { ListaRefugiadosCentro } from "@/features/refugiados/ListaRefugiadosCentro";

const COLOR_REGISTRO = "#22c55e";

interface Props {
  centro: CentroTransitorio;
  puedeEditar?: boolean;
  onRegistrar?: () => void;
  onAbrirRefugiado?: (alojamientoId: string) => void;
}

/** Gráfico + calendario; solo se monta al expandir la sección (carga diferida). */
function GraficoPoblacionExpandido({ centroId }: { centroId: string }) {
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [diaSel, setDiaSel] = useState<string | null>(hoyClave);

  const desde = useMemo(() => {
    const [hy, hm, hd] = hoyClave.split("-").map(Number);
    const d = new Date(hy, hm - 1, hd);
    d.setDate(d.getDate() - 29);
    return claveDia(d.getTime());
  }, [hoyClave]);

  const snapshots = useOcupacionesCentros({ centroId, desde });

  const marcasPorDia = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of snapshots) m.set(s.dia, COLOR_REGISTRO);
    return m;
  }, [snapshots]);

  const diaMarcado = diaSel ?? hoyClave;

  return (
    <div className="flex items-stretch gap-2 pt-2">
      {calendarioAbierto && (
        <div className="w-[11.5rem] shrink-0 sm:w-[12.5rem]">
          <CalendarioSelectorDia
            titulo="Calendario"
            diaSeleccionado={diaSel}
            onSeleccionarDia={setDiaSel}
            marcasPorDia={marcasPorDia}
            leyenda={[{ color: COLOR_REGISTRO, label: "Parte registrado" }]}
            onCerrar={() => setCalendarioAbierto(false)}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <GraficoPoblacionCentro
          centroId={centroId}
          snapshots={snapshots}
          diaMarcado={diaMarcado}
          accionCalendario={
            <Button
              type="button"
              size="xs"
              variant={calendarioAbierto ? "secondary" : "outline"}
              className="h-6 gap-1 px-2 text-[10px]"
              onClick={() => setCalendarioAbierto((v) => !v)}
            >
              {calendarioAbierto ? (
                <PanelLeftClose className="size-3" />
              ) : (
                <PanelLeftOpen className="size-3" />
              )}
              <CalendarDays className="size-3" />
              {formatearDiaCalendario(diaMarcado)}
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function PoblacionCentroPanel({
  centro,
  puedeEditar = false,
  onRegistrar,
  onAbrirRefugiado,
}: Props) {
  const [graficoAbierto, setGraficoAbierto] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardarPoblacion(datos: DatosPoblacionCentro) {
    setError(null);
    setGuardando(true);
    try {
      await guardarCentro({
        ...centro,
        total_afectados: datos.total_afectados,
        familias_ocupadas: datos.familias_ocupadas,
        censo_en_proceso: datos.censo_en_proceso,
        ocupacion: datos.ocupacion,
      });
      setDialogoAbierto(false);
    } catch (err) {
      console.error("[PoblacionCentroPanel] error guardando:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la población del campamento.",
      );
    } finally {
      setGuardando(false);
    }
  }

  function cerrarDialogo() {
    if (guardando) return;
    setDialogoAbierto(false);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {puedeEditar && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={guardando}
            onClick={() => {
              setError(null);
              setDialogoAbierto(true);
            }}
          >
            {guardando && !dialogoAbierto ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pencil className="size-3.5" />
            )}
            Editar
          </Button>
        </div>
      )}

      <SeccionPoblacionCentro centro={centro}>
        <Collapsible
          open={graficoAbierto}
          onOpenChange={setGraficoAbierto}
          className="mt-2"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              Ver evolución de población
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {graficoAbierto && <GraficoPoblacionExpandido centroId={centro.id} />}
          </CollapsibleContent>
        </Collapsible>
      </SeccionPoblacionCentro>

      <ListaRefugiadosCentro
        centro={centro}
        puedeEditar={puedeEditar}
        onRegistrar={onRegistrar ?? (() => {})}
        onAbrirRefugiado={onAbrirRefugiado ?? (() => {})}
      />

      <DialogoEdicionPoblacionCentro
        abierto={dialogoAbierto}
        centro={centro}
        guardando={guardando}
        error={error}
        onCerrar={cerrarDialogo}
        onGuardar={(datos) => void guardarPoblacion(datos)}
      />
    </div>
  );
}
