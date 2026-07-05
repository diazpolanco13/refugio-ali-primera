// Vista global de población nominal en la red (/centros/refugiados).

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilterX, Gift, Search, Users } from "lucide-react";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  detectarDuplicadosCedula,
  formatearCedula,
  nombreCompleto,
} from "@/domain/refugiados";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { cn } from "@/lib/utils";

export function RefugiadosRedView() {
  const navigate = useNavigate();
  const { alojamientos, cargando } = useRefugiadosRed();

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const centros = useMemo(
    () => [...filasCentros].sort((a, b) => (a.nro ?? 0) - (b.nro ?? 0)),
    [filasCentros],
  );
  const nombresCentros = useMemo(
    () => new Map(centros.map((c) => [c.id, c.nombre || c.id])),
    [centros],
  );

  const [busqueda, setBusqueda] = useState("");
  const [centroId, setCentroId] = useState("todos");
  const [soloItinerante, setSoloItinerante] = useState(false);
  const [soloDuplicados, setSoloDuplicados] = useState(false);

  const duplicados = useMemo(() => detectarDuplicadosCedula(alojamientos), [alojamientos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return alojamientos.filter((a) => {
      if (centroId !== "todos" && a.centro_id !== centroId) return false;
      if (soloItinerante && !a.itinerante) return false;
      const norm = a.refugiado.cedula_norm;
      if (soloDuplicados && (!norm || (duplicados.get(norm)?.length ?? 0) < 2)) return false;
      if (!q) return true;
      const nom = nombreCompleto(a.refugiado).toLowerCase();
      return nom.includes(q) || (norm ?? "").includes(q.replace(/\D/g, ""));
    });
  }, [alojamientos, busqueda, centroId, soloItinerante, soloDuplicados, duplicados]);

  const hayFiltros =
    busqueda.trim() !== "" || centroId !== "todos" || soloItinerante || soloDuplicados;

  function limpiarFiltros() {
    setBusqueda("");
    setCentroId("todos");
    setSoloItinerante(false);
    setSoloDuplicados(false);
  }

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL} rellenarAltura marcoClassName="flex min-h-0 flex-col">
      <VistaEncabezado
        icono={Users}
        acento="violet"
        titulo="Población (red)"
        descripcion="Censo nominal activo en todos los campamentos visibles"
        acciones={
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate("/centros/dotaciones-pendientes")}>
            <Gift className="size-3.5" />
            Dotaciones pendientes
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-6">
          {/* Filtros en barra horizontal */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-4">
              <div className="relative min-w-[12rem] flex-1">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Búsqueda</Label>
                <Search className="absolute bottom-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o cédula…"
                  className="h-9 pl-9"
                />
              </div>
              <div className="w-full min-w-[10rem] sm:w-48">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Campamento</Label>
                <Select value={centroId} onValueChange={setCentroId}>
                  <SelectTrigger className="h-9">
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
              <div className="flex items-center gap-4 pb-0.5">
                <div className="flex items-center gap-2">
                  <Switch id="itinerante" checked={soloItinerante} onCheckedChange={setSoloItinerante} />
                  <Label htmlFor="itinerante" className="text-xs">
                    Itinerantes
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="duplicados" checked={soloDuplicados} onCheckedChange={setSoloDuplicados} />
                  <Label htmlFor="duplicados" className="text-xs">
                    Solo duplicados
                  </Label>
                </div>
              </div>
              {hayFiltros && (
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1" onClick={limpiarFiltros}>
                  <FilterX className="size-3.5" />
                  Limpiar
                </Button>
              )}
            </CardContent>
          </Card>

          {duplicados.size > 0 && (
            <p className="text-xs text-amber-500">
              {duplicados.size} cédula(s) con plaza activa en 2 o más campamentos
            </p>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Plazas activas</CardTitle>
              <CardDescription>
                {visibles.length} registro(s)
                {cargando && " · cargando…"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Persona</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Campamento</TableHead>
                        <TableHead>Ingreso</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibles.length === 0 && !cargando ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                            Sin registros con los filtros actuales
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibles.map((a) => {
                          const norm = a.refugiado.cedula_norm;
                          const centrosDup = norm ? duplicados.get(norm) : undefined;
                          const esDup = (centrosDup?.length ?? 0) >= 2;
                          return (
                            <TableRow
                              key={a.id}
                              className={cn("cursor-pointer hover:bg-muted/40", esDup && "bg-amber-500/5")}
                              onClick={() => navigate(`/centros/refugiados/${a.id}`)}
                            >
                              <TableCell className="font-medium">
                                {nombreCompleto(a.refugiado)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatearCedula(a.refugiado.cedula, a.refugiado.tipo_doc)}
                              </TableCell>
                              <TableCell className="max-w-[14rem] truncate">
                                {nombresCentros.get(a.centro_id) ?? a.centro_id}
                              </TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {a.fecha_ingreso}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {a.itinerante && (
                                    <Badge variant="outline" className="text-[10px] text-sky-400">
                                      Itinerante
                                    </Badge>
                                  )}
                                  {esDup && centrosDup && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="outline"
                                          className="border-amber-500/50 text-[10px] text-amber-500"
                                        >
                                          Duplicado
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Activo en:{" "}
                                        {centrosDup
                                          .map((id) => nombresCentros.get(id) ?? id)
                                          .join(", ")}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarcoVista>
  );
}
