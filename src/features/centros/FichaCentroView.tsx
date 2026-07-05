// Vista completa de un campamento (`/centro/:id`): segmentada por pestañas
// (Resumen, Coordinación, Población, Reporte, Incidencias, Capacidad).
// Vive dentro del AppShell global, con sidebar y TopBar compartidos.

import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClipboardCheck, LayoutGrid, Pencil, SearchX } from "lucide-react";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { Sesion } from "@/data/authSupabase";
import { puedeCrearCentros, puedeEditarCentro } from "@/domain/permisos";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BadgesEstadoCentro,
  SeccionCapacidadCentro,
  SeccionCoordinacionCentro,
  SeccionRequerimientosCentro,
  SeccionResponsablesCentro,
  SeccionSeguridadCentro,
} from "./DetalleCentro";
import { PoblacionCentroPanel } from "./PoblacionCentroPanel";
import { ResumenCentroPanel } from "./ResumenCentroPanel";
import { SeccionReporteDiarioCentro } from "./ReporteDiarioCentro";
import { SeccionIncidenciasCentro } from "./IncidenciasCentro";
import { CentroForm } from "./CentroForm";
import { ReporteDiarioForm } from "./ReporteDiarioForm";

interface Props {
  sesion: Sesion;
}

const SECCIONES = [
  { id: "resumen", label: "Resumen" },
  { id: "coordinacion", label: "Coordinación" },
  { id: "poblacion", label: "Población" },
  { id: "reporte", label: "Reporte" },
  { id: "incidencias", label: "Incidencias" },
  { id: "capacidad", label: "Capacidad" },
] as const;

type SeccionFicha = (typeof SECCIONES)[number]["id"];

function esSeccionFicha(v: string | null): v is SeccionFicha {
  return SECCIONES.some((s) => s.id === v);
}

/** Ficha completa de un campamento transitorio. */
export function FichaCentroView({ sesion }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editando, setEditando] = useState(false);
  const [reportando, setReportando] = useState(false);

  const seccionParam = searchParams.get("vista");
  const seccionActiva: SeccionFicha = esSeccionFicha(seccionParam) ? seccionParam : "resumen";

  function cambiarSeccion(vista: SeccionFicha) {
    setSearchParams(vista === "resumen" ? {} : { vista }, { replace: true });
  }

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

  const puedeEditar = centro != null && puedeEditarCentro(sesion.user, centro.id);

  if (!centro) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
        {filasCentros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargando campamento…</p>
        ) : (
          <>
            <SearchX className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">Campamento no encontrado</p>
            <p className="text-xs text-muted-foreground">
              El campamento solicitado no existe o fue eliminado de la red.
            </p>
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => navigate("/centros/mapa")}>
          Ir al mapa
        </Button>
      </div>
    );
  }

  const titulo = `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`;

  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      className="overflow-hidden"
      marcoClassName="flex h-full min-h-0 flex-col text-foreground"
    >
      <VistaEncabezado
        icono={LayoutGrid}
        acento="sky"
        titulo={titulo}
        descripcion={centro.parroquia || "Ficha del campamento en la red"}
        acciones={
          <>
            <div className="hidden shrink-0 sm:block">
              <BadgesEstadoCentro centro={centro} />
            </div>
            {puedeEditar && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2"
                onClick={() => setReportando(true)}
              >
                <ClipboardCheck className="size-3.5" />
                <span className="hidden sm:inline">Reporte</span>
              </Button>
            )}
            {puedeEditar && (
              <Button
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2"
                onClick={() => setEditando(true)}
              >
                <Pencil className="size-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
          </>
        }
        debajo={
          <div className="sm:hidden">
            <BadgesEstadoCentro centro={centro} />
          </div>
        }
      />

      <Tabs
        value={seccionActiva}
        onValueChange={(v) => cambiarSeccion(v as SeccionFicha)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Pestañas segmentadas — scroll horizontal en móvil */}
        <div className="h-[50px] shrink-0 border-b border-border bg-background/95 px-4 sm:px-6">
          <TabsList
            variant="line"
            className="!h-[50px] w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 align-middle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SECCIONES.map((s) => (
              <TabsTrigger
                key={s.id}
                value={s.id}
                className="shrink-0 rounded-none px-3 py-2.5 text-xs after:bottom-0 sm:text-sm"
              >
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
            <TabsContent value="resumen" className="mt-0">
              <ResumenCentroPanel
                centro={centro}
                onIrAPestana={(vista) => cambiarSeccion(vista)}
              />
            </TabsContent>

            <TabsContent value="coordinacion" className="mt-0 space-y-4">
              <SeccionCoordinacionCentro centro={centro} />
              <SeccionSeguridadCentro centro={centro} />
              <SeccionResponsablesCentro centro={centro} />
            </TabsContent>

            <TabsContent value="poblacion" className="mt-0">
              <PoblacionCentroPanel centro={centro} />
            </TabsContent>

            <TabsContent value="reporte" className="mt-0">
              <SeccionReporteDiarioCentro
                centro={centro}
                puedeEditar={puedeEditar}
                variant="expandido"
              />
            </TabsContent>

            <TabsContent value="incidencias" className="mt-0">
              <SeccionIncidenciasCentro
                centro={centro}
                puedeEditar={puedeEditar}
                variant="expandido"
              />
            </TabsContent>

            <TabsContent value="capacidad" className="mt-0 space-y-4">
              <SeccionCapacidadCentro centro={centro} />
              <SeccionRequerimientosCentro centro={centro} />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {editando && (
        <CentroForm
          centro={centro}
          soloLectura={!puedeEditar}
          puedeEliminar={puedeCrearCentros(sesion.user.rol)}
          onCerrar={() => setEditando(false)}
        />
      )}

      {reportando && (
        <ReporteDiarioForm centro={centro} onCerrar={() => setReportando(false)} />
      )}
    </MarcoVista>
  );
}
