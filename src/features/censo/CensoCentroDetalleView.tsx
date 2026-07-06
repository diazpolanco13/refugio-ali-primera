// Detalle interno: listado de personas registradas en un campamento (censo rápido en terreno).
// Acceso restringido a admin, analista SAE y autoridad.

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useCensoCentroRegistros } from "@/data/useCensoCentroRegistros";
import { useCensoRedResumen } from "@/data/useCensoRedResumen";
import {
  CONDICIONES_VIVIENDA,
  type RegistroCensoGuardado,
} from "@/data/reposCenso";
import { CEDULA_JEFE_NO_SE } from "@/domain/catalogosHumanitarios";
import { aVulnerables, estadoCensoCentro } from "@/domain/censoResumen";
import { puedeVerCensoRapidoRed } from "@/domain/permisos";
import { DemografiaResumen } from "@/features/tablero/DemografiaResumen";
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

function normalizarBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function filtrarRegistrosCenso(
  filas: RegistroCensoGuardado[],
  termino: string,
): RegistroCensoGuardado[] {
  const q = normalizarBusqueda(termino.trim());
  if (!q) return filas;
  return filas.filter((f) => {
    const nombreCompleto = [
      f.primer_nombre,
      f.segundo_nombre,
      f.primer_apellido,
      f.segundo_apellido,
    ]
      .filter(Boolean)
      .join(" ");
    const doc = [f.tipo_doc, f.documento].filter(Boolean).join("");
    const campos = [nombreCompleto, f.primer_nombre, f.primer_apellido, doc, f.telefono];
    return campos.some((c) => normalizarBusqueda(c).includes(q));
  });
}

const ABREV_VIVIENDA: Record<string, string> = {
  destruida: "D",
  inhabitable: "I",
  no_posee: "NP",
};

const META_ESTADO = {
  sin_iniciar: {
    label: "Sin iniciar",
    clase: "border-border bg-muted/40 text-muted-foreground",
  },
  en_curso: {
    label: "En curso",
    clase: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  completado_declarado: {
    label: "Completado declarado",
    clase: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
} as const;

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TarjetaStat({
  valor,
  label,
  destacada,
  alerta,
}: {
  valor: number;
  label: string;
  destacada?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 text-center",
        destacada && "border-teal-500/40 bg-teal-500/10",
        alerta && "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <p
        className={cn(
          "text-xl font-bold tabular-nums",
          destacada && "text-teal-700 dark:text-teal-300",
          alerta && "text-amber-600 dark:text-amber-400",
        )}
      >
        {valor.toLocaleString("es")}
      </p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function FilaTablaLectura({
  fila,
  numero,
}: {
  fila: RegistroCensoGuardado;
  numero: number;
}) {
  const nombre = [fila.primer_nombre, fila.segundo_nombre, fila.primer_apellido, fila.segundo_apellido]
    .filter(Boolean)
    .join(" ");
  const doc = fila.documento
    ? `${fila.tipo_doc === "P" ? "PP " : (fila.tipo_doc ?? "V") + "-"}${fila.documento}`
    : "—";
  const vivienda = CONDICIONES_VIVIENDA.find((c) => c.valor === fila.condicion_vivienda);
  const hora = new Date(fila.creado_en).toLocaleTimeString("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <TableRow>
      <TableCell className="px-2 py-1.5 text-center text-muted-foreground">{numero}</TableCell>
      <TableCell className="max-w-40 px-2 py-1.5">
        <span className="block truncate font-medium" title={nombre}>
          {nombre}
        </span>
        {fila.parentesco_jefe && (
          <span
            className="block truncate text-[10px] text-muted-foreground"
            title={
              fila.jefe_documento === CEDULA_JEFE_NO_SE
                ? `${fila.parentesco_jefe} — cédula del jefe no conocida`
                : `${fila.parentesco_jefe} del jefe de familia ${fila.jefe_documento}`
            }
          >
            {fila.parentesco_jefe}
            {fila.jefe_documento === CEDULA_JEFE_NO_SE ? (
              " · cédula no conocida"
            ) : fila.jefe_documento ? (
              <>
                {" de "}
                {fila.jefe_tipo_doc === "P" ? "PP " : `${fila.jefe_tipo_doc ?? "V"}-`}
                {fila.jefe_documento}
              </>
            ) : null}
          </span>
        )}
        {(fila.embarazada || fila.discapacidad || fila.enfermedad) && (
          <span className="mt-0.5 flex gap-1">
            {fila.embarazada && (
              <Badge
                variant="outline"
                className="h-4 border-pink-500/50 px-1 text-[9px] text-pink-600 dark:text-pink-400"
                title={`Embarazada${fila.embarazo_semanas != null ? ` (${fila.embarazo_semanas} semanas)` : ""}`}
              >
                EMB{fila.embarazo_semanas != null ? ` ${fila.embarazo_semanas}s` : ""}
              </Badge>
            )}
            {fila.discapacidad && (
              <Badge
                variant="outline"
                className="h-4 border-amber-500/50 px-1 text-[9px] text-amber-600 dark:text-amber-400"
                title={`Discapacidad${fila.discapacidad_detalle ? `: ${fila.discapacidad_detalle}` : ""}`}
              >
                DISC
              </Badge>
            )}
            {fila.enfermedad && (
              <Badge
                variant="outline"
                className="h-4 border-red-500/50 px-1 text-[9px] text-red-600 dark:text-red-400"
                title={`Enfermedad${fila.enfermedad_detalle ? `: ${fila.enfermedad_detalle}` : ""}`}
              >
                ENF
              </Badge>
            )}
          </span>
        )}
      </TableCell>
      <TableCell className="px-2 py-1.5 font-mono text-[11px]">{doc}</TableCell>
      <TableCell className="px-2 py-1.5 text-center">{fila.edad ?? "—"}</TableCell>
      <TableCell className="px-2 py-1.5 text-center">{fila.sexo ?? "—"}</TableCell>
      <TableCell className="max-w-28 truncate px-2 py-1.5" title={fila.telefono || undefined}>
        {fila.telefono || "—"}
      </TableCell>
      <TableCell
        className="max-w-28 truncate px-2 py-1.5"
        title={[fila.parroquia, fila.municipio].filter(Boolean).join(", ")}
      >
        {fila.parroquia || fila.municipio || "—"}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center" title={vivienda?.label ?? ""}>
        {ABREV_VIVIENDA[fila.condicion_vivienda] ?? "—"}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-right text-muted-foreground">{hora}</TableCell>
    </TableRow>
  );
}

export function CensoCentroDetalleView({ sesion }: { sesion: Sesion }) {
  const { centroId } = useParams<{ centroId: string }>();
  const navigate = useNavigate();
  const tieneAcceso = puedeVerCensoRapidoRed(sesion.user.rol);
  const { resumenes } = useCensoRedResumen();
  const { registros, cargando, error, refrescar } = useCensoCentroRegistros(centroId);
  const [busqueda, setBusqueda] = useState("");

  const resumen = useMemo(
    () => (centroId ? resumenes.find((r) => r.centroId === centroId) : undefined),
    [centroId, resumenes],
  );

  const centroNombre = resumen?.centroNombre ?? "Campamento";

  const filasFiltradas = useMemo(
    () => filtrarRegistrosCenso(registros, busqueda),
    [registros, busqueda],
  );

  const stats = useMemo(() => {
    const total = registros.length;
    const mujeres = registros.filter((f) => f.sexo === "F").length;
    const hombres = registros.filter((f) => f.sexo === "M").length;
    const embarazadas = registros.filter((f) => f.embarazada).length;
    const discapacidad = registros.filter((f) => f.discapacidad).length;
    const enfermedad = registros.filter((f) => f.enfermedad).length;
    const menores = registros.filter((f) => f.edad != null && f.edad < 18).length;
    const adultosMayores = registros.filter((f) => f.edad != null && f.edad >= 60).length;
    return { total, mujeres, hombres, embarazadas, discapacidad, enfermedad, menores, adultosMayores };
  }, [registros]);

  if (!centroId) {
    navigate("/centros/censo-rapido", { replace: true });
    return null;
  }

  const estado = resumen ? estadoCensoCentro(resumen) : registros.length > 0 ? "en_curso" : "sin_iniciar";
  const metaEstado = META_ESTADO[estado];

  return (
    <VistaPagina
      icono={ClipboardList}
      acento="teal"
      titulo={centroNombre}
      descripcion="Personas registradas en el censo rápido de este campamento"
      cuerpoClassName="p-4 lg:p-6"
      acciones={
        tieneAcceso ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/centros/censo-rapido">
                <ArrowLeft className="size-4" />
                Volver
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refrescar()} disabled={cargando}>
              <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        ) : undefined
      }
    >
      {!tieneAcceso ? (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-background/70 p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Acceso restringido</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo el administrador, el analista SAE y la autoridad pueden consultar el censo de la
            red.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", metaEstado.clase)}>
              {metaEstado.label}
            </Badge>
            {resumen && (
              <>
                <span className="text-xs text-muted-foreground">
                  Último registro: {formatearFecha(resumen.ultimoRegistroEn)}
                </span>
                {resumen.cierreEn && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    Cierre: {formatearFecha(resumen.cierreEn)}
                    {resumen.cierreFuncionario ? ` · ${resumen.cierreFuncionario}` : ""}
                  </span>
                )}
              </>
            )}
          </div>

          {resumen?.cierreEn && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Censo completado declarado</p>
                <p className="text-xs opacity-90">
                  {formatearFecha(resumen.cierreEn)}
                  {resumen.cierreTotal != null
                    ? ` · ${resumen.cierreTotal.toLocaleString("es")} persona${resumen.cierreTotal === 1 ? "" : "s"} al cierre`
                    : ""}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {resumen && (
            <Card className="border-teal-500/15">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Demografía registrada</CardTitle>
              </CardHeader>
              <CardContent>
                <DemografiaResumen vulnerables={aVulnerables(resumen)} compacto />
              </CardContent>
            </Card>
          )}

          <Card className="border-teal-500/15">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-teal-600 dark:text-teal-300" />
                Estadística del censo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Calculando…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <TarjetaStat valor={stats.total} label="Total" destacada />
                  <TarjetaStat valor={stats.mujeres} label="Mujeres" />
                  <TarjetaStat valor={stats.hombres} label="Hombres" />
                  <TarjetaStat valor={stats.menores} label="Menores de 18" />
                  <TarjetaStat valor={stats.adultosMayores} label="Adultos 60+" />
                  <TarjetaStat
                    valor={stats.embarazadas}
                    label="Embarazadas"
                    alerta={stats.embarazadas > 0}
                  />
                  <TarjetaStat
                    valor={stats.discapacidad}
                    label="Discapacidad"
                    alerta={stats.discapacidad > 0}
                  />
                  <TarjetaStat
                    valor={stats.enfermedad}
                    label="Enf. condicionante"
                    alerta={stats.enfermedad > 0}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-teal-500/15">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-teal-600 dark:text-teal-300" />
                Personas registradas
              </CardTitle>
              <CardDescription>
                {cargando
                  ? "Cargando…"
                  : `${registros.length} registro${registros.length === 1 ? "" : "s"} · busque por nombre, cédula o teléfono`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              {!cargando && registros.length > 0 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre, apellido, cédula o teléfono…"
                    className="h-10 pl-9"
                    autoComplete="off"
                  />
                </div>
              )}

              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando registros…
                </div>
              ) : registros.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aún no hay personas registradas en este campamento.
                </p>
              ) : filasFiltradas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ninguna persona coincide con «{busqueda.trim()}». Verifique la cédula o el nombre e
                  intente de nuevo.
                </p>
              ) : (
                <div className="-mx-4 overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 w-8 px-2 text-center">#</TableHead>
                        <TableHead className="h-8 px-2">Nombre</TableHead>
                        <TableHead className="h-8 px-2">Documento</TableHead>
                        <TableHead className="h-8 px-2 text-center">Edad</TableHead>
                        <TableHead className="h-8 px-2 text-center">Sexo</TableHead>
                        <TableHead className="h-8 px-2">Teléfono</TableHead>
                        <TableHead className="h-8 px-2">Parroquia</TableHead>
                        <TableHead className="h-8 px-2 text-center">Viv.</TableHead>
                        <TableHead className="h-8 px-2 text-right">Hora</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filasFiltradas.map((f, i) => (
                        <FilaTablaLectura
                          key={f.id}
                          fila={f}
                          numero={filasFiltradas.length - i}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </VistaPagina>
  );
}
