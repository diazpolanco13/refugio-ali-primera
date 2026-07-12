// Censo por cédula vía Nexus: verificar → crear hogar → agregar familiares.
// Destino: base nominal (refugiados + familias_centro + alojamientos).

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Baby,
  Building2,
  Check,
  Home,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Trash2,
  UserPlus,
  Users,
  AlertTriangle,
  Camera,
  ImagePlus,
  RotateCcw,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { buscarPersonaNexusConCache, esNexusNoDisponible } from "@/data/reposNexus";
import {
  estadoNominalPorCedula,
  miembrosHogarActual,
  registrarMiembroSinDocumento,
  registrarPersonaNexusEnNominal,
  type EstadoNominalCedula,
} from "@/data/reposCensoNexus";
import {
  buscarCensoRegistroPorDocumento,
  listarCentrosCenso,
  obtenerCentroTerreno,
  type AnalistaContactoTerreno,
  type RegistroCensoViejoResumen,
} from "@/data/reposCenso";
import { CEDULA_JEFE_NO_SE } from "@/domain/catalogosHumanitarios";
import {
  actualizarConsentimientoFoto,
  actualizarDamnificacionFamilia,
  guardarFamiliaresReferencia,
  guardarResidenciaAfectada,
  registrarEgreso,
  type OtroCentroActivo,
} from "@/data/reposRefugiados";
import { nuevoId } from "@/data/reposSupabase";
import { subirFotoRefugiado, supabaseDisponible } from "@/data/supabase";
import { asegurarSesionTerreno } from "@/data/loginTerreno";
import { type FamiliarNexus, type PersonaNexusCenso } from "@/domain/nexusPersona";
import {
  META_NIVEL_AFECTACION,
  nivelAfectacionHogar,
} from "@/domain/nivelAfectacionHogar";
import {
  PARENTESCOS_JEFE,
  calcularEdad,
  formatearCedula,
  type EstatusVivienda,
  type FamiliarSeparado,
  type SexoRefugiado,
} from "@/domain/refugiados";
import {
  EstadoNexusApi,
  type NexusEnLinea,
  type SenalConsultaNexus,
} from "@/features/censo/EstadoNexusApi";
import {
  MigaPasosCenso,
  type PasoCenso,
  type PasoCensoId,
} from "@/features/censo/MigaPasosCenso";
import { IconoTelegram } from "@/components/IconoTelegram";
import { telegramHref, tieneTelefonoContacto } from "@/lib/contacto";
import { copiarTexto } from "@/lib/portapapeles";
import { cn } from "@/lib/utils";

/** Máximo de líderes de familia activos por hogar (ver supabase/familia_lideres.sql
 * y MAX_LIDERES_FAMILIA en src/data/reposRefugiados.ts). */
const MAX_LIDERES_FAMILIA = 2;

const SEVERIDAD_VIVIENDA_OPCIONES: { valor: EstatusVivienda; label: string; emoji: string }[] = [
  { valor: "destruida", label: "Colapsada / destruida", emoji: "🔴" },
  { valor: "inabitable", label: "Inhabitable / insegura", emoji: "🟠" },
  { valor: "habitable_con_riesgo", label: "Daños menores", emoji: "🟡" },
  { valor: "sin_dano", label: "Sin daño", emoji: "🟢" },
];

const UBICACIONES_VIVIENDA = ["Caracas", "Miranda", "Vargas (La Guaira)"] as const;

function nuevaPerdidaVacia(): FamiliarSeparado {
  return { id: nuevoId(), nombre: "", parentesco: "Otro familiar", estado: "fallecido" };
}

function StepperInline({
  value,
  onChange,
  min = 0,
  max,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  const enMin = value <= min;
  const enMax = max != null && value >= max;

  return (
    <div
      className={cn(
        "inline-flex h-9 w-[7.5rem] shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        disabled={enMin}
        aria-label="Restar"
        className={cn(
          "flex w-9 shrink-0 items-center justify-center bg-muted/70 text-foreground transition-colors",
          "hover:bg-muted active:bg-muted/90",
          "disabled:pointer-events-none disabled:opacity-35",
        )}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-3.5 stroke-[2.5]" />
      </button>
      <div className="flex min-w-0 flex-1 items-center justify-center border-x border-border bg-card">
        <span className="text-sm font-bold tabular-nums leading-none">{value}</span>
      </div>
      <button
        type="button"
        disabled={enMax}
        aria-label="Sumar"
        className={cn(
          "flex w-9 shrink-0 items-center justify-center bg-primary text-primary-foreground transition-colors",
          "hover:bg-primary/90 active:bg-primary/80",
          "disabled:pointer-events-none disabled:opacity-35",
        )}
        onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
      >
        <Plus className="size-3.5 stroke-[2.5]" />
      </button>
    </div>
  );
}

function FilaContador({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5">
      <Label className="min-w-0 flex-1 text-xs leading-snug font-medium">{label}</Label>
      <StepperInline value={value} onChange={onChange} min={min} />
    </div>
  );
}

type Letra = "V" | "E";

function BuscadorCedula({
  letra,
  onLetra,
  cedula,
  onCedula,
  buscando,
  onSubmit,
  labelCedula = "Número de cédula",
  placeholder = "Ej. 17089732",
}: {
  letra: Letra;
  onLetra: (l: Letra) => void;
  cedula: string;
  onCedula: (v: string) => void;
  buscando: boolean;
  onSubmit: (e: FormEvent) => void;
  labelCedula?: string;
  placeholder?: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{labelCedula}</Label>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-background shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
        <div
          className="flex shrink-0 border-r border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="Tipo de documento"
        >
          {(["V", "E"] as const).map((op) => {
            const activo = letra === op;
            return (
              <button
                key={op}
                type="button"
                aria-pressed={activo}
                className={cn(
                  "h-10 min-w-10 rounded-lg px-2.5 text-sm font-bold tabular-nums transition-colors",
                  activo
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => onLetra(op)}
              >
                {op}-
              </button>
            );
          })}
        </div>
        <Input
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={placeholder}
          value={cedula}
          onChange={(e) => onCedula(soloDigitos(e.target.value))}
          aria-label={labelCedula}
          className={cn(
            "h-11 flex-1 rounded-none border-0 bg-transparent px-3 font-mono text-base tracking-wider shadow-none",
            "focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
          )}
        />
      </div>
      <Button
        type="submit"
        disabled={buscando || cedula.length < 5}
        className="h-10 w-full gap-2 font-semibold"
      >
        {buscando ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Search className="size-4" />
        )}
        Buscar
      </Button>
    </form>
  );
}

interface Props {
  centroId: string;
  centroNombre: string;
  tokenTerreno?: string | null;
  /** Permite volver a elegir campamento (solo sin token de terreno). */
  onCambiarCentro?: () => void;
  /** Propaga el estado de Nexus al shell (/censo) para mostrar u ocultar la planilla manual. */
  onEstadoNexus?: (enLinea: NexusEnLinea) => void;
  /** Incrementar desde la cabecera de /censo para reiniciar el flujo (otra persona). */
  reinicioKey?: number;
  /** Precarga y dispara la búsqueda de una cédula (ej. botón "Verificar" desde
   * la lista "Registrados" del censo manual viejo). Cambiar `key` la dispara. */
  cedulaPrecarga?: { letra: Letra; cedula: string; key: number } | null;
  /** Abre directo un hogar ya existente (ej. botón "Agregar líder" desde
   * "Censados"). Cambiar `key` la dispara. */
  familiaPrecarga?: { familiaId: string; key: number } | null;
}

interface MiembroHogar {
  alojamientoId: string;
  refugiadoId: string;
  es_jefe: boolean;
  parentesco: string;
  nombre: string;
  cedula: string | null;
  fotoUrl: string | null;
  fechaNacimiento: string | null;
  creadaTs: number;
}

/** Resumen del hogar al que ya pertenece una cédula en este campamento. */
interface ResumenFamiliaAqui {
  familiaId: string;
  nombreJefe: string;
  cedulaJefe: string | null;
  total: number;
  rolEnFamilia: string;
}

function AvatarMiembro({
  fotoUrl,
  nombre,
}: {
  fotoUrl: string | null;
  nombre: string;
}) {
  const [rota, setRota] = useState(false);
  const url = (fotoUrl ?? "").trim();
  const mostrarFoto = url.length > 0 && !rota;

  return (
    <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-dashed border-border bg-muted/50">
      {mostrarFoto ? (
        <img
          src={url}
          alt={nombre}
          className="size-full object-cover"
          onError={() => setRota(true)}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-0.5 text-muted-foreground">
          <Camera className="size-4 opacity-70" />
          <span className="text-[8px] font-medium leading-none">Sin foto</span>
        </div>
      )}
    </div>
  );
}

interface FormMenor {
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  sexo: SexoRefugiado | "";
  fecha_nacimiento: string;
  edad: string;
  parentesco: string;
}

function formMenorVacio(): FormMenor {
  return {
    primer_nombre: "",
    segundo_nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    sexo: "",
    fecha_nacimiento: "",
    edad: "",
    parentesco: "Hijo/a",
  };
}

/** Fecha de nacimiento aproximada (hoy menos N años) cuando solo se conoce la edad. */
function fechaAproximadaPorEdad(edad: number): string {
  const hoy = new Date();
  const y = hoy.getFullYear() - edad;
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

const soloDigitos = (c: string) => c.replace(/\D/g, "");

function fechaCorta(ts: number): string {
  return new Date(ts).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fechaHoraCorta(ts: number): string {
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cuándo y con qué detalle se registró en otro campamento (mejor dato disponible). */
function detalleOtroRegistro(o: OtroCentroActivo): string {
  if (o.creadaTs) return `Registrado el ${fechaHoraCorta(o.creadaTs)}`;
  if (o.fechaIngreso) return `Ingresó el ${o.fechaIngreso}`;
  return "Fecha de registro no disponible";
}

function mensajeReporteDuplicado(
  persona: PersonaNexusCenso,
  estado: EstadoNominalCedula,
  centroNombreActual: string,
  nombreCentroFn: (id: string) => string,
): string {
  const otros = estado.otrosCentros
    .map((o) => `${nombreCentroFn(o.centroId)} — ${detalleOtroRegistro(o)}`)
    .join("; ");
  return [
    "Posible registro duplicado — Censo por cédula",
    `Cédula: ${formatearCedula(persona.cedula, persona.letra === "E" ? "E" : "V")} — ${persona.nombre_completo}`,
    `Registrando en: ${centroNombreActual}`,
    `Ya figura activo en: ${otros}`,
    "¿Es traslado, duplicado o error? Por favor confirmar.",
  ].join("\n");
}

export function CensoNexusPanel({
  centroId,
  centroNombre,
  tokenTerreno,
  onCambiarCentro,
  onEstadoNexus,
  reinicioKey = 0,
  cedulaPrecarga,
  familiaPrecarga,
}: Props) {
  const [sesionLista, setSesionLista] = useState(false);
  const [errorSesion, setErrorSesion] = useState("");

  const [letra, setLetra] = useState<Letra>("V");
  const [cedula, setCedula] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [persona, setPersona] = useState<PersonaNexusCenso | null>(null);
  const [estadoNominal, setEstadoNominal] = useState<EstadoNominalCedula | null>(null);
  // Contexto de solo lectura del censo manual viejo (censo_registros), si esa
  // cédula ya fue censada antes de existir este flujo por cédula.
  const [registroViejo, setRegistroViejo] = useState<RegistroCensoViejoResumen | null>(null);
  // Procedencia de la ficha mostrada: caché propia (BD) o consulta viva a Nexus.
  const [origenFicha, setOrigenFicha] = useState<{
    desdeCache: boolean;
    consultadaTs: number | null;
  } | null>(null);

  // Teléfonos confirmados de palabra con la persona (un toque = verificado)
  // y teléfonos nuevos que el funcionario añade en el momento.
  const [telsConfirmados, setTelsConfirmados] = useState<string[]>([]);
  const [telsAgregados, setTelsAgregados] = useState<string[]>([]);
  const [telNuevo, setTelNuevo] = useState("");
  const [agregandoTel, setAgregandoTel] = useState(false);

  // Foto de campo en verificación (antes de existir refugiado_id): preview
  // local; se sube al bucket al crear/agregar en nominal.
  const [fotoArchivo, setFotoArchivo] = useState<File | null>(null);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState<string | null>(null);
  const inputFotoCamaraRef = useRef<HTMLInputElement | null>(null);
  const inputFotoGaleriaRef = useRef<HTMLInputElement | null>(null);

  const [familiaId, setFamiliaId] = useState<string | null>(null);
  const [, setCedulaJefe] = useState<string | null>(null);
  const [miembros, setMiembros] = useState<MiembroHogar[]>([]);
  /** Hogar al que ya pertenece la cédula buscada (si está en este campamento). */
  const [resumenFamiliaAqui, setResumenFamiliaAqui] = useState<ResumenFamiliaAqui | null>(
    null,
  );
  const [abriendoFamilia, setAbriendoFamilia] = useState(false);

  // ¿Persona buscada es líder de familia? null = sin responder (se pregunta
  // antes de mostrar la sección de damnificación, que es del hogar, no de
  // cualquier persona). Solo aplica mientras no hay hogar creado.
  const [esJefe, setEsJefe] = useState<boolean | null>(null);
  // Si el líder no está presente: registrar igual a esta persona como
  // miembro fundador del hogar (sin líder asignado todavía).
  const [registrarSinLider, setRegistrarSinLider] = useState(false);
  const [parentescoSinLider, setParentescoSinLider] = useState("Otro familiar");

  // Contexto del terremoto: se captura una sola vez, al crear el hogar.
  const [estatusVivienda, setEstatusVivienda] = useState<EstatusVivienda | null>(null);
  const [ubicacionVivienda, setUbicacionVivienda] = useState("");
  const [ubicacionOtro, setUbicacionOtro] = useState("");
  const [miembrosDamnificados, setMiembrosDamnificados] = useState(0);
  const [fallecidosCount, setFallecidosCount] = useState(0);
  const [desaparecidosCount, setDesaparecidosCount] = useState(0);
  const [detallePerdidas, setDetallePerdidas] = useState<FamiliarSeparado[]>([]);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  // Nivel de afectación del hogar recién creado, para el badge del header.
  const [nivelHogar, setNivelHogar] = useState<{
    estatusVivienda: EstatusVivienda;
    fallecidos: number;
    desaparecidos: number;
  } | null>(null);

  // Familiares que Nexus sugirió para el jefe del hogar. Sobreviven a la
  // creación del hogar para poder marcarlos después de verificar al jefe.
  const [famSugeridos, setFamSugeridos] = useState<FamiliarNexus[]>([]);
  const [seleccionFam, setSeleccionFam] = useState<Record<string, boolean>>({});
  const [parentescoFam, setParentescoFam] = useState<Record<string, string>>({});
  const [parentescoDirecto, setParentescoDirecto] = useState("Otro familiar");
  // Al agregar a alguien a un hogar ya abierto: ¿es líder de familia? (hasta
  // MAX_LIDERES_FAMILIA activos por hogar, ver reposRefugiados.ts).
  const [agregarComoLider, setAgregarComoLider] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [avisoOtros, setAvisoOtros] = useState<string[]>([]);

  // Nombres legibles de campamentos para los avisos (fallback: el id).
  const [nombresCentros, setNombresCentros] = useState<Record<string, string>>({});
  // Analistas SAE de este campamento, para el botón "Reportar por Telegram"
  // cuando una cédula ya figura activa en otro centro.
  const [analistasContacto, setAnalistasContacto] = useState<AnalistaContactoTerreno[]>([]);
  // Confirmación explícita de continuar pese al aviso de duplicado — no se
  // puede crear el hogar / agregar al familiar sin marcarla primero.
  const [confirmoDuplicado, setConfirmoDuplicado] = useState(false);
  /** Detalle SAIME (dirección, teléfonos, familiares): plegado por defecto. */
  const [infoSaimeAbierta, setInfoSaimeAbierta] = useState(false);

  const [pestanaMiembros, setPestanaMiembros] = useState<"adultos" | "sin_cedula">(
    "adultos",
  );
  const [menor, setMenor] = useState<FormMenor>(formMenorVacio);
  const [errorMenor, setErrorMenor] = useState("");
  const [eliminarMiembro, setEliminarMiembro] = useState<MiembroHogar | null>(null);
  const [eliminandoMiembro, setEliminandoMiembro] = useState(false);
  /** null = comprobando; false = Nexus caído (solo caché / planilla). */
  const [nexusEnLinea, setNexusEnLinea] = useState<NexusEnLinea>(null);
  const [senalConsulta, setSenalConsulta] = useState<SenalConsultaNexus | null>(null);

  function notificarEstadoNexus(enLinea: NexusEnLinea) {
    setNexusEnLinea(enLinea);
    onEstadoNexus?.(enLinea);
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (tokenTerreno) {
          await asegurarSesionTerreno(tokenTerreno, centroId);
        }
        if (!cancel) {
          setSesionLista(true);
          setErrorSesion("");
        }
      } catch (e) {
        if (!cancel) {
          setErrorSesion(
            e instanceof Error
              ? e.message
              : "No se pudo abrir sesión de terreno. Use el QR del campamento o inicie sesión.",
          );
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [tokenTerreno, centroId]);

  useEffect(() => {
    if (!sesionLista) return;
    let cancel = false;
    listarCentrosCenso()
      .then((lista) => {
        if (cancel) return;
        setNombresCentros(Object.fromEntries(lista.map((c) => [c.id, c.nombre])));
      })
      .catch(() => {
        /* los avisos caen al id del campamento */
      });
    return () => {
      cancel = true;
    };
  }, [sesionLista]);

  useEffect(() => {
    if (!sesionLista || !tokenTerreno) return;
    let cancel = false;
    obtenerCentroTerreno(tokenTerreno)
      .then((c) => {
        if (!cancel) setAnalistasContacto(c?.analistas_contacto ?? []);
      })
      .catch(() => {
        /* el botón de Telegram simplemente no aparece */
      });
    return () => {
      cancel = true;
    };
  }, [sesionLista, tokenTerreno]);

  const nombreCentro = (id: string) => nombresCentros[id] ?? id;

  async function refrescarMiembros(id: string) {
    const lista = await miembrosHogarActual(id);
    setMiembros(lista);
  }

  /** Abre en la vista de hogar un familia ya registrada (cédula duplicada en el campamento). */
  async function abrirFamiliaExistente(id: string) {
    setAbriendoFamilia(true);
    setErrorBusqueda("");
    setMensaje("");
    try {
      const lista = await miembrosHogarActual(id);
      const jefe = lista.find((m) => m.es_jefe);
      setFamiliaId(id);
      setMiembros(lista);
      setCedulaJefe(jefe?.cedula ?? null);
      setPersona(null);
      setEstadoNominal(null);
      setOrigenFicha(null);
      setResumenFamiliaAqui(null);
      setCedula("");
      setEsJefe(null);
      setRegistrarSinLider(false);
      setConfirmoDuplicado(false);
      limpiarFotoLocal();
      setMensaje(
        `Hogar de ${jefe?.nombre ?? "la familia"} abierto. Puede agregar o quitar miembros.`,
      );
      setPasoEnfoque("hogar");
      window.setTimeout(() => {
        refPasoHogar.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      setErrorBusqueda(
        err instanceof Error ? err.message : "No se pudo abrir el hogar.",
      );
    } finally {
      setAbriendoFamilia(false);
    }
  }

  async function confirmarEliminarMiembro() {
    if (!eliminarMiembro || !familiaId) return;
    setEliminandoMiembro(true);
    try {
      await registrarEgreso(eliminarMiembro.alojamientoId, {
        motivo: "Corrección de censo",
      });
      await refrescarMiembros(familiaId);
      setMensaje(`Se quitó del hogar a ${eliminarMiembro.nombre}.`);
      setEliminarMiembro(null);
      // Si era el único / el jefe y no quedan miembros, cerrar el hogar en UI.
      const restantes = await miembrosHogarActual(familiaId);
      if (restantes.length === 0) {
        setFamiliaId(null);
        setCedulaJefe(null);
        setNivelHogar(null);
        setFamSugeridos([]);
        setPestanaMiembros("adultos");
      }
    } catch (err) {
      setMensaje("");
      setErrorBusqueda(
        err instanceof Error ? err.message : "No se pudo quitar al miembro del hogar.",
      );
    } finally {
      setEliminandoMiembro(false);
    }
  }

  function limpiarFotoLocal() {
    setFotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFotoArchivo(null);
  }

  function onElegirFoto(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setFotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setFotoArchivo(file);
  }

  /** Sube la foto de campo tras el alta nominal (el id ya existe). */
  async function persistirFotoCampo(refugiadoId: string) {
    if (!fotoArchivo || !supabaseDisponible()) return;
    try {
      const path = await subirFotoRefugiado(refugiadoId, fotoArchivo);
      await actualizarConsentimientoFoto(refugiadoId, true, path);
    } catch {
      // El registro ya quedó; la foto se puede completar en la ficha.
    }
  }

  useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
    };
  }, [fotoPreviewUrl]);

  function resetDamnificacion() {
    setEstatusVivienda(null);
    setUbicacionVivienda("");
    setUbicacionOtro("");
    setMiembrosDamnificados(0);
    setFallecidosCount(0);
    setDesaparecidosCount(0);
    setDetallePerdidas([]);
    setDetalleAbierto(false);
  }

  async function onBuscar(
    e?: React.FormEvent,
    opts?: { forzarNexus?: boolean; cedulaBuscar?: string; letraBuscar?: Letra },
  ) {
    e?.preventDefault();
    const cedulaBuscar = opts?.cedulaBuscar ?? cedula;
    const letraBuscar = opts?.letraBuscar ?? letra;
    setErrorBusqueda("");
    setMensaje("");
    setPersona(null);
    setEstadoNominal(null);
    setOrigenFicha(null);
    setRegistroViejo(null);
    setAvisoOtros([]);
    setTelsConfirmados([]);
    setTelsAgregados([]);
    setTelNuevo("");
    setAgregandoTel(false);
    setConfirmoDuplicado(false);
    setInfoSaimeAbierta(false);
    setResumenFamiliaAqui(null);
    setAgregarComoLider(false);
    limpiarFotoLocal();
    if (!familiaId) {
      setEsJefe(null);
      setRegistrarSinLider(false);
      resetDamnificacion();
    }
    setBuscando(true);
    try {
      const [ficha, estado, viejo] = await Promise.all([
        buscarPersonaNexusConCache(letraBuscar, cedulaBuscar, {
          forzarNexus: opts?.forzarNexus,
        }),
        // El pre-chequeo nominal es informativo: si falla no bloquea la búsqueda.
        estadoNominalPorCedula(cedulaBuscar, letraBuscar, centroId).catch(() => null),
        // Contexto del censo manual viejo: también informativo, nunca bloquea.
        buscarCensoRegistroPorDocumento(soloDigitos(cedulaBuscar)).catch(() => null),
      ]);
      const p = ficha.persona;
      setPersona(p);
      setEstadoNominal(estado);
      setRegistroViejo(viejo);
      setOrigenFicha({ desdeCache: ficha.desdeCache, consultadaTs: ficha.consultadaTs });
      // Consulta viva exitosa ⇒ Nexus está arriba (sin otro hit a /health).
      if (!ficha.desdeCache) {
        setSenalConsulta({ ts: Date.now(), resultado: "ok" });
      }
      if (!familiaId) {
        // Si ya está en este campamento, "Ir a esa familia" reabre el hogar;
        // no se fuerza el flujo de crear/reanudar vía damnificación.
        // Sin hogar activo: la persona buscada podría ser el jefe; sus
        // familiares sugeridos se conservan para marcarlos tras crear el hogar.
        setFamSugeridos(p.familiares);
        const sel: Record<string, boolean> = {};
        const par: Record<string, string> = {};
        for (const f of p.familiares) {
          sel[f.cedula] = false;
          par[f.cedula] = f.parentesco || "Otro familiar";
        }
        setSeleccionFam(sel);
        setParentescoFam(par);
      } else {
        // Con hogar activo: si la persona estaba en la lista sugerida del
        // jefe, se preselecciona el parentesco que trajo Nexus.
        const sugerido = famSugeridos.find(
          (f) => soloDigitos(f.cedula) === soloDigitos(p.cedula),
        );
        setParentescoDirecto(sugerido?.parentesco || "Otro familiar");
      }
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "Error al consultar");
      // Fallo de infraestructura ⇒ el banner pasa a fuera de línea.
      if (esNexusNoDisponible(err)) {
        setSenalConsulta({ ts: Date.now(), resultado: "caida" });
      }
    } finally {
      setBuscando(false);
    }
  }

  async function onCrearHogar() {
    if (!persona) return;
    if (!estatusVivienda) {
      setErrorBusqueda("Indique la severidad de la vivienda antes de crear el hogar.");
      return;
    }
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      const esLider = esJefe === true;
      const r = await registrarPersonaNexusEnNominal({
        persona,
        centroId,
        esJefe: esLider,
        crearHogarSiFalta: !esLider,
        parentescoJefe: esLider ? undefined : parentescoSinLider,
        telefonosConfirmados: telsConfirmados,
      });
      await persistirFotoCampo(r.refugiadoId);
      limpiarFotoLocal();
      setFamiliaId(r.familiaId);
      setCedulaJefe(esLider ? persona.cedula : null);
      setAvisoOtros(r.otrosCentros);

      const ubicacion = (ubicacionVivienda === "Otro" ? ubicacionOtro : ubicacionVivienda).trim();
      try {
        await guardarResidenciaAfectada({
          familia_id: r.familiaId,
          centro_id: centroId,
          estatus_vivienda: estatusVivienda,
          estado_federativo: ubicacion || undefined,
        });
        await actualizarDamnificacionFamilia(r.familiaId, {
          miembros_damnificados_declarados: miembrosDamnificados || null,
          fallecidos_confirmados: fallecidosCount,
          desaparecidos: desaparecidosCount,
        });
        if (detallePerdidas.length > 0) {
          await guardarFamiliaresReferencia(r.familiaId, [], detallePerdidas);
        }
        setNivelHogar({ estatusVivienda, fallecidos: fallecidosCount, desaparecidos: desaparecidosCount });
      } catch {
        // El hogar y la persona ya quedaron registrados; la damnificación se
        // puede completar después desde la ficha del hogar si esto falla.
      }

      await refrescarMiembros(r.familiaId);
      setMensaje(
        r.yaEstabaEnCentro
          ? "Ya estaba en este campamento; se reanudó su hogar."
          : "Hogar creado. Continúe con los adultos del grupo familiar.",
      );
      setPersona(null);
      setEstadoNominal(null);
      setOrigenFicha(null);
      setCedula("");
      // No resetear damnificación: así se puede volver a revisarla desde la miga.
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo crear el hogar");
    } finally {
      setGuardando(false);
    }
  }

  /** Actualiza damnificación de un hogar ya creado (vuelta desde la miga). */
  async function onGuardarDamnificacion() {
    if (!familiaId || !estatusVivienda) {
      setErrorBusqueda("Indique la severidad de la vivienda.");
      return;
    }
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      const ubicacion = (ubicacionVivienda === "Otro" ? ubicacionOtro : ubicacionVivienda).trim();
      await guardarResidenciaAfectada({
        familia_id: familiaId,
        centro_id: centroId,
        estatus_vivienda: estatusVivienda,
        estado_federativo: ubicacion || undefined,
      });
      await actualizarDamnificacionFamilia(familiaId, {
        miembros_damnificados_declarados: miembrosDamnificados || null,
        fallecidos_confirmados: fallecidosCount,
        desaparecidos: desaparecidosCount,
      });
      if (detallePerdidas.length > 0) {
        await guardarFamiliaresReferencia(familiaId, [], detallePerdidas);
      }
      setNivelHogar({
        estatusVivienda,
        fallecidos: fallecidosCount,
        desaparecidos: desaparecidosCount,
      });
      setMensaje("Damnificación actualizada.");
      setPasoEnfoque("hogar");
      window.setTimeout(() => {
        refPasoHogar.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo guardar la damnificación");
    } finally {
      setGuardando(false);
    }
  }

  function volverABuscarJefe() {
    setPersona(null);
    setEstadoNominal(null);
    setOrigenFicha(null);
    setEsJefe(null);
    setRegistrarSinLider(false);
    setCedula("");
  }

  async function onAgregarComoFamiliar() {
    if (!persona || !familiaId) return;
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      const r = await registrarPersonaNexusEnNominal({
        persona,
        centroId,
        familiaId,
        esJefe: agregarComoLider,
        parentescoJefe: agregarComoLider ? undefined : parentescoDirecto,
        telefonosConfirmados: telsConfirmados,
      });
      await persistirFotoCampo(r.refugiadoId);
      limpiarFotoLocal();
      setAvisoOtros(r.otrosCentros);
      await refrescarMiembros(r.familiaId);
      setMensaje(
        agregarComoLider
          ? `Agregado como líder del hogar: ${persona.nombre_completo}`
          : `Agregado al hogar: ${persona.nombre_completo}`,
      );
      setPersona(null);
      setEstadoNominal(null);
      setOrigenFicha(null);
      setCedula("");
      setAgregarComoLider(false);
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setGuardando(false);
    }
  }

  async function onAgregarFamiliaresMarcados() {
    if (!familiaId) return;
    const marcados = familiaresDisponibles.filter((f) => seleccionFam[f.cedula]);
    if (marcados.length === 0) {
      setErrorBusqueda("Marque al menos un familiar de la lista.");
      return;
    }
    setGuardando(true);
    setMensaje("");
    setErrorBusqueda("");
    try {
      let ok = 0;
      const fallos: string[] = [];
      for (const f of marcados) {
        try {
          const { persona: ficha } = await buscarPersonaNexusConCache(
            (f.letra === "E" ? "E" : "V") as Letra,
            f.cedula,
          );
          await registrarPersonaNexusEnNominal({
            persona: ficha,
            centroId,
            familiaId,
            esJefe: false,
            parentescoJefe: parentescoFam[f.cedula] || f.parentesco || "Otro familiar",
          });
          ok += 1;
        } catch (e) {
          fallos.push(
            `${f.nombre || f.cedula}: ${e instanceof Error ? e.message : "error"}`,
          );
        }
      }
      await refrescarMiembros(familiaId);
      setMensaje(
        ok
          ? `Se agregaron ${ok} familiar(es) al hogar. Puede seguir digitando cédulas para agregar más adultos.`
          : "No se pudo agregar ninguno.",
      );
      if (fallos.length) setErrorBusqueda(fallos.join(" · "));
      setSeleccionFam((prev) => {
        const n = { ...prev };
        for (const f of marcados) n[f.cedula] = false;
        return n;
      });
      // La caja de búsqueda queda con la última cédula tecleada manualmente
      // (p. ej. la del jefe, al crear el hogar); limpiarla evita que parezca
      // "ya usada" y no invite a seguir agregando adultos.
      setPersona(null);
      setEstadoNominal(null);
      setOrigenFicha(null);
      setCedula("");
      setConfirmoDuplicado(false);
    } catch (err) {
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudieron agregar");
    } finally {
      setGuardando(false);
    }
  }

  async function onAgregarMenor(e: React.FormEvent) {
    e.preventDefault();
    if (!familiaId) return;
    if (!menor.primer_nombre.trim() || !menor.primer_apellido.trim()) {
      setErrorMenor("Indique al menos primer nombre y primer apellido.");
      return;
    }
    if (!menor.sexo) {
      setErrorMenor("Indique el sexo.");
      return;
    }
    const edadNum = menor.edad === "" ? null : Number(menor.edad);
    if (!menor.fecha_nacimiento && edadNum == null) {
      setErrorMenor("Indique la fecha de nacimiento o al menos la edad aproximada.");
      return;
    }
    setErrorMenor("");
    setGuardando(true);
    setMensaje("");
    try {
      await registrarMiembroSinDocumento({
        centroId,
        familiaId,
        primer_nombre: menor.primer_nombre,
        segundo_nombre: menor.segundo_nombre,
        primer_apellido: menor.primer_apellido,
        segundo_apellido: menor.segundo_apellido,
        sexo: menor.sexo || null,
        fecha_nacimiento:
          menor.fecha_nacimiento ||
          (edadNum != null ? fechaAproximadaPorEdad(Math.max(0, edadNum)) : null),
        parentescoJefe: menor.parentesco,
      });
      await refrescarMiembros(familiaId);
      setMensaje(
        `Agregado al hogar sin documento: ${menor.primer_nombre} ${menor.primer_apellido}`,
      );
      setMenor(formMenorVacio());
      setPestanaMiembros("adultos");
      setErrorMenor("");
    } catch (err) {
      setErrorMenor(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setGuardando(false);
    }
  }

  function limpiarFlujoCenso(mensaje = "") {
    setFamiliaId(null);
    setCedulaJefe(null);
    setMiembros([]);
    setFamSugeridos([]);
    setSeleccionFam({});
    setParentescoFam({});
    setPersona(null);
    setEstadoNominal(null);
    setOrigenFicha(null);
    setResumenFamiliaAqui(null);
    setAvisoOtros([]);
    setTelsConfirmados([]);
    setTelsAgregados([]);
    setTelNuevo("");
    setAgregandoTel(false);
    setAgregarComoLider(false);
    setCedula("");
    setLetra("V");
    setPestanaMiembros("adultos");
    setMenor(formMenorVacio());
    setErrorMenor("");
    setEsJefe(null);
    setRegistrarSinLider(false);
    setParentescoSinLider("Otro familiar");
    setConfirmoDuplicado(false);
    resetDamnificacion();
    setNivelHogar(null);
    limpiarFotoLocal();
    setErrorBusqueda("");
    setMensaje(mensaje);
    setPasoEnfoque("cedula");
  }

  function cerrarHogar() {
    limpiarFlujoCenso("Hogar cerrado. Puede iniciar otro con la cédula del siguiente jefe.");
  }

  function reiniciarFlujoCenso() {
    limpiarFlujoCenso("");
    window.setTimeout(() => {
      refPasoCedula.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  // Cabecera de /censo: «Inicio del censo» incrementa reinicioKey.
  useEffect(() => {
    if (reinicioKey <= 0) return;
    reiniciarFlujoCenso();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al pulsar Inicio del censo
  }, [reinicioKey]);

  // Botón "Verificar" desde la lista "Registrados" del censo viejo: precarga
  // la cédula y dispara la búsqueda de una.
  useEffect(() => {
    if (!cedulaPrecarga || cedulaPrecarga.key <= 0) return;
    setLetra(cedulaPrecarga.letra);
    setCedula(cedulaPrecarga.cedula);
    void onBuscar(undefined, {
      cedulaBuscar: cedulaPrecarga.cedula,
      letraBuscar: cedulaPrecarga.letra,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar cedulaPrecarga.key
  }, [cedulaPrecarga?.key]);

  // Botón "Agregar líder" desde "Censados": abre directo ese hogar (sin
  // pasar por una búsqueda de cédula).
  useEffect(() => {
    if (!familiaPrecarga || familiaPrecarga.key <= 0) return;
    void abrirFamiliaExistente(familiaPrecarga.familiaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar familiaPrecarga.key
  }, [familiaPrecarga?.key]);

  function toggleTelefono(t: string) {
    setTelsConfirmados((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  function agregarTelefono() {
    const t = telNuevo.trim();
    if (t.replace(/\D/g, "").length < 7) return;
    setTelsAgregados((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTelsConfirmados((prev) => (prev.includes(t) ? prev : [...prev, t]));
    setTelNuevo("");
    setAgregandoTel(false);
  }

  const hayHogar = Boolean(familiaId);

  // Si la cédula ya está en este campamento, cargar el resumen del hogar
  // para mostrar a qué familia pertenece y el botón «Ir a esa familia».
  useEffect(() => {
    const famId =
      estadoNominal?.enEsteCentro && estadoNominal.familiaAqui && !familiaId
        ? estadoNominal.familiaAqui
        : null;
    if (!famId) {
      setResumenFamiliaAqui(null);
      return;
    }
    let cancel = false;
    miembrosHogarActual(famId)
      .then((lista) => {
        if (cancel) return;
        const jefe = lista.find((m) => m.es_jefe) ?? lista[0];
        const yo = estadoNominal?.refugiadoId
          ? lista.find((m) => m.refugiadoId === estadoNominal.refugiadoId)
          : null;
        setResumenFamiliaAqui({
          familiaId: famId,
          nombreJefe: jefe?.nombre ?? "Hogar",
          cedulaJefe: jefe?.cedula ?? null,
          total: lista.length,
          rolEnFamilia: yo?.es_jefe
            ? "Jefe/a de hogar"
            : yo?.parentesco?.trim() || "Miembro del hogar",
        });
      })
      .catch(() => {
        if (!cancel) setResumenFamiliaAqui(null);
      });
    return () => {
      cancel = true;
    };
  }, [
    estadoNominal?.enEsteCentro,
    estadoNominal?.familiaAqui,
    estadoNominal?.refugiadoId,
    familiaId,
  ]);

  const cedulasMiembros = useMemo(
    () => new Set(miembros.map((m) => soloDigitos(m.cedula || ""))),
    [miembros],
  );

  const familiaresDisponibles = useMemo(
    () => famSugeridos.filter((f) => !cedulasMiembros.has(soloDigitos(f.cedula))),
    [famSugeridos, cedulasMiembros],
  );

  const personaYaEnHogar = Boolean(
    persona && hayHogar && cedulasMiembros.has(soloDigitos(persona.cedula)),
  );

  /** Líderes activos en el hogar abierto (ver MAX_LIDERES_FAMILIA en reposRefugiados.ts). */
  const lideresActivosHogar = useMemo(() => miembros.filter((m) => m.es_jefe).length, [miembros]);

  // Bloquea "crear hogar" / "agregar" mientras haya un aviso de duplicado
  // cross-centro sin que el censista lo confirme explícitamente.
  const hayDuplicadoSinConfirmar = Boolean(
    estadoNominal && estadoNominal.otrosCentros.length > 0 && !confirmoDuplicado,
  );

  // Miga de pan de pasos: cada paso apunta a su sección en pantalla; solo se
  // puede saltar a los pasos cuya sección está montada (ya alcanzados).
  // `pasoFlujo` = el más avanzado según el estado; `pasoEnfoque` = el que el
  // usuario mira (miga + borde verde), y puede ir atrás sin perder el avance.
  const refPasoCedula = useRef<HTMLDivElement | null>(null);
  const refPasoIdentidad = useRef<HTMLDivElement | null>(null);
  const refPasoDamnificacion = useRef<HTMLDivElement | null>(null);
  const refPasoHogar = useRef<HTMLDivElement | null>(null);
  const [pasoEnfoque, setPasoEnfoque] = useState<PasoCensoId>("cedula");

  const pasoFlujo: PasoCensoId = persona
    ? !hayHogar && esJefe === true
      ? "damnificacion"
      : "identidad"
    : hayHogar
      ? "hogar"
      : "cedula";

  // Cuando el flujo avanza (o se reinicia), el enfoque sigue al tip y
  // la vista baja a esa caja. Si el usuario vuelve atrás por la miga,
  // solo cambia `pasoEnfoque` (el tip no se mueve). El primer montaje
  // no hace scroll (evita un salto al abrir /censo).
  const pasoFlujoInicial = useRef(true);
  useEffect(() => {
    setPasoEnfoque(pasoFlujo);
    if (pasoFlujoInicial.current) {
      pasoFlujoInicial.current = false;
      return;
    }
    const ref = {
      cedula: refPasoCedula,
      identidad: refPasoIdentidad,
      damnificacion: refPasoDamnificacion,
      hogar: refPasoHogar,
    }[pasoFlujo];
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [pasoFlujo]);

  const pasosCenso: PasoCenso[] = useMemo(() => {
    const hayPersona = persona != null;
    const damnificacionAlcanzada =
      hayHogar || (hayPersona && esJefe === true);
    return [
      {
        id: "cedula",
        label: "Cédula",
        estado: pasoEnfoque === "cedula" ? "actual" : "completado",
        disponible: true,
      },
      {
        id: "identidad",
        label: "Identidad",
        estado:
          pasoEnfoque === "identidad"
            ? "actual"
            : hayHogar || damnificacionAlcanzada
              ? "completado"
              : "pendiente",
        disponible: hayPersona,
      },
      {
        id: "damnificacion",
        label: "Damnificación",
        estado:
          pasoEnfoque === "damnificacion"
            ? "actual"
            : hayHogar
              ? "completado"
              : "pendiente",
        disponible: damnificacionAlcanzada,
      },
      {
        id: "hogar",
        label: "Hogar",
        estado:
          pasoEnfoque === "hogar" ? "actual" : hayHogar ? "completado" : "pendiente",
        disponible: hayHogar,
      },
    ];
  }, [persona, esJefe, hayHogar, pasoEnfoque]);

  function irAPaso(id: PasoCensoId) {
    setPasoEnfoque(id);
    const ref = {
      cedula: refPasoCedula,
      identidad: refPasoIdentidad,
      damnificacion: refPasoDamnificacion,
      hogar: refPasoHogar,
    }[id];
    // Si el paso monta al enfocarlo (p. ej. damnificación tras crear hogar),
    // esperar al paint antes de hacer scroll.
    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  if (errorSesion) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Sesión requerida</CardTitle>
          <CardDescription>{errorSesion}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!sesionLista) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="size-4 animate-spin" /> Preparando sesión…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Miga de pan de pasos: fija arriba para orientarse y saltar entre
          secciones mientras se recorre el formulario largo en móvil. */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b bg-background/90 px-5 py-2 backdrop-blur">
        <MigaPasosCenso className="min-w-0 flex-1" pasos={pasosCenso} onIr={irAPaso} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1.5 text-muted-foreground"
              disabled={
                !hayHogar &&
                !persona &&
                !cedula &&
                esJefe == null &&
                !estatusVivienda
              }
              title="Reiniciar el censo desde el inicio"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden min-[420px]:inline">Reiniciar</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Reiniciar el censo?</AlertDialogTitle>
              <AlertDialogDescription>
                Se limpia la búsqueda, la ficha y el hogar en curso en esta pantalla.
                Lo ya guardado en la base nominal no se borra.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={reiniciarFlujoCenso}>
                Reiniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Campamento destino: siempre visible para que no haya dudas de dónde
          queda registrado el hogar. */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-card px-3 py-2.5 shadow-lg">
        <MapPin className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Registrando en
          </p>
          <p className="truncate text-sm font-semibold">{centroNombre}</p>
        </div>
        {onCambiarCentro && !tokenTerreno ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onCambiarCentro}
          >
            Cambiar
          </Button>
        ) : null}
      </div>

      <EstadoNexusApi onEstado={notificarEstadoNexus} senalConsulta={senalConsulta} />

      {/* Paso inicial: búsqueda del jefe (solo antes de crear el hogar). */}
      {!hayHogar ? (
      <Card
        ref={refPasoCedula}
        className={cn(
          "scroll-mt-14 transition-[border-color,box-shadow]",
          pasoEnfoque === "cedula" && "border-primary ring-1 ring-primary/40",
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Censo por cédula
          </CardTitle>
          <CardDescription>
            Empiece por el <strong className="font-medium text-foreground">jefe/a de familia</strong>.
            Verifique la identidad y cree el hogar; luego agregue al resto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BuscadorCedula
            letra={letra}
            onLetra={setLetra}
            cedula={cedula}
            onCedula={setCedula}
            buscando={buscando}
            onSubmit={onBuscar}
          />
          {errorBusqueda ? (
            <p className="text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              {errorBusqueda}
            </p>
          ) : null}
          {mensaje ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
              <Check className="size-4 mt-0.5 shrink-0" />
              {mensaje}
            </p>
          ) : null}
          {avisoOtros.length > 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Atención: esta persona también figura activa en otro(s) campamento(s):{" "}
              {avisoOtros.map(nombreCentro).join(", ")}.
            </p>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {/* Vista hogar: 1) miembros arriba  2) añadir abajo */}
      {hayHogar ? (
        <Card
          ref={refPasoHogar}
          className={cn(
            "scroll-mt-14 transition-[border-color,box-shadow]",
            pasoEnfoque === "hogar" && "border-primary ring-1 ring-primary/40",
          )}
        >
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="size-4" />
                Miembros del hogar
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">
                  {miembros.length} {miembros.length === 1 ? "miembro" : "miembros"}
                </Badge>
                {nivelHogar ? (
                  (() => {
                    const nivel = META_NIVEL_AFECTACION[
                      nivelAfectacionHogar(
                        nivelHogar.estatusVivienda,
                        nivelHogar.fallecidos,
                        nivelHogar.desaparecidos,
                      )
                    ];
                    return (
                      <Badge
                        variant="outline"
                        style={{ borderColor: nivel.color, color: nivel.color }}
                      >
                        {nivel.emoji} {nivel.label}
                      </Badge>
                    );
                  })()
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2">
              {miembros.map((m, i) => {
                const edad = calcularEdad(m.fechaNacimiento);
                return (
                  <li
                    key={m.alojamientoId || m.refugiadoId}
                    className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2"
                  >
                    <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <AvatarMiembro fotoUrl={m.fotoUrl} nombre={m.nombre} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {m.nombre}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="font-mono">
                          {m.cedula
                            ? formatearCedula(m.cedula, "V")
                            : "Sin cédula"}
                        </span>
                        {edad != null ? (
                          <span className="tabular-nums">{edad} años</span>
                        ) : null}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/90">
                        {m.creadaTs > 0 ? (
                          <span className="tabular-nums">
                            {fechaHoraCorta(m.creadaTs)}
                          </span>
                        ) : null}
                        <Badge
                          variant={m.es_jefe ? "default" : "secondary"}
                          className="h-4 px-1 text-[10px]"
                        >
                          {m.es_jefe ? "Jefe de hogar" : m.parentesco || "Familiar"}
                        </Badge>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-destructive hover:text-destructive"
                      title="Quitar del hogar"
                      onClick={() => setEliminarMiembro(m)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            {mensaje && !persona ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                <Check className="size-4 mt-0.5 shrink-0" />
                {mensaje}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {hayHogar ? (
        <Card
          ref={refPasoCedula}
          className={cn(
            "scroll-mt-14 transition-[border-color,box-shadow]",
            (pasoEnfoque === "cedula") &&
              "border-primary ring-1 ring-primary/40",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="size-4" />
              Añada miembros al hogar
            </CardTitle>
            <CardDescription>
              Quien agregue aparece arriba en «Miembros del hogar».
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="grid grid-cols-2 gap-2"
              role="tablist"
              aria-label="Tipo de miembro"
            >
              <button
                type="button"
                role="tab"
                aria-selected={pestanaMiembros === "adultos"}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold shadow-sm transition-colors",
                  pestanaMiembros === "adultos"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground",
                )}
                onClick={() => {
                  setPestanaMiembros("adultos");
                  setErrorMenor("");
                }}
              >
                <Search className="size-4 shrink-0" />
                Adultos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={pestanaMiembros === "sin_cedula"}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold shadow-sm transition-colors",
                  pestanaMiembros === "sin_cedula"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground",
                )}
                onClick={() => setPestanaMiembros("sin_cedula")}
              >
                <Baby className="size-4 shrink-0" />
                <span className="truncate">Menores / sin cédula</span>
              </button>
            </div>

            {pestanaMiembros === "adultos" ? (
              <div className="space-y-3">
                <BuscadorCedula
                  letra={letra}
                  onLetra={setLetra}
                  cedula={cedula}
                  onCedula={setCedula}
                  buscando={buscando}
                  onSubmit={onBuscar}
                  labelCedula="Cédula del familiar"
                />
                {errorBusqueda ? (
                  <p className="text-sm text-destructive flex items-start gap-2">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                    {errorBusqueda}
                  </p>
                ) : null}
                {avisoOtros.length > 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Atención: esta persona también figura activa en otro(s) campamento(s):{" "}
                    {avisoOtros.map(nombreCentro).join(", ")}.
                  </p>
                ) : null}

                {familiaresDisponibles.length > 0 ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Users className="size-4" />
                      Familiares detectados — ¿quiénes están aquí?
                    </p>
                    <ul className="space-y-2">
                      {familiaresDisponibles.map((f) => (
                        <li
                          key={f.cedula}
                          className={cn(
                            "flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5",
                            seleccionFam[f.cedula] ? "bg-muted/60" : "",
                          )}
                        >
                          <Checkbox
                            checked={Boolean(seleccionFam[f.cedula])}
                            onCheckedChange={(v) =>
                              setSeleccionFam((s) => ({
                                ...s,
                                [f.cedula]: Boolean(v),
                              }))
                            }
                            id={`fam-${f.cedula}`}
                          />
                          <label
                            htmlFor={`fam-${f.cedula}`}
                            className="flex-1 text-sm cursor-pointer min-w-[8rem]"
                          >
                            <span className="font-medium">{f.nombre || "—"}</span>
                            <span className="text-muted-foreground font-mono text-xs ml-2">
                              {formatearCedula(f.cedula, f.letra === "E" ? "E" : "V")}
                            </span>
                          </label>
                          <Select
                            value={
                              parentescoFam[f.cedula] || f.parentesco || "Otro familiar"
                            }
                            onValueChange={(v) =>
                              setParentescoFam((p) => ({ ...p, [f.cedula]: v }))
                            }
                          >
                            <SelectTrigger className="w-[9.5rem] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PARENTESCOS_JEFE.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      disabled={
                        guardando ||
                        !familiaresDisponibles.some((f) => seleccionFam[f.cedula])
                      }
                      onClick={onAgregarFamiliaresMarcados}
                    >
                      {guardando ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserPlus className="size-4" />
                      )}
                      Agregar marcados al hogar
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <form onSubmit={onAgregarMenor} className="space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    Para menores u otras personas sin documento. Queda en este hogar
                    sin verificación SAIME; si luego aparece la cédula, se completa en
                    la ficha.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="menor-pn" className="text-xs">
                        Primer nombre
                      </Label>
                      <Input
                        id="menor-pn"
                        value={menor.primer_nombre}
                        onChange={(e) =>
                          setMenor((m) => ({ ...m, primer_nombre: e.target.value }))
                        }
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="menor-sn" className="text-xs text-muted-foreground">
                        Segundo nombre
                      </Label>
                      <Input
                        id="menor-sn"
                        value={menor.segundo_nombre}
                        onChange={(e) =>
                          setMenor((m) => ({ ...m, segundo_nombre: e.target.value }))
                        }
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="menor-pa" className="text-xs">
                        Primer apellido
                      </Label>
                      <Input
                        id="menor-pa"
                        value={menor.primer_apellido}
                        onChange={(e) =>
                          setMenor((m) => ({ ...m, primer_apellido: e.target.value }))
                        }
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="menor-sa" className="text-xs text-muted-foreground">
                        Segundo apellido
                      </Label>
                      <Input
                        id="menor-sa"
                        value={menor.segundo_apellido}
                        onChange={(e) =>
                          setMenor((m) => ({ ...m, segundo_apellido: e.target.value }))
                        }
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Sexo</Label>
                      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
                        {(["M", "F"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={cn(
                              "h-9 text-xs font-semibold transition-colors",
                              s === "F" && "border-l border-border",
                              menor.sexo === s
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-foreground hover:bg-muted/80",
                            )}
                            onClick={() => setMenor((m) => ({ ...m, sexo: s }))}
                          >
                            {s === "M" ? "Masc." : "Fem."}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Parentesco con el jefe</Label>
                      <Select
                        value={menor.parentesco}
                        onValueChange={(v) => setMenor((m) => ({ ...m, parentesco: v }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PARENTESCOS_JEFE.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="menor-fnac" className="text-xs">
                        Fecha de nacimiento
                      </Label>
                      <Input
                        id="menor-fnac"
                        type="date"
                        value={menor.fecha_nacimiento}
                        onChange={(e) =>
                          setMenor((m) => ({ ...m, fecha_nacimiento: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="menor-edad" className="text-xs">
                        Edad (si no hay fecha)
                      </Label>
                      <Input
                        id="menor-edad"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        value={menor.edad}
                        onChange={(e) =>
                          setMenor((m) => ({ ...m, edad: e.target.value }))
                        }
                        placeholder="Aproximada"
                      />
                    </div>
                  </div>
                  {errorMenor ? (
                    <p className="text-xs text-destructive">{errorMenor}</p>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={guardando}>
                    {guardando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    Agregar al hogar
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {persona ? (
        <Card
          ref={refPasoIdentidad}
          className={cn(
            "overflow-hidden scroll-mt-14 transition-[border-color,box-shadow]",
            pasoEnfoque === "identidad" && "border-primary ring-1 ring-primary/40",
          )}
        >
          <CardContent className="pt-5 space-y-4">
            {persona.fallecido ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">
                    Esta cédula figura FALLECIDA
                    {persona.fecha_fallecimiento
                      ? ` (${persona.fecha_fallecimiento})`
                      : ""}{" "}
                    en el registro.
                  </span>{" "}
                  No corresponde a una persona viva: verifique con máximo
                  cuidado antes de registrar.
                </span>
              </div>
            ) : null}
            <div className="flex gap-3 items-start">
              {/* Foto de verificación: toque grande para cámara en el teléfono. */}
              <div className="flex w-[5.5rem] shrink-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => inputFotoCamaraRef.current?.click()}
                  className={cn(
                    "relative flex size-[5.5rem] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
                    fotoPreviewUrl
                      ? "border-primary/40 bg-muted"
                      : "border-muted-foreground/40 bg-muted/40 hover:border-primary/50 hover:bg-muted",
                  )}
                  aria-label={fotoPreviewUrl ? "Cambiar foto (cámara)" : "Añadir foto con la cámara"}
                >
                  {fotoPreviewUrl ? (
                    <img
                      src={fotoPreviewUrl}
                      alt={`Foto de ${persona.nombre_completo}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <>
                      <Camera className="size-7 text-muted-foreground" />
                      <span className="mt-1 px-1 text-center text-[10px] font-medium leading-tight text-muted-foreground">
                        Añadir foto
                      </span>
                    </>
                  )}
                </button>
                <div className="flex w-full flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full gap-1 px-1 text-[11px]"
                    onClick={() => inputFotoCamaraRef.current?.click()}
                  >
                    <Camera className="size-3.5" />
                    Cámara
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full gap-1 px-1 text-[11px] text-muted-foreground"
                    onClick={() => inputFotoGaleriaRef.current?.click()}
                  >
                    <ImagePlus className="size-3.5" />
                    Galería
                  </Button>
                </div>
                <input
                  ref={inputFotoCamaraRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    onElegirFoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={inputFotoGaleriaRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onElegirFoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold text-lg leading-tight">{persona.nombre_completo}</p>
                <p className="font-mono text-sm text-muted-foreground">
                  {formatearCedula(persona.cedula, persona.letra === "E" ? "E" : "V")}
                </p>
                {!fotoPreviewUrl ? (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Compare con la persona frente a usted. Puede tomar la foto con la cámara del teléfono.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {persona.sexo ? <Badge variant="secondary">{persona.sexo}</Badge> : null}
                  {persona.edad != null ? <Badge variant="secondary">{persona.edad} años</Badge> : null}
                  {persona.fecha_nacimiento ? (
                    <Badge variant="outline">Nac. {persona.fecha_nacimiento}</Badge>
                  ) : null}
                  {persona.estado_civil ? (
                    <Badge variant="outline">{persona.estado_civil}</Badge>
                  ) : null}
                  {fotoPreviewUrl ? (
                    <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-transparent gap-1">
                      <Camera className="size-3" /> Foto de campo
                    </Badge>
                  ) : persona.tiene_foto_saime ? (
                    <Badge variant="outline" className="gap-1">
                      <ShieldCheck className="size-3" /> SAIME (pendiente)
                    </Badge>
                  ) : (
                    <Badge variant="outline">Sin foto SAIME</Badge>
                  )}
                  {estadoNominal?.enEsteCentro ? (
                    <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-transparent">
                      {estadoNominal.esJefeAqui
                        ? "Jefe de hogar en este campamento"
                        : "Ya registrado en este campamento"}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {estadoNominal && estadoNominal.otrosCentros.length > 0 ? (
              <div className="space-y-3 rounded-lg border-2 border-destructive/60 bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  Esta persona ya figura activa en otro campamento
                </p>
                <ul className="space-y-1.5">
                  {estadoNominal.otrosCentros.map((o) => (
                    <li
                      key={o.centroId}
                      className="rounded-md border border-destructive/30 bg-background/60 px-2.5 py-2 text-sm"
                    >
                      <p className="font-medium">
                        {nombreCentro(o.centroId)}
                        {o.esJefe ? " · jefe/a de hogar" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {detalleOtroRegistro(o)}
                        {o.registradoPor ? ` · por ${o.registradoPor}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-snug text-muted-foreground">
                  Puede ser: <strong className="text-foreground">(1)</strong> un intento de registro
                  duplicado, <strong className="text-foreground">(2)</strong> un traslado real de
                  campamento cuyo registro anterior no se cerró, o{" "}
                  <strong className="text-foreground">(3)</strong> un error del sistema. No continúe sin
                  aclararlo con la persona.
                </p>
                {analistasContacto.filter(
                  (a) => a.telegram && tieneTelefonoContacto(a.telegram),
                ).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {analistasContacto
                      .filter((a) => a.telegram && tieneTelefonoContacto(a.telegram))
                      .map((a) => {
                        const href = telegramHref(a.telegram!);
                        if (!href) return null;
                        const mensaje = mensajeReporteDuplicado(
                          persona,
                          estadoNominal,
                          centroNombre,
                          nombreCentro,
                        );
                        return (
                          <Button
                            key={`${a.nombre}-${a.telegram}`}
                            asChild
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-sky-500/40 text-sky-600 dark:text-sky-400"
                          >
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                void copiarTexto(mensaje);
                              }}
                              title="Abre Telegram y copia el reporte al portapapeles para pegarlo"
                            >
                              <IconoTelegram className="size-3.5" />
                              Reportar a {a.nombre} (Telegram)
                            </a>
                          </Button>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No hay analista SAE con Telegram configurado para este campamento; repórtelo por
                    otra vía antes de continuar.
                  </p>
                )}
                <label className="flex items-start gap-2 pt-1 text-sm">
                  <Checkbox
                    checked={confirmoDuplicado}
                    onCheckedChange={(v) => setConfirmoDuplicado(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span>
                    Entiendo el riesgo y quiero continuar de todas formas (confirmé con la persona que es
                    un traslado o un error, no un duplicado).
                  </span>
                </label>
              </div>
            ) : null}

            {registroViejo ? (
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-sm font-medium leading-snug">
                  Ya fue censado/a el {fechaCorta(new Date(registroViejo.creadoEn).getTime())}
                  {registroViejo.funcionarioNombre ? ` por ${registroViejo.funcionarioNombre}` : ""}
                  {registroViejo.centroId !== centroId
                    ? ` en el campamento ${nombreCentro(registroViejo.centroId)}`
                    : ""}{" "}
                  (censo manual anterior).
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  Datos de esa planilla, solo como referencia — verifique con la persona:
                  {registroViejo.direccion ? ` dirección "${registroViejo.direccion}"` : ""}
                  {registroViejo.telefono ? `, teléfono ${registroViejo.telefono}` : ""}
                  {registroViejo.parentescoJefe ? `, parentesco declarado "${registroViejo.parentescoJefe}"` : ""}
                  .
                </p>
                {registroViejo.jefeDocumento && registroViejo.jefeDocumento !== CEDULA_JEFE_NO_SE ? (
                  <p className="text-xs leading-snug text-muted-foreground">
                    Según el censo anterior, el jefe de este hogar sería la cédula{" "}
                    <span className="font-mono font-medium text-foreground">
                      {formatearCedula(registroViejo.jefeDocumento, registroViejo.jefeTipoDoc === "E" ? "E" : "V")}
                    </span>{" "}
                    — puede buscarla primero para crear el hogar.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Ya en este campamento: familia + acceso directo al hogar. */}
            {!hayHogar && estadoNominal?.enEsteCentro && estadoNominal.familiaAqui ? (
              <div className="space-y-2.5 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Ya registrado en este campamento
                </p>
                {resumenFamiliaAqui ? (
                  <div className="space-y-0.5">
                    <p className="text-sm leading-snug">
                      Pertenece a la familia de{" "}
                      <strong className="font-semibold text-foreground">
                        {resumenFamiliaAqui.nombreJefe}
                      </strong>
                      {resumenFamiliaAqui.cedulaJefe ? (
                        <span className="font-mono text-muted-foreground">
                          {" "}
                          (
                          {formatearCedula(resumenFamiliaAqui.cedulaJefe, "V")}
                          )
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {resumenFamiliaAqui.rolEnFamilia}
                      {" · "}
                      {resumenFamiliaAqui.total.toLocaleString("es")}{" "}
                      {resumenFamiliaAqui.total === 1 ? "miembro" : "miembros"}
                    </p>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Cargando datos del hogar…
                  </p>
                )}
                <Button
                  type="button"
                  className="h-10 w-full gap-2 text-sm font-semibold shadow-sm"
                  disabled={abriendoFamilia}
                  onClick={() => {
                    void abrirFamiliaExistente(estadoNominal.familiaAqui!);
                  }}
                >
                  {abriendoFamilia ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Users className="size-4" />
                  )}
                  Ir a esa familia
                  <ArrowRight className="size-4 opacity-80" />
                </Button>
              </div>
            ) : null}

            {/* Datos SAIME/Nexus: se muestran apenas hay ficha (antes de
                preguntar si es líder), para verificar identidad en campo. */}
            <Collapsible
              open={infoSaimeAbierta}
              onOpenChange={setInfoSaimeAbierta}
              className="rounded-lg border bg-muted/20"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <ShieldCheck className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                    Información del SAIME y otros
                  </span>
                  {(persona.telefonos?.length ?? 0) + telsAgregados.length > 0 ? (
                    <Badge variant="secondary" className="h-5 shrink-0 tabular-nums text-[10px]">
                      {(persona.telefonos?.length ?? 0) + telsAgregados.length} tel.
                    </Badge>
                  ) : null}
                  {persona.familiares.length > 0 ? (
                    <Badge variant="secondary" className="h-5 shrink-0 tabular-nums text-[10px]">
                      {persona.familiares.length} fam.
                    </Badge>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      infoSaimeAbierta && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 border-t px-3 py-3">
            {/* Procedencia: clave para detectar a quien no viene de la zona
                afectada (indigencia, oportunismo). Verificar de palabra. */}
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Dirección registrada
              </p>
              {persona.ubicacion_fiscal &&
              (persona.ubicacion_fiscal.estado ||
                persona.ubicacion_fiscal.municipio ||
                persona.ubicacion_fiscal.parroquia) ? (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    persona.ubicacion_fiscal.estado,
                    persona.ubicacion_fiscal.municipio,
                    persona.ubicacion_fiscal.parroquia,
                  ]
                    .filter(Boolean)
                    .map((u) => (
                      <Badge key={u} variant="secondary" className="text-xs">
                        {u}
                      </Badge>
                    ))}
                </div>
              ) : null}
              {persona.direccion_fiscal ? (
                <p className="text-sm leading-snug">{persona.direccion_fiscal}</p>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Sin dirección en el sistema.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Teléfonos
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {[...(persona.telefonos ?? []), ...telsAgregados].map((t) => {
                  const confirmado = telsConfirmados.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTelefono(t)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm transition-colors",
                        confirmado
                          ? "border-emerald-600/50 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {confirmado ? <Check className="size-3.5" /> : null}
                      {t}
                    </button>
                  );
                })}
                {agregandoTel ? (
                  <span className="inline-flex items-center gap-1">
                    <Input
                      autoFocus
                      type="tel"
                      inputMode="tel"
                      value={telNuevo}
                      onChange={(e) => setTelNuevo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarTelefono();
                        }
                      }}
                      placeholder="0412-0000000"
                      className="h-9 w-36 font-mono text-sm"
                    />
                    <Button type="button" size="sm" className="h-9" onClick={agregarTelefono}>
                      <Check className="size-4" />
                    </Button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAgregandoTel(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    + Añadir
                  </button>
                )}
              </div>
            </div>

            {persona.familiares.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5" />
                  Familiares según el registro
                </p>
                <ul className="space-y-1">
                  {persona.familiares.map((f) => {
                    const edadFam = calcularEdad(f.fecha_nacimiento);
                    return (
                      <li
                        key={f.cedula}
                        className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-sm"
                      >
                        <span className="font-medium">{f.nombre || "—"}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatearCedula(f.cedula, f.letra === "E" ? "E" : "V")}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {f.parentesco || "Familiar"}
                        </Badge>
                        {f.fecha_nacimiento ? (
                          <span className="text-xs text-muted-foreground">
                            Nac. {f.fecha_nacimiento}
                            {edadFam != null ? ` · ${edadFam} años` : ""}
                          </span>
                        ) : null}
                        {f.fallecido ? (
                          <Badge className="bg-destructive/15 text-destructive border-transparent text-xs">
                            Falleció{f.fecha_fallecimiento ? ` ${f.fecha_fallecimiento}` : ""}
                          </Badge>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {origenFicha ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {origenFicha.desdeCache
                    ? `Consulta guardada${origenFicha.consultadaTs ? ` del ${fechaCorta(origenFicha.consultadaTs)}` : ""} (sin ir a Nexus).`
                    : "Consulta en vivo a Nexus, guardada para la próxima."}
                </span>
                {origenFicha.desdeCache ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={buscando || nexusEnLinea === false}
                    title={
                      nexusEnLinea === false
                        ? "Nexus está fuera de línea; no se puede reconsultar"
                        : "Volver a consultar Nexus"
                    }
                    onClick={() =>
                      onBuscar(undefined, {
                        forzarNexus: true,
                        cedulaBuscar: persona.cedula,
                        letraBuscar: persona.letra === "E" ? "E" : "V",
                      })
                    }
                  >
                    <RefreshCw className="size-3.5" />
                    Reconsultar
                  </Button>
                ) : null}
              </div>
            ) : null}
              </CollapsibleContent>
            </Collapsible>

            {/* Se pregunta al censador antes de damnificación (esas preguntas
                son del hogar). Un hogar puede tener 1 o 2 líderes (ver
                MAX_LIDERES_FAMILIA); si el líder no está presente, cualquier
                adulto puede fundar el hogar igual. Si ya está registrado
                aquí, el acceso es «Ir a esa familia». */}
            {!hayHogar && !(estadoNominal?.enEsteCentro && estadoNominal.familiaAqui) ? (
              <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-3">
                <p className="text-sm font-medium leading-snug">
                  ¿Es esta persona líder de familia?
                </p>
                <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
                  <button
                    type="button"
                    className={cn(
                      "h-10 text-sm font-semibold transition-colors",
                      esJefe === true
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted/80",
                    )}
                    onClick={() => {
                      setEsJefe(true);
                      setRegistrarSinLider(false);
                    }}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "h-10 border-l border-border text-sm font-semibold transition-colors",
                      esJefe === false
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground hover:bg-muted/80",
                    )}
                    onClick={() => {
                      setEsJefe(false);
                      setRegistrarSinLider(false);
                    }}
                  >
                    No
                  </button>
                </div>
                {esJefe === false && !registrarSinLider ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-muted-foreground">
                      Busque primero al líder de familia para crear el hogar. Después podrá
                      agregar a {persona.nombre_completo} como miembro.
                    </p>
                    <Button
                      type="button"
                      size="default"
                      className="h-10 w-full gap-2 text-sm font-semibold shadow-sm"
                      onClick={volverABuscarJefe}
                    >
                      <Search className="size-4" />
                      Buscar al líder de familia
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      className="h-10 w-full gap-2 border-amber-500/50 bg-amber-500/10 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-500/20 hover:text-amber-900 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/15 dark:hover:text-amber-200"
                      onClick={() => setRegistrarSinLider(true)}
                    >
                      <UserPlus className="size-4" />
                      El líder no está aquí ahora — registrar igual
                    </Button>
                  </div>
                ) : null}
                {esJefe === false && registrarSinLider ? (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-muted-foreground leading-snug">
                      Se registrará a {persona.nombre_completo} como primer miembro del hogar,
                      sin líder asignado todavía. Cuando el líder aparezca, búsquelo por su
                      cédula o busque a esta persona de nuevo para agregarlo al mismo hogar.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Parentesco declarado (respecto al futuro líder)
                      </Label>
                      <Select value={parentescoSinLider} onValueChange={setParentescoSinLider}>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PARENTESCOS_JEFE.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {hayHogar ? (
              <>
                <Separator />
                {personaYaEnHogar ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" />
                    Esta persona ya es miembro del hogar actual.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={agregarComoLider}
                        disabled={lideresActivosHogar >= MAX_LIDERES_FAMILIA}
                        onCheckedChange={(v) => setAgregarComoLider(Boolean(v))}
                      />
                      Es líder de familia
                      {lideresActivosHogar >= MAX_LIDERES_FAMILIA ? (
                        <span className="text-xs text-muted-foreground">
                          (este hogar ya tiene {MAX_LIDERES_FAMILIA} líderes)
                        </span>
                      ) : null}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {!agregarComoLider ? (
                        <Select value={parentescoDirecto} onValueChange={setParentescoDirecto}>
                          <SelectTrigger className="sm:w-[11rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PARENTESCOS_JEFE.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      <Button
                        className="flex-1"
                        disabled={guardando || hayDuplicadoSinConfirmar}
                        onClick={onAgregarComoFamiliar}
                      >
                        {guardando ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                        {agregarComoLider
                          ? "Agregar al hogar como líder"
                          : `Agregar al hogar como ${parentescoDirecto}`}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Paso 3: damnificación — al crear el hogar, o al volver desde la miga. */}
      {(!hayHogar && esJefe === true) ||
      (hayHogar && pasoEnfoque === "damnificacion") ? (
        <Card
          ref={refPasoDamnificacion}
          className={cn(
            "scroll-mt-14 transition-[border-color,box-shadow]",
            pasoEnfoque === "damnificacion" && "border-primary ring-1 ring-primary/40",
          )}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="size-4" />
              Damnificación por el terremoto
            </CardTitle>
            <CardDescription>
              Severidad de la vivienda (obligatorio). El resto es opcional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Severidad de la vivienda (obligatorio)</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {SEVERIDAD_VIVIENDA_OPCIONES.map((op) => {
                  const activo = estatusVivienda === op.valor;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      className={cn(
                        "flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors",
                        activo
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background text-foreground hover:bg-muted/70",
                      )}
                      onClick={() => setEstatusVivienda(op.valor)}
                    >
                      <span aria-hidden className="text-sm leading-none">
                        {op.emoji}
                      </span>
                      <span className="leading-snug">{op.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Ubicación de la vivienda afectada (opcional)
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {[...UBICACIONES_VIVIENDA, "Otro"].map((op) => {
                  const activo = ubicacionVivienda === op;
                  return (
                    <button
                      key={op}
                      type="button"
                      className={cn(
                        "min-h-9 rounded-lg border px-2 text-xs font-semibold transition-colors",
                        activo
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background text-foreground hover:bg-muted/70",
                      )}
                      onClick={() => setUbicacionVivienda(op)}
                    >
                      {op}
                    </button>
                  );
                })}
              </div>
              {ubicacionVivienda === "Otro" ? (
                <Input
                  placeholder="Estado"
                  value={ubicacionOtro}
                  onChange={(e) => setUbicacionOtro(e.target.value)}
                  className="h-9 text-sm"
                />
              ) : null}
            </div>

            <div className="space-y-2">
              <FilaContador
                label="Miembros de la familia damnificados (incluyéndolo)"
                value={miembrosDamnificados}
                onChange={setMiembrosDamnificados}
              />
              <FilaContador
                label="Fallecidos confirmados"
                value={fallecidosCount}
                onChange={setFallecidosCount}
              />
              <FilaContador
                label="Desaparecidos"
                value={desaparecidosCount}
                onChange={setDesaparecidosCount}
              />
            </div>

            {fallecidosCount > 0 || desaparecidosCount > 0 ? (
              <div className="space-y-2">
                {!detalleAbierto ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setDetalleAbierto(true);
                      if (detallePerdidas.length === 0) {
                        setDetallePerdidas([nuevaPerdidaVacia()]);
                      }
                    }}
                  >
                    <Skull className="size-3.5" />
                    + Agregar detalle (opcional)
                  </Button>
                ) : (
                  <div className="space-y-2">
                    {detallePerdidas.map((f, i) => (
                      <div key={f.id} className="grid grid-cols-2 gap-1.5 rounded-md border p-2">
                        <Input
                          placeholder="Nombre aproximado"
                          value={f.nombre}
                          onChange={(e) =>
                            setDetallePerdidas((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)),
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <Select
                          value={f.parentesco}
                          onValueChange={(v) =>
                            setDetallePerdidas((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, parentesco: v } : x)),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PARENTESCOS_JEFE.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Edad aproximada"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={120}
                          value={f.edad_aproximada ?? ""}
                          onChange={(e) =>
                            setDetallePerdidas((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, edad_aproximada: e.target.value ? Number(e.target.value) : null }
                                  : x,
                              ),
                            )
                          }
                          className="h-8 text-xs"
                        />
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={f.estado}
                            onValueChange={(v) =>
                              setDetallePerdidas((prev) =>
                                prev.map((x, j) =>
                                  j === i ? { ...x, estado: v as FamiliarSeparado["estado"] } : x,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 flex-1 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fallecido">Fallecido</SelectItem>
                              <SelectItem value="desaparecido">Desaparecido</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-rose-400"
                            onClick={() =>
                              setDetallePerdidas((prev) => prev.filter((_, j) => j !== i))
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDetallePerdidas((prev) => [...prev, nuevaPerdidaVacia()])}
                    >
                      <Plus className="size-3.5" />
                      Agregar otro
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  El censo es válido solo con el conteo de arriba; este detalle es opcional.
                </p>
              </div>
            ) : null}

            <Button
              className="w-full"
              disabled={
                guardando ||
                !estatusVivienda ||
                (!hayHogar && hayDuplicadoSinConfirmar)
              }
              onClick={hayHogar ? onGuardarDamnificacion : onCrearHogar}
            >
              {guardando ? <Loader2 className="size-4 animate-spin" /> : <Home className="size-4" />}
              {hayHogar
                ? "Guardar damnificación"
                : estadoNominal?.esJefeAqui
                  ? "Verificar y reanudar su hogar"
                  : "Verificar y crear hogar"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {hayHogar ? (
        <AlertDialog>
          <AlertDialogTrigger
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground shadow-md transition-colors",
              "hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Home className="size-4 shrink-0" />
            Cerrar hogar e iniciar otro
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar este hogar?</AlertDialogTitle>
              <AlertDialogDescription>
                Sale del hogar en curso para empezar otro. Los miembros ya
                registrados en la base nominal no se borran.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir aquí</AlertDialogCancel>
              <AlertDialogAction onClick={cerrarHogar}>
                Cerrar e iniciar otro
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      <AlertDialog
        open={eliminarMiembro != null}
        onOpenChange={(abierto) => {
          if (!abierto && !eliminandoMiembro) setEliminarMiembro(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar del hogar?</AlertDialogTitle>
            <AlertDialogDescription>
              {eliminarMiembro
                ? `Se quitará a ${eliminarMiembro.nombre} de este hogar (egreso por corrección de censo).`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={eliminandoMiembro}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={eliminandoMiembro}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminarMiembro();
              }}
            >
              {eliminandoMiembro ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Quitando…
                </>
              ) : (
                "Quitar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
