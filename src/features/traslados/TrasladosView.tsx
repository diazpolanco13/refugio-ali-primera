// Vista /centros/traslados — wizard + historial de movimientos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Truck } from "lucide-react";
import { useSesion } from "@/data/authSupabase";
import { useSupabaseQueryConEstado } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { listarTraslados } from "@/data/reposTraslados";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import type { Traslado } from "@/domain/traslados";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { TrasladoWizard } from "./TrasladoWizard";

type CentroFila = CentroTransitorio & { deleted: boolean };

function formatearTs(ts: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-VE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function TrasladosView() {
  const sesion = useSesion();
  const usuario = sesion?.user ?? null;

  const {
    datos: filasCentros,
    cargando: cargandoCentros,
    error: errorCentros,
  } = useSupabaseQueryConEstado<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
      order: { column: "id", ascending: true },
    },
  );
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const nombresCentros = useMemo(
    () => new Map(centros.map((c) => [c.id, c.nombre || c.id])),
    [centros],
  );

  const [filtroCentro, setFiltroCentro] = useState("todos");
  const [traslados, setTraslados] = useState<Traslado[]>([]);
  const [cargandoHist, setCargandoHist] = useState(true);
  const [errorHist, setErrorHist] = useState<string | null>(null);

  const refrescarHistorial = useCallback(async () => {
    setCargandoHist(true);
    setErrorHist(null);
    try {
      const lista = await listarTraslados({
        centroId: filtroCentro === "todos" ? undefined : filtroCentro,
        limite: 100,
      });
      setTraslados(lista);
    } catch (err) {
      setTraslados([]);
      setErrorHist(
        err instanceof Error ? err.message : "No se pudo cargar el historial",
      );
    } finally {
      setCargandoHist(false);
    }
  }, [filtroCentro]);

  useEffect(() => {
    void refrescarHistorial();
  }, [refrescarHistorial]);

  if (!usuario) {
    return (
      <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
        <Alert variant="destructive">
          <AlertTitle>Sin sesión</AlertTitle>
          <AlertDescription>Inicie sesión para ver traslados.</AlertDescription>
        </Alert>
      </MarcoVista>
    );
  }

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
      <div className="space-y-6">
        <VistaEncabezado
          icono={Truck}
          acento="amber"
          titulo="Traslados entre campamentos"
          descripcion="Registro formal de movimientos de familias (o personas solas) entre campamentos de la red."
        />

        <TrasladoWizard
          usuario={usuario}
          centros={centros}
          cargandoCentros={cargandoCentros}
          errorCentros={
            errorCentros
              ? "No se pudieron cargar los campamentos."
              : null
          }
          nombresCentros={nombresCentros}
          onExito={() => void refrescarHistorial()}
        />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4" />
                  Historial
                </CardTitle>
                <CardDescription>
                  Últimos traslados registrados en la red (según su alcance).
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Filtrar campamento
                  </Label>
                  <Select value={filtroCentro} onValueChange={setFiltroCentro}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {centros.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void refrescarHistorial()}
                  disabled={cargandoHist}
                >
                  Actualizar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cargandoHist ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : errorHist ? (
              <Alert variant="destructive">
                <AlertDescription>{errorHist}</AlertDescription>
              </Alert>
            ) : traslados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay traslados registrados.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Personas</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Registró</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traslados.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatearTs(t.creada_ts)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {nombresCentros.get(t.centro_origen) ?? t.centro_origen}
                        </TableCell>
                        <TableCell className="text-sm">
                          {nombresCentros.get(t.centro_destino) ??
                            t.centro_destino}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">
                            {t.miembros.length}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-sm">
                          {t.motivo || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.creada_por || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MarcoVista>
  );
}
