// Pestaña Población: gráfico + calendario plegable, tarjetas numéricas y
// espacio reservado para la lista nominal de refugiados.

import { useMemo, useState } from "react";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { useOcupacionesCentros } from "@/data/useOcupacionesCentros";
import { claveDia } from "@/data/reposSupabase";
import { Button } from "@/components/ui/button";
import { CalendarDays, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  SeccionPersonalCentro,
  SeccionPoblacionCentro,
  SeccionServiciosCentro,
} from "./DetalleCentro";
import {
  CalendarioSelectorDia,
  formatearDiaCalendario,
} from "./CalendarioSelectorDia";
import { GraficoPoblacionCentro } from "./GraficoPoblacionCentro";
import { ListaRefugiadosCentro } from "@/features/refugiados/ListaRefugiadosCentro";

const COLOR_REGISTRO = "#22c55e";

interface Props {
  centro: CentroTransitorio;
  puedeEditar?: boolean;
  onRegistrar?: () => void;
  onAbrirRefugiado?: (alojamientoId: string) => void;
}

export function PoblacionCentroPanel({
  centro,
  puedeEditar = false,
  onRegistrar,
  onAbrirRefugiado,
}: Props) {
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [diaSel, setDiaSel] = useState<string | null>(hoyClave);

  const desde = useMemo(() => {
    const [hy, hm, hd] = hoyClave.split("-").map(Number);
    const d = new Date(hy, hm - 1, hd);
    d.setDate(d.getDate() - 29);
    return claveDia(d.getTime());
  }, [hoyClave]);

  const snapshots = useOcupacionesCentros({ centroId: centro.id, desde });

  const marcasPorDia = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of snapshots) m.set(s.dia, COLOR_REGISTRO);
    return m;
  }, [snapshots]);

  const diaMarcado = diaSel ?? hoyClave;

  return (
    <div className="space-y-4">
      <div className="flex items-stretch gap-2">
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
            centroId={centro.id}
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

      <SeccionPoblacionCentro centro={centro} />
      <SeccionPersonalCentro centro={centro} />
      <SeccionServiciosCentro centro={centro} />

      <ListaRefugiadosCentro
        centro={centro}
        puedeEditar={puedeEditar}
        onRegistrar={onRegistrar ?? (() => {})}
        onAbrirRefugiado={onAbrirRefugiado ?? (() => {})}
      />
    </div>
  );
}
