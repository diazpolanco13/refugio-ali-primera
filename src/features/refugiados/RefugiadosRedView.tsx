// Vista global de población nominal en la red (/centros/refugiados).

import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Baby, FilterX, Gift, HeartPulse, Search, ShieldAlert, Users } from "lucide-react";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  calcularEdad,
  detectarDuplicadosCedula,
  documentosPorTramitar,
  formatearCedula,
  grupoEtarioRefugiado,
  META_GRUPO_ETARIO_REFUGIADO,
  nombreCompleto,
  type AlojamientoEnriquecido,
  type GrupoEtarioRefugiado,
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

type FiltroGrupoEtario = GrupoEtarioRefugiado | "todos";
type FiltroVulnerabilidad =
  | "todos"
  | "embarazada"
  | "discapacidad"
  | "documento_pendiente"
  | "sin_documento"
  | "vulnerables";
type FiltroRolFamiliar = "todos" | "jefe" | "miembro" | "sin_hogar";
type FiltroDocumento = "todos" | "con_documento" | "sin_documento" | "cedula" | "pasaporte";

interface PerfilPoblacion {
  alojamiento: AlojamientoEnriquecido;
  nombre: string;
  edad: number | null;
  grupo: GrupoEtarioRefugiado;
  tieneDocumento: boolean;
  documentoPendiente: boolean;
  embarazada: boolean;
  discapacidad: boolean;
  vulnerable: boolean;
  esJefe: boolean;
  sinHogar: boolean;
  diasAlojado: number | null;
}

function diasDesde(fecha: string): number | null {
  if (!fecha) return null;
  const inicio = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return null;
  const hoy = new Date();
  const hoyLocal = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.max(0, Math.floor((hoyLocal.getTime() - inicio.getTime()) / 86_400_000));
}

function perfilDeAlojamiento(a: AlojamientoEnriquecido): PerfilPoblacion {
  const edad = calcularEdad(a.refugiado.fecha_nacimiento);
  const grupo = grupoEtarioRefugiado(a.refugiado.fecha_nacimiento);
  const documentosPendientes = documentosPorTramitar(a.refugiado.documentacion);
  const tieneDocumento = Boolean(a.refugiado.cedula_norm);
  const documentoPendiente =
    !tieneDocumento ||
    a.refugiado.estado_documento === "perdida" ||
    a.refugiado.estado_documento === "danada" ||
    documentosPendientes.length > 0;
  const embarazada = Boolean(a.refugiado.vulnerabilidades.embarazada);
  const discapacidad = Boolean(a.refugiado.vulnerabilidades.discapacidad);
  const vulnerable =
    embarazada || discapacidad || grupo === "menor5" || grupo === "adulto_mayor" || documentoPendiente;

  return {
    alojamiento: a,
    nombre: nombreCompleto(a.refugiado),
    edad,
    grupo,
    tieneDocumento,
    documentoPendiente,
    embarazada,
    discapacidad,
    vulnerable,
    esJefe: a.es_jefe_familia,
    sinHogar: !a.familia_id,
    diasAlojado: diasDesde(a.fecha_ingreso),
  };
}

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
  const [grupoEtario, setGrupoEtario] = useState<FiltroGrupoEtario>("todos");
  const [vulnerabilidad, setVulnerabilidad] = useState<FiltroVulnerabilidad>("todos");
  const [rolFamiliar, setRolFamiliar] = useState<FiltroRolFamiliar>("todos");
  const [documento, setDocumento] = useState<FiltroDocumento>("todos");
  const [soloItinerante, setSoloItinerante] = useState(false);
  const [soloDuplicados, setSoloDuplicados] = useState(false);

  const duplicados = useMemo(() => detectarDuplicadosCedula(alojamientos), [alojamientos]);
  const perfiles = useMemo(() => alojamientos.map(perfilDeAlojamiento), [alojamientos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const qDoc = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return perfiles.filter((p) => {
      const a = p.alojamiento;
      if (centroId !== "todos" && a.centro_id !== centroId) return false;
      if (soloItinerante && !a.itinerante) return false;
      const norm = a.refugiado.cedula_norm;
      if (soloDuplicados && (!norm || (duplicados.get(norm)?.length ?? 0) < 2)) return false;
      if (grupoEtario !== "todos" && p.grupo !== grupoEtario) return false;
      if (rolFamiliar === "jefe" && !p.esJefe) return false;
      if (rolFamiliar === "miembro" && (p.esJefe || p.sinHogar)) return false;
      if (rolFamiliar === "sin_hogar" && !p.sinHogar) return false;
      if (documento === "con_documento" && !p.tieneDocumento) return false;
      if (documento === "sin_documento" && p.tieneDocumento) return false;
      if (documento === "cedula" && !["V", "E"].includes(a.refugiado.tipo_doc ?? "")) return false;
      if (documento === "pasaporte" && a.refugiado.tipo_doc !== "P") return false;
      if (vulnerabilidad === "embarazada" && !p.embarazada) return false;
      if (vulnerabilidad === "discapacidad" && !p.discapacidad) return false;
      if (vulnerabilidad === "documento_pendiente" && !p.documentoPendiente) return false;
      if (vulnerabilidad === "sin_documento" && p.tieneDocumento) return false;
      if (vulnerabilidad === "vulnerables" && !p.vulnerable) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        (qDoc.length > 0 && (norm ?? "").toUpperCase().includes(qDoc)) ||
        (a.refugiado.codigo_ficha ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    perfiles,
    busqueda,
    centroId,
    soloItinerante,
    soloDuplicados,
    grupoEtario,
    rolFamiliar,
    documento,
    vulnerabilidad,
    duplicados,
  ]);

  const kpis = useMemo(
    () => ({
      total: visibles.length,
      adolescentes: visibles.filter((p) => p.grupo === "adolescente").length,
      embarazadas: visibles.filter((p) => p.embarazada).length,
      adultosMayores: visibles.filter((p) => p.grupo === "adulto_mayor").length,
      discapacidad: visibles.filter((p) => p.discapacidad).length,
      documentoPendiente: visibles.filter((p) => p.documentoPendiente).length,
    }),
    [visibles],
  );

  const hayFiltros =
    busqueda.trim() !== "" ||
    centroId !== "todos" ||
    grupoEtario !== "todos" ||
    vulnerabilidad !== "todos" ||
    rolFamiliar !== "todos" ||
    documento !== "todos" ||
    soloItinerante ||
    soloDuplicados;

  function limpiarFiltros() {
    setBusqueda("");
    setCentroId("todos");
    setGrupoEtario("todos");
    setVulnerabilidad("todos");
    setRolFamiliar("todos");
    setDocumento("todos");
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiPerfil titulo="Total visible" valor={kpis.total} icono={Users} />
            <KpiPerfil titulo="Adolescentes" valor={kpis.adolescentes} icono={ShieldAlert} />
            <KpiPerfil titulo="Embarazadas" valor={kpis.embarazadas} icono={HeartPulse} />
            <KpiPerfil titulo="Adultos mayores" valor={kpis.adultosMayores} icono={Users} />
            <KpiPerfil titulo="Discapacidad" valor={kpis.discapacidad} icono={HeartPulse} />
            <KpiPerfil titulo="Doc. pendiente" valor={kpis.documentoPendiente} icono={Baby} />
          </div>

          <Card>
            <CardContent className="grid gap-3 pt-4 lg:grid-cols-12">
              <div className="relative min-w-[12rem] flex-1">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Búsqueda</Label>
                <Search className="absolute bottom-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o documento…"
                  className="h-9 pl-9"
                />
              </div>
              <div className="w-full min-w-[10rem] sm:w-48 lg:col-span-2">
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
              <div className="lg:col-span-2">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Grupo etario</Label>
                <Select value={grupoEtario} onValueChange={(v) => setGrupoEtario(v as FiltroGrupoEtario)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="menor5">Menores &lt;5</SelectItem>
                    <SelectItem value="ninez">Niñez</SelectItem>
                    <SelectItem value="adolescente">Adolescentes</SelectItem>
                    <SelectItem value="adulto">Adultos</SelectItem>
                    <SelectItem value="adulto_mayor">Adultos mayores</SelectItem>
                    <SelectItem value="sin_fecha">Sin edad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Vulnerabilidad</Label>
                <Select value={vulnerabilidad} onValueChange={(v) => setVulnerabilidad(v as FiltroVulnerabilidad)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="vulnerables">Cualquier vulnerabilidad</SelectItem>
                    <SelectItem value="embarazada">Embarazadas</SelectItem>
                    <SelectItem value="discapacidad">Discapacidad</SelectItem>
                    <SelectItem value="documento_pendiente">Documento pendiente</SelectItem>
                    <SelectItem value="sin_documento">Sin documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Rol familiar</Label>
                <Select value={rolFamiliar} onValueChange={(v) => setRolFamiliar(v as FiltroRolFamiliar)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="jefe">Jefes de familia</SelectItem>
                    <SelectItem value="miembro">Miembros del hogar</SelectItem>
                    <SelectItem value="sin_hogar">Sin hogar asociado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="mb-1.5 block text-xs text-muted-foreground">Documento</Label>
                <Select value={documento} onValueChange={(v) => setDocumento(v as FiltroDocumento)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="con_documento">Con documento</SelectItem>
                    <SelectItem value="sin_documento">Sin documento</SelectItem>
                    <SelectItem value="cedula">Cédula V/E</SelectItem>
                    <SelectItem value="pasaporte">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-4 pb-0.5 lg:col-span-10">
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
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1 lg:col-span-2" onClick={limpiarFiltros}>
                  <FilterX className="size-3.5" />
                  Limpiar
                </Button>
              )}
            </CardContent>
          </Card>

          {duplicados.size > 0 && (
            <p className="text-xs text-amber-500">
              {duplicados.size} documento(s) con alojamiento activo en 2 o más campamentos
            </p>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Personas alojadas</CardTitle>
              <CardDescription>
                {visibles.length} perfil(es) visible(s)
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
                        <TableHead>Edad / perfil</TableHead>
                        <TableHead>Familia</TableHead>
                        <TableHead>Vulnerabilidad</TableHead>
                        <TableHead>Campamento</TableHead>
                        <TableHead>Ingreso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibles.length === 0 && !cargando ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                            Sin registros con los filtros actuales
                          </TableCell>
                        </TableRow>
                      ) : (
                        visibles.map((p) => {
                          const a = p.alojamiento;
                          const norm = a.refugiado.cedula_norm;
                          const centrosDup = norm ? duplicados.get(norm) : undefined;
                          const esDup = (centrosDup?.length ?? 0) >= 2;
                          const grupo = META_GRUPO_ETARIO_REFUGIADO[p.grupo];
                          return (
                            <TableRow
                              key={a.id}
                              className={cn("cursor-pointer hover:bg-muted/40", esDup && "bg-amber-500/5")}
                              onClick={() => navigate(`/centros/refugiados/${a.id}`)}
                            >
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium">{p.nombre}</p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {formatearCedula(a.refugiado.cedula, a.refugiado.tipo_doc)}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {a.itinerante && <BadgePerfil className="text-sky-400">Itinerante</BadgePerfil>}
                                    {esDup && centrosDup && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <BadgePerfil className="border-amber-500/50 text-amber-500">Duplicado</BadgePerfil>
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
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-sm">
                                    {p.edad == null ? "Sin edad" : `${p.edad} años`}
                                  </p>
                                  <BadgePerfil>{grupo.label}</BadgePerfil>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {p.esJefe ? (
                                    <BadgePerfil>Jefe de familia</BadgePerfil>
                                  ) : a.familia_id ? (
                                    <BadgePerfil>{a.parentesco_jefe || "Miembro"}</BadgePerfil>
                                  ) : (
                                    <BadgePerfil className="border-amber-500/50 text-amber-500">
                                      Sin hogar
                                    </BadgePerfil>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex max-w-[16rem] flex-wrap gap-1">
                                  {p.embarazada && <BadgePerfil className="text-pink-400">Embarazada</BadgePerfil>}
                                  {p.discapacidad && <BadgePerfil className="text-amber-400">Discapacidad</BadgePerfil>}
                                  {p.documentoPendiente && <BadgePerfil className="text-orange-400">Doc. pendiente</BadgePerfil>}
                                  {!p.vulnerable && <span className="text-xs text-muted-foreground">Sin alertas</span>}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[14rem]">
                                <div className="space-y-1">
                                  <p className="truncate">{nombresCentros.get(a.centro_id) ?? a.centro_id}</p>
                                  {a.plaza_modulo && (
                                    <p className="truncate text-xs text-muted-foreground">{a.plaza_modulo}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <div className="space-y-1">
                                  <p className="tabular-nums">{a.fecha_ingreso}</p>
                                  {p.diasAlojado != null && (
                                    <p className="text-xs">{p.diasAlojado} día(s)</p>
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

function KpiPerfil({
  titulo,
  valor,
  icono: Icono,
}: {
  titulo: string;
  valor: number;
  icono: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div>
          <p className="text-xs text-muted-foreground">{titulo}</p>
          <p className="text-2xl font-semibold tabular-nums">{valor}</p>
        </div>
        <Icono className="size-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function BadgePerfil({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Badge variant="outline" className={cn("text-[10px]", className)}>
      {children}
    </Badge>
  );
}
