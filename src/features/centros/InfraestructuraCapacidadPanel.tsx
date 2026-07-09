import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Building2,
  Pencil,
  X,
} from "lucide-react";
import { guardarCentro } from "@/data/reposSupabase";
import { useAreasInfraestructura } from "@/data/useAreasInfraestructura";
import {
  normalizarCapacidad,
  type CapacidadCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { analisisCentro, COLOR_SEMAFORO } from "@/domain/capacidadCentros";
import { contarPorEstado } from "@/domain/infraestructura";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SeccionCapacidadCentro } from "./DetalleCentro";
import { PieEdicionSeccion } from "./EdicionSeccionCentro";
import { FormularioCapacidadCentro } from "./FormularioCapacidadCentro";
import { InfraestructuraCentro } from "./InfraestructuraCentro";
import { SeguimientoRequerimientosCentro } from "./SeguimientoRequerimientosCentro";

interface Props {
  centro: CentroTransitorio;
  puedeEditar: boolean;
  onIrAReporte?: (fase?: string) => void;
}

function EncabezadoSeccion({
  titulo,
  icono,
  descripcion,
  accion,
}: {
  titulo: string;
  icono: React.ReactNode;
  descripcion?: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icono}
          {titulo}
        </h3>
        {descripcion && (
          <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {accion}
    </div>
  );
}

/** Pestaña unificada: capacidad operativa, seguimiento de requerimientos y áreas físicas. */
export function InfraestructuraCapacidadPanel({ centro, puedeEditar, onIrAReporte }: Props) {
  const analisis = analisisCentro(centro);
  const areas = useAreasInfraestructura({ centroId: centro.id });
  const conteosInfra = contarPorEstado(areas);

  // Referencia estable: normalizarCapacidad devuelve un objeto nuevo en cada llamada.
  const capacidadSerial = JSON.stringify(centro.capacidad ?? {});
  const capacidadFuente = useMemo(
    () => normalizarCapacidad(centro.capacidad),
    [centro.id, centro.updated_at, capacidadSerial],
  );

  const [editandoCapacidad, setEditandoCapacidad] = useState(false);
  const [capacidad, setCapacidad] = useState<CapacidadCentro>(capacidadFuente);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editandoCapacidad) {
      setCapacidad(capacidadFuente);
    }
  }, [capacidadFuente, editandoCapacidad]);

  const colorSemaforo = COLOR_SEMAFORO[analisis.semaforo];

  const resumenInfra = useMemo(() => {
    if (areas.length === 0) return "Sin áreas registradas";
    const partes: string[] = [];
    if (conteosInfra.requiere_mejora > 0) {
      partes.push(`${conteosInfra.requiere_mejora} requieren mejora`);
    }
    if (conteosInfra.en_proceso > 0) {
      partes.push(`${conteosInfra.en_proceso} en proceso`);
    }
    if (conteosInfra.mejorado > 0) {
      partes.push(`${conteosInfra.mejorado} mejorada${conteosInfra.mejorado !== 1 ? "s" : ""}`);
    }
    return partes.join(" · ");
  }, [areas.length, conteosInfra]);

  function cancelarEdicion() {
    setCapacidad(capacidadFuente);
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

  return (
    <div className="space-y-6">
      {/* KPIs de contexto */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm" className="border-border/80">
          <CardContent className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Cupo disponible
            </p>
            {analisis.cupoReal != null ? (
              <>
                <p
                  className="mt-1 text-2xl font-bold tabular-nums"
                  style={{ color: colorSemaforo }}
                >
                  {analisis.cupoReal.toLocaleString("es")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  personas más con seguridad
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Registra recursos para calcular el cupo
              </p>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="border-border/80">
          <CardContent className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Agua
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {analisis.agua.medido
                ? analisis.agua.autonomiaDias != null
                  ? `~${Math.floor(analisis.agua.autonomiaDias)} día${Math.floor(analisis.agua.autonomiaDias) === 1 ? "" : "s"} de autonomía`
                  : "Datos parciales"
                : "Sin datos de tanque"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {analisis.agua.recomendacion}
            </p>
          </CardContent>
        </Card>

        <Card size="sm" className="border-border/80">
          <CardContent className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Áreas físicas
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {areas.length}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{resumenInfra}</p>
          </CardContent>
        </Card>
      </div>

      {/* Capacidad operativa */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 px-4 py-3">
          <EncabezadoSeccion
            titulo="Capacidad operativa"
            icono={<BedDouble className="size-4 text-primary" />}
            descripcion="Recursos instalados vs. operativos del campamento."
            accion={
              puedeEditar ? (
                editandoCapacidad ? (
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
              ) : undefined
            }
          />
        </CardHeader>
        <CardContent className="space-y-5 px-4 py-4">
          {editandoCapacidad ? (
            <>
              <FormularioCapacidadCentro
                capacidad={capacidad}
                onChange={setCapacidad}
              />
              <PieEdicionSeccion
                guardando={guardando}
                error={error}
                onCancelar={cancelarEdicion}
                onGuardar={() => void guardarCapacidad()}
              />
            </>
          ) : (
            <SeccionCapacidadCentro centro={centro} integrado />
          )}
        </CardContent>
      </Card>

      <SeguimientoRequerimientosCentro
        centroId={centro.id}
        puedeEditar={puedeEditar}
        onIrAReporte={onIrAReporte}
      />

      {/* Infraestructura física */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 px-4 py-3">
          <EncabezadoSeccion
            titulo="Áreas de infraestructura"
            icono={<Building2 className="size-4 text-sky-400" />}
            descripcion="Espacios físicos del campamento con seguimiento antes/después y reparaciones vinculadas."
          />
        </CardHeader>
        <CardContent className="px-4 py-4">
          <InfraestructuraCentro
            centroId={centro.id}
            puedeEditar={puedeEditar}
          />
        </CardContent>
      </Card>
    </div>
  );
}
