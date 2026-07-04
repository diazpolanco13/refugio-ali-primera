// Vista completa de un centro (`/centro/:id`): la misma información del panel
// lateral (`DetalleCentro`) pero a pantalla completa, en varias columnas en
// escritorio y una sola en móvil. Se abre desde el tablero de centros (clic en
// tarjeta) y, en móvil, desde el botón "detalles" de la nube del mapa.

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Pencil, SearchX } from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { Sesion } from "@/data/authSupabase";
import { puedeCrearCentros, puedeEditarCentro } from "@/domain/permisos";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Button } from "@/components/ui/button";
import {
  BadgesEstadoCentro,
  SeccionCapacidadCentro,
  SeccionCoordinacionCentro,
  SeccionFotoCentro,
  SeccionHistoricoCentro,
  SeccionIdentificacionCentro,
  SeccionLogisticaCentro,
  SeccionNotasCentro,
  SeccionPersonalCentro,
  SeccionPoblacionCentro,
  SeccionRequerimientosCentro,
  SeccionResponsablesCentro,
  SeccionSeguridadCentro,
} from "./DetalleCentro";
import { SeccionReporteDiarioCentro } from "./ReporteDiarioCentro";
import { SeccionIncidenciasCentro } from "./IncidenciasCentro";
import { CentroForm } from "./CentroForm";
import { ReporteDiarioForm } from "./ReporteDiarioForm";

interface Props {
  sesion: Sesion;
}

/** ¿Estamos en escritorio (lg+)? Con listener para reaccionar a resize. */
function useEsEscritorio(): boolean {
  const [es, setEs] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setEs(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return es;
}

/** Ficha completa de un Centro Transitorio a pantalla completa. */
export function FichaCentroView({ sesion }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const esEscritorio = useEsEscritorio();
  const [editando, setEditando] = useState(false);
  const [reportando, setReportando] = useState(false);

  // Misma carga que CentrosView: tabla blob+jsonb `centros` con Realtime.
  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );

  const centro = useMemo(
    () => centros.find((c) => c.id === id) ?? null,
    [centros, id],
  );

  // Permiso por centro concreto: supervisor/operador solo editan los suyos
  // (la RLS ya oculta los demás; esto mantiene la UI coherente).
  const puedeEditar = centro != null && puedeEditarCentro(sesion.user, centro.id);

  /** Volver a la vista anterior; si se entró por deep-link, al mapa. */
  function volver() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  }

  if (!centro) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        {filasCentros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargando centro…</p>
        ) : (
          <>
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">Centro no encontrado</p>
            <p className="text-xs text-muted-foreground">
              El centro solicitado no existe o fue eliminado de la red.
            </p>
          </>
        )}
        <Button variant="outline" size="sm" onClick={volver}>
          <ArrowLeft className="size-4" />
          Volver
        </Button>
      </div>
    );
  }

  const titulo = `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Cabecera propia de la ficha */}
      <header className="z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-2 backdrop-blur-sm sm:px-3">
        <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5" onClick={volver}>
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Volver</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold leading-tight text-foreground">
            {titulo}
          </h1>
          {centro.parroquia && (
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              {centro.parroquia}
            </p>
          )}
        </div>
        <div className="hidden shrink-0 sm:block">
          <BadgesEstadoCentro centro={centro} />
        </div>
        {puedeEditar && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            onClick={() => setReportando(true)}
          >
            <ClipboardCheck className="size-4" />
            <span className="hidden sm:inline">Reporte del día</span>
          </Button>
        )}
        {puedeEditar && (
          <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => setEditando(true)}>
            <Pencil className="size-4" />
            <span className="hidden sm:inline">Registrar / editar estado</span>
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-7xl p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 lg:p-6">
          {/* Badges visibles en móvil (en escritorio van en la cabecera) */}
          <div className="mb-3 sm:hidden">
            <BadgesEstadoCentro centro={centro} />
          </div>

          {esEscritorio ? (
            /* Escritorio (lg+): tres columnas temáticas */
            <div className="grid grid-cols-3 items-start gap-4 xl:gap-6">
              {/* Columna 1 · identidad y contactos */}
              <div className="space-y-4">
                <SeccionFotoCentro centro={centro} />
                <SeccionIdentificacionCentro centro={centro} />
                <SeccionCoordinacionCentro centro={centro} />
                <SeccionSeguridadCentro centro={centro} />
                <SeccionResponsablesCentro centro={centro} />
              </div>
              {/* Columna 2 · personas y necesidades */}
              <div className="space-y-4">
                <SeccionReporteDiarioCentro centro={centro} puedeEditar={puedeEditar} />
                <SeccionPoblacionCentro centro={centro} />
                <SeccionPersonalCentro centro={centro} />
                <SeccionLogisticaCentro centro={centro} />
                <SeccionRequerimientosCentro centro={centro} />
                <SeccionNotasCentro centro={centro} />
              </div>
              {/* Columna 3 · incidencias, capacidad e histórico (gráfico abierto) */}
              <div className="space-y-4">
                <SeccionIncidenciasCentro centro={centro} puedeEditar={puedeEditar} />
                <SeccionCapacidadCentro centro={centro} />
                <SeccionHistoricoCentro centro={centro} colapsable={false} />
              </div>
            </div>
          ) : (
            /* Móvil: una sola columna con el orden del panel lateral */
            <div className="space-y-4">
              <SeccionFotoCentro centro={centro} />
              <SeccionIdentificacionCentro centro={centro} />
              <SeccionCoordinacionCentro centro={centro} />
              <SeccionSeguridadCentro centro={centro} />
              <SeccionPoblacionCentro centro={centro} />
              <SeccionPersonalCentro centro={centro} />
              <SeccionReporteDiarioCentro centro={centro} puedeEditar={puedeEditar} />
              <SeccionIncidenciasCentro centro={centro} puedeEditar={puedeEditar} />
              <SeccionHistoricoCentro centro={centro} colapsable={false} />
              <SeccionLogisticaCentro centro={centro} />
              <SeccionRequerimientosCentro centro={centro} />
              <SeccionCapacidadCentro centro={centro} />
              <SeccionResponsablesCentro centro={centro} />
              <SeccionNotasCentro centro={centro} />
            </div>
          )}
        </div>
      </div>

      {/* Mismo formulario de registro/edición del mapa/tablero */}
      {editando && (
        <CentroForm
          centro={centro}
          soloLectura={!puedeEditar}
          puedeEliminar={puedeCrearCentros(sesion.user.rol)}
          onCerrar={() => setEditando(false)}
        />
      )}

      {/* Reporte del día (parte numérico + comidas + atención médica) */}
      {reportando && (
        <ReporteDiarioForm centro={centro} onCerrar={() => setReportando(false)} />
      )}
    </div>
  );
}
