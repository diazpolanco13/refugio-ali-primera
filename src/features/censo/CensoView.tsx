// Planilla pública de registro rápido de refugiados (sin login).
// Paso 1: refugio (con búsqueda) + identificación del funcionario.
// Paso 2: registro de personas según la planilla física (documento, teléfono,
//         embarazo/discapacidad/enfermedad condicionales y dirección perdida).
// Paso 3: estadística y lista de los registrados en el refugio.
// Los datos van a la tabla staging `censo_registros` vía RPCs públicas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardList,
  Loader2,
  LocateFixed,
  MapPin,
  Pencil,
  RefreshCw,
  Tent,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectoresGeo } from "@/components/SelectoresGeo";
import {
  CONDICIONES_VIVIENDA,
  PARENTESCOS_MENOR,
  actualizarCenso,
  eliminarCenso,
  listarCentrosCenso,
  listarRegistrosCenso,
  registrarCenso,
  registroDesdeGuardado,
  ubicacionCensadorVacia,
  type CentroCenso,
  type FuncionarioCenso,
  type RegistroCenso,
  type RegistroCensoGuardado,
  type UbicacionCensador,
} from "@/data/reposCenso";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "censo_funcionario_v1";

const TIPOS_DOC: { valor: RegistroCenso["tipo_doc"]; label: string }[] = [
  { valor: "V", label: "V-" },
  { valor: "E", label: "E-" },
  { valor: "P", label: "PP" },
];

const SEXOS: { valor: RegistroCenso["sexo"]; label: string }[] = [
  { valor: "M", label: "Masculino" },
  { valor: "F", label: "Femenino" },
];

function registroVacio(): RegistroCenso {
  return {
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    edad: null,
    tipo_doc: "V",
    documento: "",
    sexo: "",
    telefono: "",
    embarazada: false,
    embarazo_semanas: null,
    discapacidad: false,
    discapacidad_detalle: "",
    enfermedad: false,
    enfermedad_detalle: "",
    jefe_tipo_doc: "V",
    jefe_documento: "",
    parentesco_jefe: "",
    pais: "Venezuela",
    estado_federativo: "",
    municipio: "",
    parroquia: "",
    condicion_vivienda: "",
    calle: "",
    casa_edificio: "",
  };
}

interface SesionCenso {
  centroId: string;
  funcionario: FuncionarioCenso;
}

function cargarSesionGuardada(): SesionCenso | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SesionCenso;
    if (typeof s?.centroId !== "string" || typeof s?.funcionario?.nombre !== "string") return null;
    return s;
  } catch {
    return null;
  }
}

export function CensoView() {
  const guardada = useMemo(cargarSesionGuardada, []);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [centros, setCentros] = useState<CentroCenso[]>([]);
  const [cargandoCentros, setCargandoCentros] = useState(true);
  const [errorCentros, setErrorCentros] = useState("");

  const [centroId, setCentroId] = useState(guardada?.centroId ?? "");
  const [funcionario, setFuncionario] = useState<FuncionarioCenso>(
    guardada?.funcionario ?? { jerarquia: "", nombre: "", institucion: "", telefono: "" },
  );

  const [ubicacion, setUbicacion] = useState<UbicacionCensador>(ubicacionCensadorVacia);
  const [geoEstado, setGeoEstado] = useState<"idle" | "cargando" | "ok" | "error">("idle");
  const [geoError, setGeoError] = useState("");

  const [registro, setRegistro] = useState<RegistroCenso>(registroVacio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");
  const [registrados, setRegistrados] = useState(0);
  const [flashExito, setFlashExito] = useState(false);

  const refPrimerNombre = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    listarCentrosCenso()
      .then((lista) => {
        if (cancelado) return;
        setCentros(lista);
        setCargandoCentros(false);
      })
      .catch((err) => {
        if (cancelado) return;
        setErrorCentros(err instanceof Error ? err.message : "No se pudo cargar la lista de refugios");
        setCargandoCentros(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const centroNombre = centros.find((c) => c.id === centroId)?.nombre ?? "";

  const paso1Completo =
    Boolean(centroId) &&
    funcionario.jerarquia.trim() !== "" &&
    funcionario.nombre.trim() !== "" &&
    funcionario.institucion.trim() !== "" &&
    funcionario.telefono.trim() !== "";

  const esMenor = registro.edad != null && registro.edad < 18;

  const paso2Completo =
    registro.primer_nombre.trim() !== "" &&
    registro.primer_apellido.trim() !== "" &&
    registro.edad != null &&
    registro.sexo !== "" &&
    (!esMenor ||
      (registro.jefe_documento.trim() !== "" && registro.parentesco_jefe.trim() !== ""));

  function continuarAPaso2() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ centroId, funcionario }));
    setPaso(2);
  }

  function cambiarRegistro(parcial: Partial<RegistroCenso>) {
    setRegistro((r) => ({ ...r, ...parcial }));
  }

  function iniciarEdicion(fila: RegistroCensoGuardado) {
    setRegistro(registroDesdeGuardado(fila));
    setEditandoId(fila.id);
    setErrorGuardar("");
    setPaso(2);
  }

  function cancelarEdicion(destino: 2 | 3 = 2) {
    setEditandoId(null);
    setRegistro(registroVacio());
    setErrorGuardar("");
    if (destino === 3) setPaso(3);
  }

  function cambiarEnRefugio(v: boolean) {
    if (v) {
      setUbicacion((u) => ({ ...u, en_refugio: true }));
    } else {
      // Al responder No se descarta la captura previa.
      setUbicacion({ en_refugio: false, lat: null, lng: null, precision: null });
      setGeoEstado("idle");
      setGeoError("");
    }
  }

  function capturarUbicacion() {
    if (!("geolocation" in navigator)) {
      setGeoEstado("error");
      setGeoError("Este dispositivo no soporta geolocalización. Puede continuar sin ella.");
      return;
    }
    setGeoEstado("cargando");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUbicacion((u) => ({
          ...u,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precision: pos.coords.accuracy,
        }));
        setGeoEstado("ok");
      },
      (err) => {
        setGeoEstado("error");
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "El navegador no tiene permiso de ubicación. No es obligatorio: puede continuar sin geolocalizar."
            : "No se pudo obtener la ubicación. No es obligatorio: puede continuar sin ella.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function guardarRegistro(e: React.FormEvent) {
    e.preventDefault();
    if (!paso2Completo || guardando) return;
    setErrorGuardar("");
    setGuardando(true);
    try {
      // Los datos del jefe de familia solo aplican a menores de edad.
      const datos = esMenor
        ? registro
        : { ...registro, jefe_tipo_doc: "" as const, jefe_documento: "", parentesco_jefe: "" };
      if (editandoId) {
        await actualizarCenso(editandoId, datos);
        setEditandoId(null);
        setRegistro(registroVacio());
        setFlashExito(true);
        window.setTimeout(() => setFlashExito(false), 2500);
        setPaso(3);
      } else {
        await registrarCenso(centroId, funcionario, datos, ubicacion);
        setRegistrados((n) => n + 1);
        // Conserva la zona geográfica: familias de la misma zona se registran
        // seguidas y así se evita re-seleccionar la cascada.
        setRegistro((r) => ({
          ...registroVacio(),
          pais: r.pais,
          estado_federativo: r.estado_federativo,
          municipio: r.municipio,
          parroquia: r.parroquia,
        }));
        setFlashExito(true);
        window.setTimeout(() => setFlashExito(false), 2500);
        window.scrollTo({ top: 0, behavior: "smooth" });
        refPrimerNombre.current?.focus();
      }
    } catch (err) {
      setErrorGuardar(err instanceof Error ? err.message : "No se pudo guardar el registro");
    } finally {
      setGuardando(false);
    }
  }

  const fechaHoy = new Date().toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-[100dvh] bg-muted/40 pb-10">
      {/* Encabezado */}
      <header className="bg-primary px-4 pb-6 pt-5 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Tent className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-tight">
              Planilla de Registro de Refugiados
            </h1>
            <p className="text-xs opacity-80">Fecha: {fechaHoy}</p>
          </div>
        </div>
        {/* Indicador de paso */}
        <div className="mx-auto mt-4 flex w-full max-w-xl items-center gap-2 text-xs">
          <PasoChip
            activo={paso === 1}
            completado={paso > 1}
            numero={1}
            label="Funcionario"
            onClick={() => setPaso(1)}
          />
          <div className="h-px flex-1 bg-primary-foreground/30" />
          <PasoChip
            activo={paso === 2}
            completado={false}
            numero={2}
            label="Registro"
            onClick={paso1Completo ? () => setPaso(2) : undefined}
          />
          <div className="h-px flex-1 bg-primary-foreground/30" />
          <PasoChip
            activo={paso === 3}
            completado={false}
            numero={3}
            label="Registrados"
            onClick={centroId ? () => setPaso(3) : undefined}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-4">
        {paso === 1 && (
          <Card className="-mt-3 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="size-4 text-primary" />
                Datos del levantamiento
              </CardTitle>
              <CardDescription>
                Seleccione el refugio e identifique al funcionario que realiza el censo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (paso1Completo) continuarAPaso2();
                }}
              >
                <div className="space-y-1.5">
                  <Label>Nombre del refugio</Label>
                  <ComboboxCentro
                    centros={centros}
                    centroId={centroId}
                    onSelect={setCentroId}
                    cargando={cargandoCentros}
                  />
                  {errorCentros && <p className="text-xs text-destructive">{errorCentros}</p>}
                </div>

                <Separator />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Funcionario que realiza el censo
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="censo-jerarquia">Jerarquía / cargo</Label>
                  <Input
                    id="censo-jerarquia"
                    value={funcionario.jerarquia}
                    onChange={(e) => setFuncionario((f) => ({ ...f, jerarquia: e.target.value }))}
                    placeholder="Ej: Sargento Mayor, Coordinador…"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="censo-nombre-func">Nombre y apellido</Label>
                  <Input
                    id="censo-nombre-func"
                    value={funcionario.nombre}
                    onChange={(e) => setFuncionario((f) => ({ ...f, nombre: e.target.value }))}
                    placeholder="Nombre completo del funcionario"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="censo-institucion">Institución</Label>
                  <Input
                    id="censo-institucion"
                    value={funcionario.institucion}
                    onChange={(e) => setFuncionario((f) => ({ ...f, institucion: e.target.value }))}
                    placeholder="Ej: GNB, Protección Civil, Alcaldía…"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="censo-telefono">Teléfono (Telegram)</Label>
                  <Input
                    id="censo-telefono"
                    type="tel"
                    inputMode="tel"
                    value={funcionario.telefono}
                    onChange={(e) => setFuncionario((f) => ({ ...f, telefono: e.target.value }))}
                    placeholder="0412-0000000"
                    className="h-11"
                  />
                </div>

                <CampoSiNo
                  label="¿Está usted en el refugio?"
                  valor={ubicacion.en_refugio}
                  onChange={cambiarEnRefugio}
                >
                  <div className="space-y-2">
                    {geoEstado === "ok" && ubicacion.lat != null && ubicacion.lng != null ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-4 shrink-0" />
                          <span className="truncate font-mono">
                            {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
                            {ubicacion.precision != null && ` (±${Math.round(ubicacion.precision)} m)`}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 text-xs"
                          onClick={capturarUbicacion}
                        >
                          <RefreshCw className="size-3.5" />
                          Recapturar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full"
                        onClick={capturarUbicacion}
                        disabled={geoEstado === "cargando"}
                      >
                        {geoEstado === "cargando" ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Obteniendo ubicación…
                          </>
                        ) : (
                          <>
                            <LocateFixed className="size-4" />
                            Geolocalizar
                          </>
                        )}
                      </Button>
                    )}
                    {geoEstado === "error" && (
                      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        {geoError}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      La ubicación valida que el censo se hace desde el refugio. Es importante,
                      pero no obligatoria.
                    </p>
                  </div>
                </CampoSiNo>

                <Button type="submit" className="h-11 w-full" disabled={!paso1Completo}>
                  {geoEstado === "ok" ? "Confirmar y continuar al registro" : "Continuar al registro"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {paso === 2 && (
          <div className="-mt-3 space-y-4">
            {/* Resumen del paso 1 */}
            <Card className="shadow-lg">
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{centroNombre}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {funcionario.jerarquia} {funcionario.nombre} · {funcionario.institucion}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setPaso(1)}
                >
                  <ArrowLeft className="size-4" />
                  Cambiar
                </Button>
              </CardContent>
            </Card>

            {flashExito && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" />
                {editandoId
                  ? "Cambios guardados."
                  : "Registro guardado. Puede registrar a la siguiente persona."}
              </div>
            )}

            {editandoId && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-300">
                <span>Corrigiendo un registro existente</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => cancelarEdicion(3)}
                >
                  Cancelar
                </Button>
              </div>
            )}

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    {editandoId ? (
                      <Pencil className="size-4 text-primary" />
                    ) : (
                      <UserPlus className="size-4 text-primary" />
                    )}
                    {editandoId ? "Corregir registro" : "Datos del refugiado"}
                  </span>
                  {registrados > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaso(3)}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {registrados} registrado{registrados === 1 ? "" : "s"}
                    </button>
                  )}
                </CardTitle>
                <CardDescription>Complete los datos de una persona y guarde.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={guardarRegistro}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-pn">Primer nombre</Label>
                      <Input
                        id="censo-pn"
                        ref={refPrimerNombre}
                        value={registro.primer_nombre}
                        onChange={(e) => cambiarRegistro({ primer_nombre: e.target.value })}
                        className="h-11"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-sn" className="text-muted-foreground">
                        Segundo nombre
                      </Label>
                      <Input
                        id="censo-sn"
                        value={registro.segundo_nombre}
                        onChange={(e) => cambiarRegistro({ segundo_nombre: e.target.value })}
                        className="h-11"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-pa">Primer apellido</Label>
                      <Input
                        id="censo-pa"
                        value={registro.primer_apellido}
                        onChange={(e) => cambiarRegistro({ primer_apellido: e.target.value })}
                        className="h-11"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-sa" className="text-muted-foreground">
                        Segundo apellido
                      </Label>
                      <Input
                        id="censo-sa"
                        value={registro.segundo_apellido}
                        onChange={(e) => cambiarRegistro({ segundo_apellido: e.target.value })}
                        className="h-11"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Documento de identificación</Label>
                    <div className="flex gap-2">
                      <div className="flex overflow-hidden rounded-lg border">
                        {TIPOS_DOC.map((t, i) => (
                          <button
                            key={t.valor}
                            type="button"
                            className={cn(
                              "h-11 px-3 text-sm font-semibold transition-colors",
                              i > 0 && "border-l",
                              registro.tipo_doc === t.valor
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-muted",
                            )}
                            onClick={() => cambiarRegistro({ tipo_doc: t.valor })}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <Input
                        aria-label="Número de documento"
                        inputMode={registro.tipo_doc === "P" ? "text" : "numeric"}
                        value={registro.documento}
                        onChange={(e) => cambiarRegistro({ documento: e.target.value })}
                        placeholder={registro.tipo_doc === "P" ? "N.º de pasaporte" : "N.º de cédula"}
                        className="h-11 flex-1"
                        autoComplete="off"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Deje el número vacío si la persona no posee documento.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-edad">Edad</Label>
                      <Input
                        id="censo-edad"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        value={registro.edad != null ? String(registro.edad) : ""}
                        onChange={(e) =>
                          cambiarRegistro({
                            edad: e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sexo</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SEXOS.map((s) => (
                          <Button
                            key={s.valor}
                            type="button"
                            variant={registro.sexo === s.valor ? "default" : "outline"}
                            className="h-11 px-2 text-sm"
                            onClick={() =>
                              cambiarRegistro({
                                sexo: s.valor,
                                // Embarazo solo aplica a mujeres.
                                embarazada: s.valor === "F" ? registro.embarazada : false,
                                embarazo_semanas:
                                  s.valor === "F" ? registro.embarazo_semanas : null,
                              })
                            }
                          >
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {esMenor && (
                    <div className="space-y-3 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
                      <div>
                        <p className="text-sm font-medium">Menor de edad — jefe de familia</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Indique la cédula del jefe de familia y el parentesco. El menor quedará
                          asociado a esa persona.
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cédula del jefe de familia</Label>
                        <div className="flex gap-2">
                          <div className="flex overflow-hidden rounded-lg border">
                            {TIPOS_DOC.map((t, i) => (
                              <button
                                key={t.valor}
                                type="button"
                                className={cn(
                                  "h-11 px-3 text-sm font-semibold transition-colors",
                                  i > 0 && "border-l",
                                  registro.jefe_tipo_doc === t.valor
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background text-muted-foreground hover:bg-muted",
                                )}
                                onClick={() => cambiarRegistro({ jefe_tipo_doc: t.valor })}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <Input
                            aria-label="Cédula del jefe de familia"
                            inputMode={registro.jefe_tipo_doc === "P" ? "text" : "numeric"}
                            value={registro.jefe_documento}
                            onChange={(e) => cambiarRegistro({ jefe_documento: e.target.value })}
                            placeholder="N.º de cédula del jefe"
                            className="h-11 flex-1"
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Parentesco con el jefe de familia</Label>
                        <Select
                          value={registro.parentesco_jefe || undefined}
                          onValueChange={(v) => cambiarRegistro({ parentesco_jefe: v })}
                        >
                          <SelectTrigger className="h-11 w-full">
                            <SelectValue placeholder="Seleccionar parentesco…" />
                          </SelectTrigger>
                          <SelectContent>
                            {PARENTESCOS_MENOR.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="censo-tel-ref">Teléfono</Label>
                    <Input
                      id="censo-tel-ref"
                      type="tel"
                      inputMode="tel"
                      value={registro.telefono}
                      onChange={(e) => cambiarRegistro({ telefono: e.target.value })}
                      placeholder="Teléfono de contacto (opcional)"
                      className="h-11"
                      autoComplete="off"
                    />
                  </div>

                  {/* Vulnerabilidades: por defecto NO */}
                  {registro.sexo === "F" && (
                    <CampoSiNo
                      label="¿Embarazada?"
                      valor={registro.embarazada}
                      onChange={(v) =>
                        cambiarRegistro({
                          embarazada: v,
                          embarazo_semanas: v ? registro.embarazo_semanas : null,
                        })
                      }
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="censo-semanas" className="text-xs">
                          Semanas de embarazo
                        </Label>
                        <Input
                          id="censo-semanas"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={45}
                          value={
                            registro.embarazo_semanas != null
                              ? String(registro.embarazo_semanas)
                              : ""
                          }
                          onChange={(e) =>
                            cambiarRegistro({
                              embarazo_semanas:
                                e.target.value === ""
                                  ? null
                                  : Math.min(45, Math.max(1, Number(e.target.value))),
                            })
                          }
                          placeholder="Ej: 24"
                          className="h-11"
                        />
                      </div>
                    </CampoSiNo>
                  )}

                  <CampoSiNo
                    label="¿Discapacitado?"
                    valor={registro.discapacidad}
                    onChange={(v) =>
                      cambiarRegistro({
                        discapacidad: v,
                        discapacidad_detalle: v ? registro.discapacidad_detalle : "",
                      })
                    }
                  >
                    <Input
                      value={registro.discapacidad_detalle}
                      onChange={(e) => cambiarRegistro({ discapacidad_detalle: e.target.value })}
                      placeholder="Indique la discapacidad"
                      className="h-11"
                      autoComplete="off"
                    />
                  </CampoSiNo>

                  <CampoSiNo
                    label="¿Enfermedad condicionante?"
                    valor={registro.enfermedad}
                    onChange={(v) =>
                      cambiarRegistro({
                        enfermedad: v,
                        enfermedad_detalle: v ? registro.enfermedad_detalle : "",
                      })
                    }
                  >
                    <Input
                      value={registro.enfermedad_detalle}
                      onChange={(e) => cambiarRegistro({ enfermedad_detalle: e.target.value })}
                      placeholder="Indique cuál enfermedad"
                      className="h-11"
                      autoComplete="off"
                    />
                  </CampoSiNo>

                  <Separator />
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <MapPin className="size-3.5" />
                    Dirección de la vivienda perdida
                  </p>

                  <div className="space-y-1.5">
                    <Label>Condición de la vivienda</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {CONDICIONES_VIVIENDA.map((c) => (
                        <Button
                          key={c.valor}
                          type="button"
                          variant={registro.condicion_vivienda === c.valor ? "default" : "outline"}
                          className="h-11 px-2 text-sm"
                          onClick={() =>
                            cambiarRegistro({
                              condicion_vivienda:
                                registro.condicion_vivienda === c.valor ? "" : c.valor,
                            })
                          }
                        >
                          {c.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <SelectoresGeo
                    pais={registro.pais}
                    estado={registro.estado_federativo}
                    municipio={registro.municipio}
                    parroquia={registro.parroquia}
                    onPaisChange={(v) => cambiarRegistro({ pais: v })}
                    onEstadoChange={(v) => cambiarRegistro({ estado_federativo: v })}
                    onMunicipioChange={(v) => cambiarRegistro({ municipio: v })}
                    onParroquiaChange={(v) => cambiarRegistro({ parroquia: v })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-calle">Calle</Label>
                      <Input
                        id="censo-calle"
                        value={registro.calle}
                        onChange={(e) => cambiarRegistro({ calle: e.target.value })}
                        placeholder="Calle o avenida"
                        className="h-11"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="censo-casa">Casa / edificio</Label>
                      <Input
                        id="censo-casa"
                        value={registro.casa_edificio}
                        onChange={(e) => cambiarRegistro({ casa_edificio: e.target.value })}
                        placeholder="N.º de casa, edificio, piso…"
                        className="h-11"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {errorGuardar && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {errorGuardar}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="h-12 w-full text-base"
                    disabled={!paso2Completo || guardando}
                  >
                    {guardando ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Guardando…
                      </>
                    ) : editandoId ? (
                      <>
                        <Check className="size-4" />
                        Guardar cambios
                      </>
                    ) : (
                      <>
                        <UserPlus className="size-4" />
                        Guardar y registrar siguiente
                      </>
                    )}
                  </Button>

                  {!editandoId && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full"
                      onClick={() => setPaso(3)}
                    >
                      <BarChart3 className="size-4" />
                      Ver registrados del refugio
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {paso === 3 && (
          <PasoRegistrados
            centroId={centroId}
            centroNombre={centroNombre}
            onVolver={() => {
              cancelarEdicion();
              setPaso(2);
            }}
            onEditar={iniciarEdicion}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// Paso 1: combobox de refugio con búsqueda
// ============================================================================

function ComboboxCentro({
  centros,
  centroId,
  onSelect,
  cargando,
}: {
  centros: CentroCenso[];
  centroId: string;
  onSelect: (id: string) => void;
  cargando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const seleccionado = centros.find((c) => c.id === centroId);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          disabled={cargando}
          className="h-11 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !seleccionado && "text-muted-foreground")}>
            {cargando
              ? "Cargando refugios…"
              : (seleccionado?.nombre ?? "Buscar o seleccionar refugio…")}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar refugio por nombre…" />
          <CommandList className="max-h-64">
            <CommandEmpty>No se encontró ningún refugio.</CommandEmpty>
            <CommandGroup>
              {centros.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.nombre}
                  onSelect={() => {
                    onSelect(c.id);
                    setAbierto(false);
                  }}
                >
                  <Check
                    className={cn("size-4", centroId === c.id ? "opacity-100" : "opacity-0")}
                  />
                  {c.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Paso 2: campo Sí/No con contenido condicional
// ============================================================================

function CampoSiNo({
  label,
  valor,
  onChange,
  children,
}: {
  label: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  /** Campo adicional que se muestra cuando la respuesta es Sí. */
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm">{label}</Label>
        <div className="flex overflow-hidden rounded-lg border">
          <button
            type="button"
            className={cn(
              "h-9 px-4 text-sm font-semibold transition-colors",
              !valor
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            onClick={() => onChange(false)}
          >
            No
          </button>
          <button
            type="button"
            className={cn(
              "h-9 border-l px-4 text-sm font-semibold transition-colors",
              valor
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            onClick={() => onChange(true)}
          >
            Sí
          </button>
        </div>
      </div>
      {valor && children}
    </div>
  );
}

// ============================================================================
// Paso 3: estadística y lista de registrados del refugio
// ============================================================================

function PasoRegistrados({
  centroId,
  centroNombre,
  onVolver,
  onEditar,
}: {
  centroId: string;
  centroNombre: string;
  onVolver: () => void;
  onEditar: (fila: RegistroCensoGuardado) => void;
}) {
  const [filas, setFilas] = useState<RegistroCensoGuardado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [eliminarTarget, setEliminarTarget] = useState<RegistroCensoGuardado | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState("");

  const cargar = useCallback(() => {
    setCargando(true);
    setError("");
    listarRegistrosCenso(centroId)
      .then((lista) => {
        setFilas(lista);
        setCargando(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar el listado");
        setCargando(false);
      });
  }, [centroId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function confirmarEliminar() {
    if (!eliminarTarget) return;
    setEliminando(true);
    setErrorEliminar("");
    try {
      await eliminarCenso(eliminarTarget.id);
      setEliminarTarget(null);
      cargar();
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : "No se pudo eliminar el registro");
    } finally {
      setEliminando(false);
    }
  }

  const stats = useMemo(() => {
    const total = filas.length;
    const mujeres = filas.filter((f) => f.sexo === "F").length;
    const hombres = filas.filter((f) => f.sexo === "M").length;
    const embarazadas = filas.filter((f) => f.embarazada).length;
    const discapacidad = filas.filter((f) => f.discapacidad).length;
    const enfermedad = filas.filter((f) => f.enfermedad).length;
    const menores = filas.filter((f) => f.edad != null && f.edad < 18).length;
    const adultosMayores = filas.filter((f) => f.edad != null && f.edad >= 60).length;
    return { total, mujeres, hombres, embarazadas, discapacidad, enfermedad, menores, adultosMayores };
  }, [filas]);

  return (
    <div className="-mt-3 space-y-4">
      <Card className="shadow-lg">
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{centroNombre}</p>
            <p className="text-xs text-muted-foreground">Registrados en este refugio</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cargar} disabled={cargando}>
              <RefreshCw className={cn("size-4", cargando && "animate-spin")} />
              Actualizar
            </Button>
            <Button type="button" size="sm" onClick={onVolver}>
              <ArrowLeft className="size-4" />
              Registrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Estadística */}
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" />
            Estadística del censo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TarjetaStat valor={stats.total} label="Total" destacada />
            <TarjetaStat valor={stats.mujeres} label="Mujeres" />
            <TarjetaStat valor={stats.hombres} label="Hombres" />
            <TarjetaStat valor={stats.menores} label="Menores de 18" />
            <TarjetaStat valor={stats.adultosMayores} label="Adultos 60+" />
            <TarjetaStat valor={stats.embarazadas} label="Embarazadas" alerta={stats.embarazadas > 0} />
            <TarjetaStat valor={stats.discapacidad} label="Discapacidad" alerta={stats.discapacidad > 0} />
            <TarjetaStat valor={stats.enfermedad} label="Enf. condicionante" alerta={stats.enfermedad > 0} />
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Personas registradas
          </CardTitle>
          <CardDescription>
            {cargando
              ? "Cargando…"
              : `${filas.length} registro${filas.length === 1 ? "" : "s"} · toque el lápiz para corregir o la papelera para eliminar`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {cargando ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando registros…
            </div>
          ) : filas.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aún no hay personas registradas en este refugio.
            </p>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 w-8 px-2 text-center">#</TableHead>
                  <TableHead className="h-8 px-2">Nombre</TableHead>
                  <TableHead className="h-8 px-2">Documento</TableHead>
                  <TableHead className="h-8 px-2 text-center">Edad</TableHead>
                  <TableHead className="h-8 px-2 text-center">Sexo</TableHead>
                  <TableHead className="h-8 px-2">Parroquia</TableHead>
                  <TableHead className="h-8 px-2 text-center">Viv.</TableHead>
                  <TableHead className="h-8 px-2 text-right">Hora</TableHead>
                  <TableHead className="h-8 w-16 px-1 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f, i) => (
                  <FilaTabla
                    key={f.id}
                    fila={f}
                    numero={filas.length - i}
                    onEditar={() => onEditar(f)}
                    onEliminar={() => setEliminarTarget(f)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={eliminarTarget != null}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setEliminarTarget(null);
            setErrorEliminar("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {eliminarTarget
                ? `Se borrará permanentemente a ${[
                    eliminarTarget.primer_nombre,
                    eliminarTarget.primer_apellido,
                  ]
                    .filter(Boolean)
                    .join(" ")}. Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {errorEliminar && (
            <p className="text-sm text-destructive">{errorEliminar}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={eliminando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminar();
              }}
            >
              {eliminando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Eliminando…
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
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
        destacada && "border-primary/40 bg-primary/10",
        alerta && "border-amber-500/40 bg-amber-500/10",
      )}
    >
      <p className={cn("text-xl font-bold", destacada && "text-primary", alerta && "text-amber-600 dark:text-amber-400")}>
        {valor}
      </p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** Abreviatura de la condición de la vivienda para la tabla compacta. */
const ABREV_VIVIENDA: Record<string, string> = {
  destruida: "D",
  inhabitable: "I",
  no_posee: "NP",
};

function FilaTabla({
  fila,
  numero,
  onEditar,
  onEliminar,
}: {
  fila: RegistroCensoGuardado;
  numero: number;
  onEditar: () => void;
  onEliminar: () => void;
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
        {fila.parentesco_jefe && fila.jefe_documento && (
          <span
            className="block truncate text-[10px] text-muted-foreground"
            title={`${fila.parentesco_jefe} del jefe de familia ${fila.jefe_documento}${fila.jefe_registro_id ? " (asociado a su registro)" : " (jefe aún no registrado)"}`}
          >
            {fila.parentesco_jefe} de{" "}
            {fila.jefe_tipo_doc === "P" ? "PP " : `${fila.jefe_tipo_doc ?? "V"}-`}
            {fila.jefe_documento}
            {fila.jefe_registro_id ? " ✓" : ""}
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
      <TableCell className="max-w-28 truncate px-2 py-1.5" title={[fila.parroquia, fila.municipio].filter(Boolean).join(", ")}>
        {fila.parroquia || fila.municipio || "—"}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-center" title={vivienda?.label ?? ""}>
        {ABREV_VIVIENDA[fila.condicion_vivienda] ?? "—"}
      </TableCell>
      <TableCell className="px-2 py-1.5 text-right text-muted-foreground">{hora}</TableCell>
      <TableCell className="px-1 py-1.5">
        <div className="flex items-center justify-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            title="Corregir registro"
            onClick={onEditar}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            title="Eliminar registro"
            onClick={onEliminar}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// Encabezado: chip de paso
// ============================================================================

function PasoChip({
  activo,
  completado,
  numero,
  label,
  onClick,
}: {
  activo: boolean;
  completado: boolean;
  numero: number;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center gap-1.5",
        activo || completado ? "opacity-100" : "opacity-60",
        onClick && "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
          activo
            ? "bg-primary-foreground text-primary"
            : "border border-primary-foreground/50 text-primary-foreground",
        )}
      >
        {completado ? <CheckCircle2 className="size-3.5" /> : numero}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
