import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Building2,
  Package,
  Pencil,
  X,
} from "lucide-react";
import { guardarCentro } from "@/data/reposSupabase";
import { useAreasInfraestructura } from "@/data/useAreasInfraestructura";
import { useRequerimientosSeguimiento } from "@/data/useRequerimientosSeguimiento";
import {
  normalizarCapacidad,
  normalizarCensoOficial,
  type CapacidadCentro,
  type CensoOficialCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { contarPorEstado } from "@/domain/infraestructura";
import { requerimientosPendientes } from "@/domain/requerimientosSeguimiento";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { SeccionCapacidadCentro } from "./DetalleCentro";
import { PieEdicionSeccion } from "./EdicionSeccionCentro";
import { FormularioCapacidadCentro } from "./FormularioCapacidadCentro";
import { FormularioCensoOficialCentro } from "./FormularioCensoOficialCentro";
import { InfraestructuraCentro } from "./InfraestructuraCentro";
import { SeguimientoRequerimientosCentro } from "./SeguimientoRequerimientosCentro";

type SubTabInfra = "capacidad" | "requerimientos" | "areas";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onIrAReporte?: (fase?: string) => void;
}

/** Pestaña unificada: capacidad operativa, seguimiento de requerimientos y áreas físicas. */
export function InfraestructuraCapacidadPanel({ centro, puedeEditar, onIrAReporte }: Props) {
  const analisis = analisisCentro(centro);
  const areas = useAreasInfraestructura({ centroId: centro.id });
  const conteosInfra = contarPorEstado(areas);
  const { requerimientos } = useRequerimientosSeguimiento({
    centroId: centro.id,
    soloActivos: true,
  });
  const pendientesReq = useMemo(
    () => requerimientosPendientes(requerimientos),
    [requerimientos],
  );

  const capacidadSerial = JSON.stringify(centro.capacidad ?? {});
  const censoSerial = JSON.stringify(centro.censo_oficial ?? {});
  const capacidadFuente = useMemo(
    () => normalizarCapacidad(centro.capacidad),
    [centro.id, centro.updated_at, capacidadSerial],
  );
  const censoFuente = useMemo(
    () => normalizarCensoOficial(centro.censo_oficial),
    [centro.id, centro.updated_at, censoSerial],
  );

  const [subTab, setSubTab] = useState<SubTabInfra>("capacidad");
  const [editandoCapacidad, setEditandoCapacidad] = useState(false);
  const [capacidad, setCapacidad] = useState<CapacidadCentro>(capacidadFuente);
  const [censoOficial, setCensoOficial] = useState<CensoOficialCentro>(censoFuente);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editandoCapacidad) {
      setCapacidad(capacidadFuente);
      setCensoOficial(censoFuente);
    }
  }, [capacidadFuente, censoFuente, editandoCapacidad]);

  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];
  const tieneCapacidadRegistrada =
    analisis.capacidadInstalada != null ||
    analisis.recursos.some((r) => r.medido) ||
    analisis.agua.medido;
  const areasAtencion = conteosInfra.requiere_mejora + conteosInfra.en_proceso;

  const resumenAreas = useMemo(() => {
    if (areas.length === 0) return "sin áreas";
    const partes: string[] = [];
    if (conteosInfra.requiere_mejora > 0) {
      partes.push(`${conteosInfra.requiere_mejora} pendientes`);
    }
    if (conteosInfra.en_proceso > 0) {
      partes.push(`${conteosInfra.en_proceso} en proceso`);
    }
    if (partes.length === 0 && conteosInfra.mejorado > 0) {
      partes.push(`${conteosInfra.mejorado} mejorada${conteosInfra.mejorado !== 1 ? "s" : ""}`);
    }
    return partes.length > 0 ? partes.join(" · ") : `${areas.length} registrada${areas.length !== 1 ? "s" : ""}`;
  }, [areas.length, conteosInfra]);

  function cancelarEdicion() {
    setCapacidad(capacidadFuente);
    setCensoOficial(censoFuente);
    setError(null);
    setEditandoCapacidad(false);
  }

  async function guardarCapacidad() {
    setError(null);
    setGuardando(true);
    try {
      await guardarCentro({
        ...centro,
        capacidad: normalizarCapacidad(capacidad),
        censo_oficial: normalizarCensoOficial(censoOficial),
      });
      setEditandoCapacidad(false);
    } catch (err) {
      console.error("[InfraestructuraCapacidadPanel] error guardando:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la capacidad del campamento.",
      );
    } finally {
      setGuardando(false);
    }
  }

  const tabTriggerClass = cn(
    "relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-none px-2 py-0",
    "!border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
    "text-xs font-medium text-muted-foreground",
    "transition-colors hover:text-foreground",
    "after:!hidden after:!content-none",
    "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
    "data-active:!bg-transparent data-active:!font-semibold data-active:!text-teal-300 data-active:!shadow-none",
    "dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
  );

  return (
    <div className="space-y-4">
      {/* Franja resumen compacta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-2.5 text-xs">
        <span className="text-muted-foreground">
          Cupo:{" "}
          {analisis.cupoDisponible != null ? (
            <span className="font-semibold tabular-nums" style={{ color: colorSemaforo }}>
              {analisis.cupoDisponible > 0 ? "+" : ""}
              {analisis.cupoDisponible.toLocaleString("es")}
            </span>
          ) : (
            <span className="text-muted-foreground/80">sin datos</span>
          )}
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="text-muted-foreground">
          Agua:{" "}
          <span className="font-medium text-foreground">
            {analisis.agua.medido
              ? analisis.agua.autonomiaDias != null
                ? `~${Math.floor(analisis.agua.autonomiaDias)} d`
                : "parcial"
              : "sin tanque"}
          </span>
        </span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="text-muted-foreground">
          Áreas:{" "}
          <span className="font-medium text-foreground">{resumenAreas}</span>
        </span>
      </div>

      <Tabs
        value={subTab}
        onValueChange={(v) => setSubTab(v as SubTabInfra)}
        className="gap-0"
      >
        <div className="border-b border-border">
          <TabsList
            variant="line"
            className="!grid h-10 w-full grid-cols-3 gap-0 overflow-hidden rounded-none bg-transparent p-0"
          >
            <TabsTrigger value="capacidad" className={tabTriggerClass}>
              <BedDouble className="size-3.5 shrink-0" />
              <span className="truncate">Capacidad</span>
            </TabsTrigger>
            <TabsTrigger value="requerimientos" className={tabTriggerClass}>
              <Package className="size-3.5 shrink-0" />
              <span className="truncate">Requerimientos</span>
              {pendientesReq.length > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 px-1 text-[9px] tabular-nums"
                >
                  {pendientesReq.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="areas" className={tabTriggerClass}>
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">Áreas</span>
              {areasAtencion > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 min-w-4 border-amber-500/30 bg-amber-500/10 px-1 text-[9px] tabular-nums text-amber-400"
                >
                  {areasAtencion}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="capacidad" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Aforo oficial (cupo) y recursos Esfera del campamento.
            </p>
            {puedeEditar &&
              (editandoCapacidad ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={guardando}
                  onClick={cancelarEdicion}
                >
                  <X className="size-3.5" />
                  Cancelar
                </Button>
              ) : (
                tieneCapacidadRegistrada && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setEditandoCapacidad(true)}
                  >
                    <Pencil className="size-3.5" />
                    Editar capacidad
                  </Button>
                )
              ))}
          </div>

          {editandoCapacidad ? (
            <div className="space-y-5">
              <FormularioCensoOficialCentro
                censo={censoOficial}
                onChange={setCensoOficial}
              />
              <div>
                <p className="mb-2 text-xs font-semibold text-foreground">
                  Estándar Esfera (diagnóstico)
                </p>
                <FormularioCapacidadCentro capacidad={capacidad} onChange={setCapacidad} />
              </div>
              <PieEdicionSeccion
                guardando={guardando}
                error={error}
                onCancelar={cancelarEdicion}
                onGuardar={() => void guardarCapacidad()}
              />
            </div>
          ) : !tieneCapacidadRegistrada ? (
            <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
              <BedDouble className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Sin capacidad registrada
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Registra la capacidad instalada (censo oficial) para calcular el cupo. Las camas
                y baños quedan como diagnóstico Esfera.
              </p>
              {puedeEditar && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setEditandoCapacidad(true)}
                >
                  <Pencil className="size-3.5" />
                  Registrar capacidad
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(analisis.capacidadInstalada != null ||
                analisis.capacidadMaxima != null ||
                censoFuente.ministerio_ente) && (
                <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                    {analisis.capacidadInstalada != null && (
                      <span>
                        Instalada:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {analisis.capacidadInstalada.toLocaleString("es")}
                        </span>
                      </span>
                    )}
                    {analisis.capacidadMaxima != null && (
                      <span>
                        Máxima:{" "}
                        <span className="font-semibold tabular-nums text-foreground">
                          {analisis.capacidadMaxima.toLocaleString("es")}
                        </span>
                      </span>
                    )}
                    {censoFuente.ministerio_ente.trim() && (
                      <span>
                        Ente:{" "}
                        <span className="font-medium text-foreground">
                          {censoFuente.ministerio_ente.trim()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              <SeccionCapacidadCentro centro={centro} integrado />
            </div>
          )}
        </TabsContent>

        <TabsContent value="requerimientos" className="mt-4">
          <SeguimientoRequerimientosCentro
            centroId={centro.id}
            puedeEditar={puedeEditar}
            onIrAReporte={onIrAReporte}
            integrado
          />
        </TabsContent>

        <TabsContent value="areas" className="mt-4">
          <p className="mb-4 text-xs text-muted-foreground">
            Espacios físicos con seguimiento antes/después y reparaciones vinculadas.
          </p>
          <InfraestructuraCentro
            centroId={centro.id}
            puedeEditar={puedeEditar}
            ocultarCabecera
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
