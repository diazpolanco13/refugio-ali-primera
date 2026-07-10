// Formulario móvil de capacidad (aforo + recursos Esfera) en /terreno.

import { useEffect, useState } from "react";
import { BedDouble, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { asegurarSesionTerreno } from "@/data/loginTerreno";
import { guardarCentro, obtenerCentroPorId } from "@/data/reposSupabase";
import {
  normalizarCapacidad,
  normalizarCensoOficial,
  normalizarCentro,
  type CapacidadCentro,
  type CensoOficialCentro,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { FormularioCapacidadCentro } from "@/features/centros/FormularioCapacidadCentro";
import { FormularioCensoOficialCentro } from "@/features/centros/FormularioCensoOficialCentro";
import { centroTieneCapacidadTerreno } from "@/lib/capacidadTerreno";
import { conActualizacionTerreno } from "@/lib/terrenoActualizacion";

interface Props {
  centroId: string;
  centroNombre: string;
  token: string;
  onGuardado?: (tieneCapacidad: boolean, actualizadoAt: number) => void;
}

export function CapacidadTerrenoPanel({
  centroId,
  centroNombre,
  token,
  onGuardado,
}: Props) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [centro, setCentro] = useState<CentroTransitorio | null>(null);
  const [capacidad, setCapacidad] = useState<CapacidadCentro>(normalizarCapacidad({}));
  const [censoOficial, setCensoOficial] = useState<CensoOficialCentro>(
    normalizarCensoOficial({}),
  );
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError("");
    setGuardadoOk(false);
    (async () => {
      try {
        if (token) await asegurarSesionTerreno(token, centroId);
        const fila = await obtenerCentroPorId(centroId);
        if (cancelado) return;
        if (!fila) {
          setError("No se pudo cargar el campamento. Verifique el enlace o su sesión.");
          return;
        }
        const norm = normalizarCentro(fila);
        setCentro(norm);
        setCapacidad(normalizarCapacidad(norm.capacidad));
        setCensoOficial(normalizarCensoOficial(norm.censo_oficial));
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo preparar la capacidad. Intente de nuevo.",
          );
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [centroId, token]);

  async function guardar() {
    if (!centro) return;
    setGuardando(true);
    setError("");
    setGuardadoOk(false);
    try {
      const ahora = Date.now();
      const siguiente: CentroTransitorio = {
        ...centro,
        capacidad: normalizarCapacidad(capacidad),
        censo_oficial: normalizarCensoOficial(censoOficial),
        terreno_actualizado: conActualizacionTerreno(centro.terreno_actualizado, "capacidad", ahora),
      };
      await guardarCentro(siguiente);
      setCentro(siguiente);
      const ok = centroTieneCapacidadTerreno(siguiente);
      setGuardadoOk(true);
      onGuardado?.(ok, ahora);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la capacidad. Intente de nuevo.",
      );
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 shadow-lg">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando capacidad…</p>
      </Card>
    );
  }

  if (error && !centro) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col shadow-lg">
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <BedDouble className="size-10 text-muted-foreground" />
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 space-y-1 border-b border-border pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BedDouble className="size-4 text-primary" />
          Capacidad
        </CardTitle>
        <p className="text-xs text-muted-foreground">{centroNombre}</p>
        <p className="text-xs text-muted-foreground">
          Aforo oficial (cupo) y recursos Esfera del campamento.
        </p>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-5 overflow-y-auto py-4">
        <FormularioCensoOficialCentro
          censo={censoOficial}
          onChange={setCensoOficial}
          deshabilitado={guardando}
        />
        <FormularioCapacidadCentro
          capacidad={capacidad}
          onChange={setCapacidad}
          deshabilitado={guardando}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {guardadoOk && !error && (
          <p className="text-xs font-medium text-emerald-500">
            Capacidad guardada. Puede seguir editando o volver al menú.
          </p>
        )}
      </CardContent>

      <CardFooter className="shrink-0 border-t border-border pt-4">
        <Button
          type="button"
          className="h-11 w-full gap-2"
          disabled={guardando}
          onClick={() => void guardar()}
        >
          {guardando ? <Loader2 className="size-4 animate-spin" /> : null}
          {guardando ? "Guardando…" : "Guardar capacidad"}
        </Button>
      </CardFooter>
    </Card>
  );
}
