// Vista global de población nominal en la red (/centros/refugiados).

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Baby,
  FilterX,
  Gift,
  HeartPulse,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
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
import { PaginadorTabla } from "@/components/ui/pagination";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  esUsernameOperadorTerreno,
  useEtiquetaPerfil,
} from "@/data/useEtiquetaPerfil";
import { cn } from "@/lib/utils";

/** Filas por página: censo puede superar 20k personas. */
const FILAS_POR_PAGINA = 50;

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

/** Columnas ordenables de la tabla de población. */
type ColumnaOrden =
  | "nombre"
  | "edad"
  | "familia"
  | "vulnerabilidad"
  | "campamento"
  | "ingreso"
  | "usuario";

type DireccionOrden = "asc" | "desc";

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
  registradoPor: string;
}

const COLUMNAS_TABLA = 8;

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
    registradoPor: (a.creada_por || a.updated_by || "").trim(),
  };
}

/** Fecha + hora del registro (creada_ts); fallback a fecha_ingreso. */
function partesIngreso(fechaIngreso: string, creadaTs: number): { fecha: string; hora: string | null } {
  if (creadaTs > 0) {
    const d = new Date(creadaTs);
    if (!Number.isNaN(d.getTime())) {
      return {
        fecha: d.toLocaleDateString("es-VE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        hora: d.toLocaleTimeString("es-VE", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      };
    }
  }
  return { fecha: fechaIngreso || "—", hora: null };
}

function etiquetaFamilia(p: PerfilPoblacion): string {
  if (p.esJefe) return "Jefe de familia";
  if (p.alojamiento.familia_id) return p.alojamiento.parentesco_jefe || "Miembro";
  return "Sin hogar";
}

function pesoVulnerabilidad(p: PerfilPoblacion): number {
  let n = 0;
  if (p.embarazada) n += 4;
  if (p.discapacidad) n += 3;
  if (p.documentoPendiente) n += 2;
  if (p.grupo === "menor5" || p.grupo === "adulto_mayor") n += 1;
  return n;
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, "es", { sensitivity: "base", numeric: true });
}

function compararPerfiles(
  a: PerfilPoblacion,
  b: PerfilPoblacion,
  columna: ColumnaOrden,
  nombresCentros: Map<string, string>,
): number {
  switch (columna) {
    case "nombre":
      return compararTexto(a.nombre, b.nombre);
    case "edad": {
      const ea = a.edad;
      const eb = b.edad;
      if (ea == null && eb == null) return 0;
      if (ea == null) return 1;
      if (eb == null) return -1;
      return ea - eb;
    }
    case "familia":
      return compararTexto(etiquetaFamilia(a), etiquetaFamilia(b));
    case "vulnerabilidad":
      return pesoVulnerabilidad(a) - pesoVulnerabilidad(b);
    case "campamento":
      return compararTexto(
        nombresCentros.get(a.alojamiento.centro_id) ?? a.alojamiento.centro_id,
        nombresCentros.get(b.alojamiento.centro_id) ?? b.alojamiento.centro_id,
      );
    case "ingreso": {
      const ta = a.alojamiento.creada_ts || 0;
      const tb = b.alojamiento.creada_ts || 0;
      if (ta !== tb) return ta - tb;
      return compararTexto(a.alojamiento.fecha_ingreso || "", b.alojamiento.fecha_ingreso || "");
    }
    case "usuario":
      return compararTexto(a.registradoPor || "—", b.registradoPor || "—");
  }
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
  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrden>("ingreso");
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>("desc");
  const [pagina, setPagina] = useState(0);

  const duplicados = useMemo(() => detectarDuplicadosCedula(alojamientos), [alojamientos]);
  const perfiles = useMemo(() => alojamientos.map(perfilDeAlojamiento), [alojamientos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const qDoc = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const filtrados = perfiles.filter((p) => {
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
        formatearCedula(a.refugiado.cedula, a.refugiado.tipo_doc).toLowerCase().includes(q) ||
        (a.refugiado.cedula ?? "").toLowerCase().includes(q) ||
        (a.refugiado.codigo_ficha ?? "").toLowerCase().includes(q)
      );
    });

    const factor = direccionOrden === "asc" ? 1 : -1;
    return [...filtrados].sort(
      (a, b) => factor * compararPerfiles(a, b, columnaOrden, nombresCentros),
    );
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
    columnaOrden,
    direccionOrden,
    nombresCentros,
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

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / FILAS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const paginaFilas = useMemo(() => {
    const inicio = paginaSegura * FILAS_POR_PAGINA;
    return visibles.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [visibles, paginaSegura]);

  useEffect(() => {
    setPagina(0);
  }, [
    busqueda,
    centroId,
    grupoEtario,
    vulnerabilidad,
    rolFamiliar,
    documento,
    soloItinerante,
    soloDuplicados,
    columnaOrden,
    direccionOrden,
  ]);

  useEffect(() => {
    if (pagina !== paginaSegura) setPagina(paginaSegura);
  }, [pagina, paginaSegura]);

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

  function alternarOrden(columna: ColumnaOrden) {
    if (columnaOrden === columna) {
      setDireccionOrden((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setColumnaOrden(columna);
    // Ingreso: primeras vistas = más recientes.
    setDireccionOrden(columna === "ingreso" ? "desc" : "asc");
  }

  return (
    <MarcoVista ancho={ANCHO_VISTA_PRINCIPAL} rellenarAltura marcoClassName="flex min-h-0 flex-col animate-in fade-in-0 duration-200">
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
              <div className="relative min-w-[12rem] lg:col-span-2">
                <Label htmlFor="busqueda-poblacion" className="mb-1.5 block text-xs text-muted-foreground">
                  Nombre / cédula
                </Label>
                <Search className="pointer-events-none absolute bottom-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  id="busqueda-poblacion"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre o cédula…"
                  className="h-9 pl-9"
                  autoComplete="off"
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
                {cargando && alojamientos.length === 0
                  ? "Cargando perfiles…"
                  : `${visibles.length.toLocaleString("es")} perfil(es) · ${FILAS_POR_PAGINA} por página (más recientes primero)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "nombre"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("nombre")}
                          >
                            Persona
                          </CabeceraOrdenable>
                        </TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "edad"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("edad")}
                          >
                            Edad / perfil
                          </CabeceraOrdenable>
                        </TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "familia"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("familia")}
                          >
                            Familia
                          </CabeceraOrdenable>
                        </TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "vulnerabilidad"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("vulnerabilidad")}
                          >
                            Vulnerabilidad
                          </CabeceraOrdenable>
                        </TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "campamento"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("campamento")}
                          >
                            Campamento
                          </CabeceraOrdenable>
                        </TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "ingreso"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("ingreso")}
                          >
                            Ingreso
                          </CabeceraOrdenable>
                        </TableHead>
                        <TableHead>
                          <CabeceraOrdenable
                            activa={columnaOrden === "usuario"}
                            direccion={direccionOrden}
                            onClick={() => alternarOrden("usuario")}
                          >
                            Registrado por
                          </CabeceraOrdenable>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cargando && alojamientos.length === 0 ? (
                        Array.from({ length: 8 }, (_, i) => (
                          <TableRow key={i} aria-hidden>
                            <TableCell>
                              <Skeleton className="mx-auto h-3 w-6" />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-2.5 w-24" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-24 rounded-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-20 rounded-full" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-3.5 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-3 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-3 w-16" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : visibles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={COLUMNAS_TABLA} className="py-10 text-center text-sm text-muted-foreground">
                            Sin registros con los filtros actuales
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginaFilas.map((p, indice) => {
                          const a = p.alojamiento;
                          const norm = a.refugiado.cedula_norm;
                          const centrosDup = norm ? duplicados.get(norm) : undefined;
                          const esDup = (centrosDup?.length ?? 0) >= 2;
                          const grupo = META_GRUPO_ETARIO_REFUGIADO[p.grupo];
                          const ingreso = partesIngreso(a.fecha_ingreso, a.creada_ts);
                          const numero = paginaSegura * FILAS_POR_PAGINA + indice + 1;
                          return (
                            <TableRow
                              key={a.id}
                              className={cn("cursor-pointer hover:bg-muted/40", esDup && "bg-amber-500/5")}
                              onClick={() => navigate(`/centros/refugiados/${a.id}`)}
                            >
                              <TableCell className="text-center tabular-nums text-muted-foreground">
                                {numero}
                              </TableCell>
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
                                <div className="space-y-0.5">
                                  <p className="tabular-nums text-sm text-foreground">{ingreso.fecha}</p>
                                  {ingreso.hora && (
                                    <p className="tabular-nums text-xs">{ingreso.hora}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[14rem]">
                                <CeldaRegistradoPor username={p.registradoPor} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <PaginadorTabla
                  pagina={paginaSegura}
                  totalPaginas={totalPaginas}
                  totalFilas={visibles.length}
                  filasPorPagina={FILAS_POR_PAGINA}
                  cargando={cargando}
                  onPagina={setPagina}
                  className="mt-3"
                />
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

/** Muestra jerarquía · nombre del censista + username automático de terreno. */
function CeldaRegistradoPor({ username }: { username: string }) {
  const quien = username.trim();
  const etiqueta = useEtiquetaPerfil(quien || null);
  if (!quien) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const esTerreno = esUsernameOperadorTerreno(quien);
  const muestraNombre = esTerreno && etiqueta && etiqueta !== quien;
  return (
    <div className="space-y-0.5" title={quien}>
      {muestraNombre ? (
        <>
          <p className="text-sm leading-snug">{etiqueta}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{quien}</p>
        </>
      ) : (
        <p className="truncate font-mono text-xs text-muted-foreground">{quien}</p>
      )}
    </div>
  );
}

/** Cabecera clicable con indicador de orden (patrón shadcn data-table). */
function CabeceraOrdenable({
  children,
  activa,
  direccion,
  onClick,
}: {
  children: ReactNode;
  activa: boolean;
  direccion: DireccionOrden;
  onClick: () => void;
}) {
  const Icono = !activa ? ArrowUpDown : direccion === "asc" ? ArrowUp : ArrowDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-8 gap-1.5 px-2 font-medium text-foreground hover:bg-muted"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
      <Icono className={cn("size-3.5", activa ? "text-foreground" : "text-muted-foreground")} />
    </Button>
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
