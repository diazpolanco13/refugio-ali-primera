// Listado general del censo nominal (toda la red). Realtime vía useRefugiadosRed.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Baby,
  FileSpreadsheet,
  FilterX,
  Heart,
  Loader2,
  Radio,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import {
  esUsernameOperadorTerreno,
  useEtiquetaPerfil,
} from "@/data/useEtiquetaPerfil";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import { useRefugiadosRed } from "@/data/useRefugiadosRed";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  puedeVerCensoRapidoRed,
  puedeVerPoblacionRed,
} from "@/domain/permisos";
import {
  calcularEdad,
  formatearCedula,
  grupoEtarioRefugiado,
  META_ESTADO_ALOJAMIENTO,
  nombreCompleto,
  type AlojamientoEnriquecido,
} from "@/domain/refugiados";
import { exportarCensoNominalExcel } from "@/features/censo/exportarCensoNominal";
import { CensoRedTabs } from "@/features/censo/CensoRedTabs";
import { CENSO_SELECT_TRIGGER } from "@/features/censo/censoFormularioShared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginadorTabla } from "@/components/ui/pagination";
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
import { VistaPagina } from "@/components/VistaPagina";
import { cn } from "@/lib/utils";

type FiltroSexo = "todos" | "M" | "F";
type FiltroPerfil =
  | "todos"
  | "embarazada"
  | "discapacidad"
  | "adulto_mayor"
  | "enfermedad";
type OrdenLista = "reciente" | "nombre" | "campamento" | "edad";

const FILAS_POR_PAGINA = 50;

function KpiPersona({
  valor,
  etiqueta,
  icono: Icono,
  clase,
}: {
  valor: number;
  etiqueta: string;
  icono: typeof Users;
  clase?: string;
}) {
  return (
    <Card size="sm" className="border-teal-500/15 py-2">
      <CardContent className="flex items-center gap-3 px-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-300",
            clase,
          )}
        >
          <Icono className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tabular-nums leading-none">
            {valor.toLocaleString("es")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SiNo({ valor }: { valor: boolean }) {
  if (!valor) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/40 text-[10px] text-amber-400"
    >
      Sí
    </Badge>
  );
}

function formatearFechaHora(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CeldaRegistradoPor({
  username,
  creadaTs,
}: {
  username: string;
  creadaTs: number;
}) {
  const quien = username.trim();
  const etiqueta = useEtiquetaPerfil(quien || null);
  const fechaHora = formatearFechaHora(creadaTs);
  if (!quien && fechaHora === "—") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const esTerreno = quien ? esUsernameOperadorTerreno(quien) : false;
  const muestraNombre = esTerreno && etiqueta && etiqueta !== quien;
  return (
    <div className="min-w-[9rem] max-w-[16rem] space-y-0.5">
      {quien ? (
        muestraNombre ? (
          <p className="text-sm leading-snug break-words">{etiqueta}</p>
        ) : (
          <p className="font-mono text-xs leading-snug break-words text-muted-foreground">
            {quien}
          </p>
        )
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      {fechaHora !== "—" ? (
        <p className="text-[10px] tabular-nums text-muted-foreground/80">
          {fechaHora}
        </p>
      ) : null}
    </div>
  );
}

export function CensoRedListadoView({ sesion }: { sesion: Sesion }) {
  const navigate = useNavigate();
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const veFichaRed = puedeVerPoblacionRed(sesion.user.rol);

  const { alojamientos, cargando } = useRefugiadosRed();
  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const nombresCentros = useMemo(
    () => new Map(filasCentros.map((c) => [c.id, c.nombre || c.id])),
    [filasCentros],
  );

  const [busqueda, setBusqueda] = useState("");
  const [centroId, setCentroId] = useState("todos");
  const [sexo, setSexo] = useState<FiltroSexo>("todos");
  const [perfil, setPerfil] = useState<FiltroPerfil>("todos");
  const [orden, setOrden] = useState<OrdenLista>("reciente");
  const [pagina, setPagina] = useState(0);
  const [exportando, setExportando] = useState(false);

  const campamentos = useMemo(() => {
    const ids = new Set(alojamientos.map((a) => a.centro_id));
    return [...ids]
      .map((id) => ({ id, nombre: nombresCentros.get(id) ?? id }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [alojamientos, nombresCentros]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    let lista = [...alojamientos];

    lista = lista.filter((a) => {
      if (centroId !== "todos" && a.centro_id !== centroId) return false;
      if (sexo !== "todos" && a.refugiado.sexo !== sexo) return false;
      if (perfil === "embarazada" && !a.refugiado.vulnerabilidades?.embarazada) {
        return false;
      }
      if (
        perfil === "discapacidad" &&
        !a.refugiado.vulnerabilidades?.discapacidad
      ) {
        return false;
      }
      if (
        perfil === "adulto_mayor" &&
        grupoEtarioRefugiado(a.refugiado.fecha_nacimiento) !== "adulto_mayor"
      ) {
        return false;
      }
      if (perfil === "enfermedad") {
        const s = a.refugiado.salud;
        const tiene =
          Boolean(s?.condiciones_cronicas?.trim()) ||
          Boolean(s?.lesiones?.trim()) ||
          Boolean(s?.medicamentos_urgente);
        if (!tiene) return false;
      }
      if (!q) return true;
      const nom = nombreCompleto(a.refugiado).toLowerCase();
      const ced = (
        a.refugiado.cedula_norm ??
        a.refugiado.cedula ??
        ""
      ).toLowerCase();
      const camp = (nombresCentros.get(a.centro_id) ?? "").toLowerCase();
      const tel = (a.refugiado.contacto?.telefono_principal ?? "").toLowerCase();
      if (nom.includes(q) || camp.includes(q) || tel.includes(q)) return true;
      if (qDigits && ced.replace(/\D/g, "").includes(qDigits)) return true;
      return ced.includes(q);
    });

    lista.sort((a, b) => {
      switch (orden) {
        case "nombre":
          return nombreCompleto(a.refugiado).localeCompare(
            nombreCompleto(b.refugiado),
            "es",
          );
        case "campamento":
          return (nombresCentros.get(a.centro_id) ?? "").localeCompare(
            nombresCentros.get(b.centro_id) ?? "",
            "es",
          );
        case "edad": {
          const ea = calcularEdad(a.refugiado.fecha_nacimiento) ?? -1;
          const eb = calcularEdad(b.refugiado.fecha_nacimiento) ?? -1;
          return eb - ea;
        }
        case "reciente":
        default:
          return (b.creada_ts || 0) - (a.creada_ts || 0);
      }
    });

    return lista;
  }, [alojamientos, busqueda, centroId, nombresCentros, orden, perfil, sexo]);

  useEffect(() => {
    setPagina(0);
  }, [busqueda, centroId, sexo, perfil, orden]);

  const kpis = useMemo(() => {
    let hombres = 0;
    let mujeres = 0;
    let menores = 0;
    let embarazadas = 0;
    let discapacidad = 0;
    let adultosMayores = 0;
    const centros = new Set<string>();
    for (const a of alojamientos) {
      centros.add(a.centro_id);
      if (a.refugiado.sexo === "M") hombres++;
      if (a.refugiado.sexo === "F") mujeres++;
      const g = grupoEtarioRefugiado(a.refugiado.fecha_nacimiento);
      if (g === "menor5" || g === "ninez" || g === "adolescente") menores++;
      if (g === "adulto_mayor") adultosMayores++;
      if (a.refugiado.vulnerabilidades?.embarazada) embarazadas++;
      if (a.refugiado.vulnerabilidades?.discapacidad) discapacidad++;
    }
    return {
      total: alojamientos.length,
      campamentos: centros.size,
      hombres,
      mujeres,
      menores,
      adultosMayores,
      especiales: embarazadas + discapacidad,
    };
  }, [alojamientos]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / FILAS_POR_PAGINA),
  );
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const paginaFilas = useMemo(() => {
    const inicio = paginaSegura * FILAS_POR_PAGINA;
    return filtrados.slice(inicio, inicio + FILAS_POR_PAGINA);
  }, [filtrados, paginaSegura]);

  const hayFiltros =
    busqueda.trim() !== "" ||
    centroId !== "todos" ||
    sexo !== "todos" ||
    perfil !== "todos" ||
    orden !== "reciente";

  async function exportar() {
    if (filtrados.length === 0 || exportando) return;
    setExportando(true);
    try {
      await exportarCensoNominalExcel(filtrados, "red", {
        nombresCentros,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo exportar");
    } finally {
      setExportando(false);
    }
  }

  function abrirFila(a: AlojamientoEnriquecido) {
    if (veFichaRed) {
      navigate(`/centros/refugiados/${a.id}`);
      return;
    }
    navigate(`/centros/censo/${a.centro_id}`);
  }

  return (
    <VistaPagina
      icono={Users}
      acento="teal"
      titulo="Censo (red)"
      descripcion="Listado general del censo nominal — damnificados activos en la red"
      cuerpoClassName="p-4 lg:p-6"
      acciones={
        tieneAcceso ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 border border-border shadow-sm"
              disabled={cargando || filtrados.length === 0 || exportando}
              onClick={() => void exportar()}
            >
              {exportando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              {exportando ? "Exportando…" : "Descargar Excel"}
            </Button>
            <Badge
              variant="outline"
              className="h-8 gap-1.5 border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[11px] text-emerald-700 dark:text-emerald-300"
            >
              <Radio className="size-3.5" />
              En vivo
            </Badge>
          </div>
        ) : undefined
      }
    >
      {!tieneAcceso ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Acceso restringido
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo el administrador, el analista SAE y la autoridad pueden
            consultar el censo de la red.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CensoRedTabs />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <KpiPersona valor={kpis.total} etiqueta="Total censados" icono={Users} />
            <KpiPersona
              valor={kpis.campamentos}
              etiqueta="Campamentos"
              icono={Users}
            />
            <KpiPersona valor={kpis.hombres} etiqueta="Hombres" icono={Users} />
            <KpiPersona valor={kpis.mujeres} etiqueta="Mujeres" icono={Users} />
            <KpiPersona
              valor={kpis.menores}
              etiqueta="Menores de 18"
              icono={Baby}
            />
            <KpiPersona
              valor={kpis.especiales}
              etiqueta="Emb. + discapacidad"
              icono={Heart}
              clase="bg-amber-500/10 text-amber-600 dark:text-amber-300"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar nombre, cédula, teléfono o campamento…"
                className="h-8 pl-8 text-sm"
              />
            </div>

            <Select value={centroId} onValueChange={setCentroId}>
              <SelectTrigger
                size="sm"
                className={cn(CENSO_SELECT_TRIGGER, "h-8 w-48 max-w-full")}
              >
                <SelectValue placeholder="Campamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los campamentos</SelectItem>
                {campamentos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sexo}
              onValueChange={(v) => setSexo(v as FiltroSexo)}
            >
              <SelectTrigger
                size="sm"
                className={cn(CENSO_SELECT_TRIGGER, "h-8 w-32")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo sexo</SelectItem>
                <SelectItem value="M">Hombres</SelectItem>
                <SelectItem value="F">Mujeres</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={perfil}
              onValueChange={(v) => setPerfil(v as FiltroPerfil)}
            >
              <SelectTrigger
                size="sm"
                className={cn(CENSO_SELECT_TRIGGER, "h-8 w-40")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo perfil</SelectItem>
                <SelectItem value="embarazada">Embarazadas</SelectItem>
                <SelectItem value="discapacidad">Discapacidad</SelectItem>
                <SelectItem value="adulto_mayor">Adultos 60+</SelectItem>
                <SelectItem value="enfermedad">Enfermedad</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={orden}
              onValueChange={(v) => setOrden(v as OrdenLista)}
            >
              <SelectTrigger
                size="sm"
                className={cn(CENSO_SELECT_TRIGGER, "h-8 w-40")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reciente">Más recientes</SelectItem>
                <SelectItem value="nombre">Nombre A → Z</SelectItem>
                <SelectItem value="campamento">Campamento</SelectItem>
                <SelectItem value="edad">Mayor edad</SelectItem>
              </SelectContent>
            </Select>

            {hayFiltros ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border border-border text-xs"
                onClick={() => {
                  setBusqueda("");
                  setCentroId("todos");
                  setSexo("todos");
                  setPerfil("todos");
                  setOrden("reciente");
                }}
              >
                <FilterX className="size-3.5" />
                Limpiar
              </Button>
            ) : null}

            <Badge variant="outline" className="ml-auto tabular-nums">
              {filtrados.length.toLocaleString("es")} persona
              {filtrados.length === 1 ? "" : "s"}
              {hayFiltros ? " (filtradas)" : ""}
            </Badge>
          </div>

          <Card className="border-teal-500/15">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Censo nominal</CardTitle>
              <CardDescription>
                {cargando && alojamientos.length === 0
                  ? "Cargando…"
                  : `${kpis.total.toLocaleString("es")} activo${kpis.total === 1 ? "" : "s"} · ${FILAS_POR_PAGINA} por página`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {cargando && alojamientos.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Cargando listado…
                </div>
              ) : filtrados.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {hayFiltros
                    ? "Ninguna persona coincide con los filtros seleccionados."
                    : "Aún no hay personas en el censo nominal."}
                </p>
              ) : (
                <>
                  <PaginadorTabla
                    pagina={paginaSegura}
                    totalPaginas={totalPaginas}
                    totalFilas={filtrados.length}
                    filasPorPagina={FILAS_POR_PAGINA}
                    cargando={cargando}
                    onPagina={setPagina}
                    className="border-t-0 pt-0"
                  />
                  <div className="max-h-[min(55vh,28rem)] overflow-auto rounded-md border">
                    <Table containerClassName="overflow-visible">
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead>Persona</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Edad</TableHead>
                          <TableHead>Sexo</TableHead>
                          <TableHead>Emb.</TableHead>
                          <TableHead>Disc.</TableHead>
                          <TableHead>Campamento</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Registrado por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginaFilas.map((a, i) => {
                          const edad = calcularEdad(a.refugiado.fecha_nacimiento);
                          const meta = META_ESTADO_ALOJAMIENTO[a.estado];
                          const numero =
                            paginaSegura * FILAS_POR_PAGINA + i + 1;
                          return (
                            <TableRow
                              key={a.id}
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() => abrirFila(a)}
                            >
                              <TableCell className="text-center tabular-nums text-muted-foreground">
                                {numero}
                              </TableCell>
                              <TableCell className="font-medium">
                                {nombreCompleto(a.refugiado)}
                                {a.es_jefe_familia ? (
                                  <Badge
                                    variant="outline"
                                    className="ml-1.5 text-[9px]"
                                  >
                                    Jefe
                                  </Badge>
                                ) : null}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {formatearCedula(
                                  a.refugiado.cedula ||
                                    a.refugiado.cedula_norm,
                                  a.refugiado.tipo_doc,
                                )}
                              </TableCell>
                              <TableCell className="tabular-nums text-sm">
                                {edad == null ? "—" : edad}
                              </TableCell>
                              <TableCell className="text-sm">
                                {a.refugiado.sexo ?? "—"}
                              </TableCell>
                              <TableCell>
                                <SiNo
                                  valor={Boolean(
                                    a.refugiado.vulnerabilidades?.embarazada,
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <SiNo
                                  valor={Boolean(
                                    a.refugiado.vulnerabilidades?.discapacidad,
                                  )}
                                />
                              </TableCell>
                              <TableCell className="max-w-[12rem] truncate text-sm">
                                {nombresCentros.get(a.centro_id) ?? a.centro_id}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {a.refugiado.contacto?.telefono_principal?.trim() ||
                                  "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  style={{
                                    borderColor: meta.color,
                                    color: meta.color,
                                  }}
                                >
                                  {meta.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <CeldaRegistradoPor
                                  username={
                                    (a.creada_por || a.updated_by || "").trim()
                                  }
                                  creadaTs={a.creada_ts}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginadorTabla
                    pagina={paginaSegura}
                    totalPaginas={totalPaginas}
                    totalFilas={filtrados.length}
                    filasPorPagina={FILAS_POR_PAGINA}
                    cargando={cargando}
                    onPagina={setPagina}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </VistaPagina>
  );
}
