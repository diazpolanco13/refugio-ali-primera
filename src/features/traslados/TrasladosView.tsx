// Vista /centros/traslados — wizard + historial unificado (wizard + censo).

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, History, Search, Truck, UserRoundSearch, X } from "lucide-react";
import { useSesion } from "@/data/authSupabase";
import { useSupabaseQueryConEstado } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { buscarRefugiadoPorCedula } from "@/data/reposRefugiados";
import {
  listarTraslados,
  listarTrasladosPorRefugiado,
} from "@/data/reposTraslados";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  etiquetaFuenteTraslado,
  type TrasladoEnriquecido,
} from "@/domain/traslados";
import {
  formatearCedula,
  nombreCompleto,
  normalizarCedula,
  type TipoDoc,
} from "@/domain/refugiados";
import { puedeTrasladarEntreCentros, puedeVerTraslados } from "@/domain/permisos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
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

function FilaTraslado({
  t,
  nombresCentros,
}: {
  t: TrasladoEnriquecido;
  nombresCentros: Map<string, string>;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <TableRow className="align-top">
        <TableCell className="whitespace-nowrap text-sm">
          {formatearTs(t.creada_ts)}
        </TableCell>
        <TableCell className="text-sm">
          {nombresCentros.get(t.centro_origen) ?? t.centro_origen}
        </TableCell>
        <TableCell className="text-sm">
          {nombresCentros.get(t.centro_destino) ?? t.centro_destino}
        </TableCell>
        <TableCell className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
          >
            <Badge variant="secondary">
              {t.personas.length || t.miembros.length}
            </Badge>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                abierto && "rotate-180",
              )}
            />
          </Button>
        </TableCell>
        <TableCell className="max-w-[280px] text-sm whitespace-normal">
          {t.motivo || "—"}
        </TableCell>
        <TableCell>
          <Badge variant={t.fuente === "censo_nominal" ? "outline" : "default"}>
            {etiquetaFuenteTraslado(t.fuente)}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {t.creada_por || "—"}
        </TableCell>
      </TableRow>
      {abierto ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 py-2">
            {t.personas.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin detalle de personas en este lote.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {t.personas.map((p) => (
                  <li
                    key={`${t.id}-${p.refugiado_id}`}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                  >
                    <span className="font-medium">{p.nombre}</span>
                    <span className="text-muted-foreground">
                      {formatearCedula(p.cedula, p.tipo_doc as TipoDoc | null)}
                    </span>
                    {p.es_jefe_familia ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Jefe/a
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
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
  const [traslados, setTraslados] = useState<TrasladoEnriquecido[]>([]);
  const [cargandoHist, setCargandoHist] = useState(true);
  const [errorHist, setErrorHist] = useState<string | null>(null);

  const [tipoDocBusqueda, setTipoDocBusqueda] = useState<TipoDoc>("V");
  const [cedulaBusqueda, setCedulaBusqueda] = useState("");
  const [filtroPersona, setFiltroPersona] = useState<{
    id: string;
    etiqueta: string;
  } | null>(null);
  const [trasladosPersona, setTrasladosPersona] = useState<TrasladoEnriquecido[]>(
    [],
  );
  const [cargandoPersona, setCargandoPersona] = useState(false);
  const [errorPersona, setErrorPersona] = useState<string | null>(null);

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

  async function buscarHistorialPersona() {
    setErrorPersona(null);
    setCargandoPersona(true);
    try {
      const { cedula_norm } = normalizarCedula(cedulaBusqueda, tipoDocBusqueda);
      if (!cedula_norm) {
        setErrorPersona("Indique un número de documento válido.");
        setFiltroPersona(null);
        setTrasladosPersona([]);
        return;
      }
      const ref = await buscarRefugiadoPorCedula(cedula_norm);
      if (!ref) {
        setErrorPersona("No hay persona registrada con esa cédula.");
        setFiltroPersona(null);
        setTrasladosPersona([]);
        return;
      }
      const lista = await listarTrasladosPorRefugiado(ref.id);
      setFiltroPersona({
        id: ref.id,
        etiqueta: `${nombreCompleto(ref)} · ${formatearCedula(ref.cedula, ref.tipo_doc)}`,
      });
      setTrasladosPersona(lista);
    } catch (err) {
      setFiltroPersona(null);
      setTrasladosPersona([]);
      setErrorPersona(
        err instanceof Error ? err.message : "No se pudo buscar el historial",
      );
    } finally {
      setCargandoPersona(false);
    }
  }

  function limpiarFiltroPersona() {
    setFiltroPersona(null);
    setTrasladosPersona([]);
    setErrorPersona(null);
    setCedulaBusqueda("");
  }

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

  if (!puedeVerTraslados(usuario.rol)) {
    return (
      <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
        <Alert>
          <AlertTitle>Sin permiso</AlertTitle>
          <AlertDescription>
            Solo administradores, analistas, supervisores y autoridad pueden
            consultar traslados entre campamentos.
          </AlertDescription>
        </Alert>
      </MarcoVista>
    );
  }

  const puedeTrasladar = puedeTrasladarEntreCentros(usuario.rol);
  const listaMostrada = filtroPersona ? trasladosPersona : traslados;

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL}>
      <div className="space-y-6">
        <VistaEncabezado
          icono={Truck}
          acento="amber"
          titulo="Traslados entre campamentos"
          descripcion={
            puedeTrasladar
              ? "Busque por cédula o nombre, seleccione quién se traslada y registre el movimiento entre campamentos. El historial incluye traslados del wizard y del registro en terreno."
              : "Consulta del historial de movimientos entre campamentos (wizard y censo)."
          }
        />

        {puedeTrasladar && (
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
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRoundSearch className="size-4" />
              Historial de un refugiado
            </CardTitle>
            <CardDescription>
              Busque por cédula para ver todos los traslados registrados de esa
              persona (wizard o censo).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select
                  value={tipoDocBusqueda}
                  onValueChange={(v) => setTipoDocBusqueda(v as TipoDoc)}
                >
                  <SelectTrigger className="w-[72px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V">V</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="P">P</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px] flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Número de documento
                </Label>
                <Input
                  value={cedulaBusqueda}
                  onChange={(e) => setCedulaBusqueda(e.target.value)}
                  placeholder="Ej.: 12345678"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void buscarHistorialPersona();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                onClick={() => void buscarHistorialPersona()}
                disabled={cargandoPersona}
              >
                <Search className="size-4" />
                Buscar
              </Button>
              {filtroPersona ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={limpiarFiltroPersona}
                >
                  <X className="size-4" />
                  Quitar filtro
                </Button>
              ) : null}
            </div>
            {errorPersona ? (
              <Alert variant="destructive">
                <AlertDescription>{errorPersona}</AlertDescription>
              </Alert>
            ) : null}
            {filtroPersona ? (
              <p className="text-sm">
                Mostrando traslados de{" "}
                <span className="font-medium">{filtroPersona.etiqueta}</span>
                {cargandoPersona
                  ? "…"
                  : ` (${trasladosPersona.length} registro${
                      trasladosPersona.length === 1 ? "" : "s"
                    })`}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="size-4" />
                  Historial
                </CardTitle>
                <CardDescription>
                  {filtroPersona
                    ? "Traslados de la persona seleccionada."
                    : "Últimos traslados registrados en la red (wizard y censo; según su alcance)."}
                </CardDescription>
              </div>
              {!filtroPersona ? (
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
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {(filtroPersona ? cargandoPersona : cargandoHist) ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !filtroPersona && errorHist ? (
              <Alert variant="destructive">
                <AlertDescription>{errorHist}</AlertDescription>
              </Alert>
            ) : listaMostrada.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {filtroPersona
                  ? "Esta persona no tiene traslados registrados en la tabla unificada."
                  : "Aún no hay traslados registrados."}
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
                      <TableHead>Fuente</TableHead>
                      <TableHead>Registró</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaMostrada.map((t) => (
                      <FilaTraslado
                        key={t.id}
                        t={t}
                        nombresCentros={nombresCentros}
                      />
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