// Portal público de trabajo en terreno (/terreno, sin login): una sola URL
// para repartir a los funcionarios. Accesos activos: Reporte, Geolocalización,
// Autoridades, Capacidad y Censo (registro nominal por cédula vía Nexus, ver
// /censo). Acepta ?centro=<id> / ?t=<token> para llegar ya apuntado a un
// campamento.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BedDouble,
  ClipboardList,
  Landmark,
  Loader2,
  LockKeyhole,
  MapPin,
  MapPinned,
  Moon,
  RefreshCw,
  Sun,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { SelectorCentroLista } from "@/features/censo/SelectorCentroLista";
import { ReporteInstrucciones } from "@/features/terreno/ReporteInstrucciones";
import { GeolocalizacionInstrucciones } from "@/features/terreno/GeolocalizacionInstrucciones";
import { GeolocalizacionCentroPanel } from "@/features/terreno/GeolocalizacionCentroPanel";
import { AutoridadesInstrucciones } from "@/features/terreno/AutoridadesInstrucciones";
import { AutoridadesTerrenoPanel } from "@/features/terreno/AutoridadesTerrenoPanel";
import { CapacidadInstrucciones } from "@/features/terreno/CapacidadInstrucciones";
import { CapacidadTerrenoPanel } from "@/features/terreno/CapacidadTerrenoPanel";
import { ContactoAnalistasTerreno } from "@/features/terreno/ContactoAnalistasTerreno";
import { InstalarAppTerreno } from "@/features/terreno/InstalarAppTerreno";
import { TerrenoBienvenida } from "@/features/terreno/TerrenoBienvenida";
import { listarCentrosCenso, obtenerCentroTerreno, type CentroCenso } from "@/data/reposCenso";
import {
  asegurarSesionTerreno,
  asegurarSesionTerrenoCedula,
  cerrarSesionTerreno,
} from "@/data/loginTerreno";
import {
  tareaTerrenoDeUrl,
  tokenTerrenoActual,
} from "@/lib/tokenTerreno";
import {
  INSTRUCCIONES_AUTORIDADES_KEY,
  INSTRUCCIONES_CAPACIDAD_KEY,
  INSTRUCCIONES_GEO_KEY,
  INSTRUCCIONES_REPORTE_KEY,
  debeMostrarInstrucciones,
  marcarInstruccionesVistas,
  restablecerInstruccionesVistas,
  setVerInstruccionesSiempre,
  verInstruccionesSiempre,
} from "@/lib/instruccionesCampo";
import { centroGeolocalizadoLocal } from "@/lib/geolocalizacionTerreno";
import {
  guardarTemaTerreno,
  temaTerrenoGuardado,
  type TemaTerreno,
} from "@/lib/temaTerreno";
import { formatearHoraActualizacionTerreno, maxTimestamp } from "@/lib/terrenoActualizacion";
import {
  actualizarAppCampo,
  type ProgresoActualizacionApp,
} from "@/lib/actualizarAppCampo";
import {
  cargarSesionOperadorTerreno,
  guardarSesionOperadorTerreno,
  olvidarSesionOperadorTerreno,
  type SesionOperadorTerreno,
} from "@/lib/terrenoFuncionario";
import { IdentificacionCedula } from "@/features/terreno/IdentificacionCedula";
import { SuscripcionesTerreno } from "@/features/terreno/SuscripcionesTerreno";
import { VincularTelegramTerreno } from "@/features/terreno/VincularTelegramTerreno";
import { claveDia } from "@/data/reposSupabase";
import { supabase } from "@/data/supabaseClient";
import { controlReportado, normalizarReporteControlDia } from "@/domain/controlReporte";
import {
  estadoReporteDia,
  eventosRevisados,
  normalizarReporte,
} from "@/domain/reporteDiario";
import { cn } from "@/lib/utils";

function centroDeLaUrl(): string {
  return new URLSearchParams(window.location.search).get("centro")?.trim() ?? "";
}

function urlReporteCentro(centroId: string): string {
  // Aterriza en el resumen del reporte (con «COPIAR REPORTE»); el formulario
  // se abre desde «Editar reporte».
  return `/centros/reportes/${encodeURIComponent(centroId)}?vista=reporte`;
}

function urlCensoCentro(centroId: string): string {
  // /censo es una ruta pública (antes del gate de sesión en App.tsx) que
  // resuelve su propio token/instrucciones; no hace falta abrir sesión antes
  // de navegar, a diferencia del Reporte. Conserva el token del QR.
  const token = tokenTerrenoActual();
  const params = new URLSearchParams();
  params.set("centro", centroId);
  if (token) params.set("t", token);
  return `/censo?${params.toString()}`;
}

function quitarTareaDeUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("tarea")) return;
  url.searchParams.delete("tarea");
  window.history.replaceState({}, "", url.toString());
}

const CLASE_BOTON_LISTA =
  "flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary active:bg-primary/10 disabled:cursor-not-allowed";

const CLASE_TITULO_TAREA = "block text-sm font-medium leading-tight text-foreground";
const CLASE_ESTADO_TAREA = "mt-0.5 block text-xs leading-snug text-muted-foreground";
const CLASE_ESTADO_PENDIENTE = "text-amber-800/90 dark:text-amber-200/90";

function LineaActualizacion({ ts }: { ts: number | null }) {
  const texto = formatearHoraActualizacionTerreno(ts);
  if (!texto) return null;
  return (
    <span className="mt-0.5 block text-[0.625rem] leading-tight tabular-nums text-muted-foreground/80">
      Act. {texto}
    </span>
  );
}

function BotonTareaTerreno({
  onClick,
  disabled,
  titulo,
  estado,
  actualizadoTs,
  icono,
  iconoCargando,
  pendiente,
}: {
  onClick: () => void;
  disabled?: boolean;
  titulo: string;
  estado: string;
  actualizadoTs?: number | null;
  icono: ReactNode;
  iconoCargando?: boolean;
  /** Resalta el estado en ámbar cuando falta completar la tarea. */
  pendiente?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(CLASE_BOTON_LISTA, disabled && "pointer-events-none opacity-70")}
    >
      <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
        {iconoCargando ? (
          <Loader2 className="size-8 animate-spin text-primary" />
        ) : (
          icono
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={CLASE_TITULO_TAREA}>{titulo}</span>
        <span className={cn(CLASE_ESTADO_TAREA, pendiente && CLASE_ESTADO_PENDIENTE)}>{estado}</span>
        <LineaActualizacion ts={actualizadoTs ?? null} />
      </span>
    </button>
  );
}

const CLASE_ICONO_TAREA = "size-8 text-primary";

type Pantalla =
  | "menu"
  | "bienvenida"
  | "identificacion"
  | "instrucciones-reporte"
  | "selector-reporte"
  | "instrucciones-geo"
  | "geolocalizar"
  | "instrucciones-autoridades"
  | "autoridades"
  | "instrucciones-capacidad"
  | "capacidad";

export function TerrenoView() {
  const centroParam = useMemo(centroDeLaUrl, []);
  // Token de terreno del QR (?t=): identifica y autoriza el campamento sin
  // usuario. Sin token, la lista completa solo carga si hay sesión (admin).
  const token = useMemo(tokenTerrenoActual, []);
  const [pantalla, setPantalla] = useState<Pantalla>("menu");
  const [centros, setCentros] = useState<CentroCenso[]>([]);
  const [cargandoCentros, setCargandoCentros] = useState(true);
  const [errorCentros, setErrorCentros] = useState("");
  const [centroReporteId, setCentroReporteId] = useState("");
  const [instruccionesSiempre, setInstruccionesSiempre] = useState(verInstruccionesSiempre);
  const [tema, setTema] = useState<TemaTerreno>(temaTerrenoGuardado);
  const [instruccionesRestablecidas, setInstruccionesRestablecidas] = useState(false);
  const [geolocalizado, setGeolocalizado] = useState(false);
  const [autoridadesOk, setAutoridadesOk] = useState(false);
  const [capacidadOk, setCapacidadOk] = useState(false);
  const [geoTs, setGeoTs] = useState<number | null>(null);
  const [autoridadesTs, setAutoridadesTs] = useState<number | null>(null);
  const [capacidadTs, setCapacidadTs] = useState<number | null>(null);
  const [operadorSesion, setOperadorSesion] = useState<SesionOperadorTerreno | null>(null);
  const [gateListo, setGateListo] = useState(false);
  const [actualizandoApp, setActualizandoApp] = useState(false);
  const [progresoApp, setProgresoApp] = useState<ProgresoActualizacionApp | null>(
    null,
  );
  const [reporteHoyCompleto, setReporteHoyCompleto] = useState<boolean | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [reporteTs, setReporteTs] = useState<number | null>(null);

  // Quita el marcador de cache-bust tras «Borrar caché y actualizar».
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("_act")) return;
    url.searchParams.delete("_act");
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    let cancelado = false;
    const carga = token
      ? obtenerCentroTerreno(token).then((centroDelToken) => {
          if (cancelado) return;
          if (centroDelToken) {
            setCentros([centroDelToken]);
            // Solo verde si este dispositivo ya guardó desde el flujo de terreno
            // (no por tener geom previo en catálogo/BD).
            setGeolocalizado(centroGeolocalizadoLocal(centroDelToken.id));
            // Verde solo si la BD tiene directorio / capacidad (no flag local stale).
            setAutoridadesOk(centroDelToken.autoridades_ok === true);
            setCapacidadOk(centroDelToken.capacidad_ok === true);
            setGeoTs(centroDelToken.geolocalizacion_ts ?? null);
            setAutoridadesTs(centroDelToken.autoridades_ts ?? null);
            setCapacidadTs(centroDelToken.capacidad_ts ?? null);
          } else {
            setErrorCentros(
              "El enlace o código QR no es válido o fue revocado. Solicite el vigente de su campamento.",
            );
          }
        })
      : listarCentrosCenso().then((lista) => {
          if (!cancelado) {
            setCentros(lista);
            const id = centroParam || lista[0]?.id || "";
            if (id) {
              setGeolocalizado(centroGeolocalizadoLocal(id));
              setAutoridadesOk(false);
              setCapacidadOk(false);
              setGeoTs(null);
              setAutoridadesTs(null);
              setCapacidadTs(null);
            }
          }
        });
    carga
      .catch((err) => {
        if (!cancelado)
          setErrorCentros(
            err instanceof Error && !err.message.includes("permission denied")
              ? err.message
              : "Acceso restringido: entre con el enlace o código QR de su campamento.",
          );
      })
      .finally(() => {
        if (!cancelado) setCargandoCentros(false);
      });
    return () => {
      cancelado = true;
    };
  }, [token, centroParam]);

  // Con token, el campamento es el del token; sin token, el enlace solo
  // arrastra el centro si existe en la red (evita propagar un id malformado
  // a la planilla o a la ficha del reporte).
  const centro = token ? centros[0] : centros.find((c) => c.id === centroParam);
  const centroValido = centro?.id ?? "";
  /** Progreso censo nominal vs parte (solo si hay meta del parte). */
  const censoResumen = useMemo(() => {
    if (!centro) return null;
    const parte = Math.max(0, Number(centro.parte_personas) || 0);
    if (parte <= 0) return null;
    const censados = Math.max(0, Number(centro.censados_personas) || 0);
    const pct = Math.min(100, Math.round((censados / parte) * 100));
    const faltan = Math.max(0, parte - censados);
    return { parte, censados, pct, faltan };
  }, [centro]);
  const censoCompleto = Boolean(censoResumen && censoResumen.faltan === 0);
  const censoTs = centro?.censo_ts ?? null;
  // Terminó la carga y no hay ningún campamento accesible: ni token válido ni
  // sesión autorizada. Desde este dispositivo no hay tarea posible.
  const accesoDenegado = !cargandoCentros && centros.length === 0;
  // Con QR: hay que identificarse antes del menú (usuarios temporales por persona).
  const requiereIdentificacion = Boolean(token && centroValido && !accesoDenegado);
  const hoyClave = useMemo(() => claveDia(Date.now()), []);
  const puedeConsultarReporte = Boolean(
    centroValido && gateListo && (!requiereIdentificacion || operadorSesion),
  );

  useEffect(() => {
    if (!puedeConsultarReporte || !centroValido) {
      setReporteHoyCompleto(null);
      setReporteTs(centro?.reporte_ts ?? null);
      setCargandoReporte(false);
      return;
    }
    let cancelado = false;
    setCargandoReporte(true);

    async function cargarEstadoReporte() {
      try {
        const [repRes, ctrlRes, snapRes, evtRes] = await Promise.all([
          supabase
            .from("reportes_centros")
            .select("*")
            .eq("centro_id", centroValido)
            .eq("dia", hoyClave)
            .maybeSingle(),
          supabase
            .from("reportes_control_dia")
            .select("*")
            .eq("centro_id", centroValido)
            .eq("dia", hoyClave)
            .maybeSingle(),
          supabase
            .from("ocupaciones_centros")
            .select("incidencias_salud, updated_at, ts")
            .eq("centro_id", centroValido)
            .eq("dia", hoyClave)
            .maybeSingle(),
          supabase
            .from("eventos_reportes")
            .select("id, updated_at, ts")
            .eq("centro_id", centroValido)
            .eq("dia", hoyClave),
        ]);
        if (cancelado) return;

        const reporte = repRes.data
          ? normalizarReporte({
              ...(repRes.data as Record<string, unknown>),
              centro_id: centroValido,
              dia: hoyClave,
            })
          : null;
        const control = ctrlRes.data
          ? normalizarReporteControlDia({
              ...(ctrlRes.data as Record<string, unknown>),
              centro_id: centroValido,
              dia: hoyClave,
            })
          : null;
        const snap = snapRes.data as {
          incidencias_salud?: number;
          updated_at?: number;
          ts?: number;
        } | null;
        const incidenciasSalud = Number(snap?.incidencias_salud ?? 0);
        const totalEventos = evtRes.data?.length ?? 0;
        const eventosTs = (evtRes.data ?? []).flatMap((e) => {
          const fila = e as { updated_at?: number; ts?: number };
          return [fila.updated_at, fila.ts];
        });
        setReporteTs(
          maxTimestamp(
            reporte?.updated_at,
            reporte?.salud_updated_at,
            reporte?.trabajos_updated_at,
            reporte?.requerimientos_updated_at,
            reporte?.eventos_updated_at,
            control?.updated_at,
            snap?.updated_at,
            snap?.ts,
            ...eventosTs,
            centro?.reporte_ts,
          ),
        );
        const estado = estadoReporteDia(reporte, Boolean(snapRes.data), {
          saludReportada:
            reporte?.salud_reportada === true || incidenciasSalud > 0,
          controlRevisado: controlReportado(control),
          trabajosRevisados: reporte?.trabajos_revisados ?? false,
          requerimientosRevisados: reporte?.requerimientos_revisados ?? false,
          eventosRevisados: eventosRevisados(reporte, totalEventos),
        });
        setReporteHoyCompleto(estado === "completo");
      } catch {
        if (!cancelado) setReporteHoyCompleto(null);
      } finally {
        if (!cancelado) setCargandoReporte(false);
      }
    }

    void cargarEstadoReporte();
    return () => {
      cancelado = true;
    };
  }, [puedeConsultarReporte, centroValido, hoyClave, centro?.reporte_ts]);

  const mostrarBienvenida =
    requiereIdentificacion && gateListo && !operadorSesion && pantalla === "bienvenida";
  const mostrarIdentificacion =
    requiereIdentificacion && gateListo && pantalla === "identificacion";

  // Restaurar identificación de esta pestaña o forzar bienvenida → identificación.
  useEffect(() => {
    if (cargandoCentros || accesoDenegado) return;
    if (!requiereIdentificacion) {
      setGateListo(true);
      return;
    }
    let cancelado = false;
    const guardada = cargarSesionOperadorTerreno(centroValido);
    if (!guardada) {
      setOperadorSesion(null);
      setGateListo(true);
      setPantalla("bienvenida");
      return;
    }
    // v3: identidad por cédula; legacy: funcionario self-declarado (sesiones
    // guardadas antes del cambio siguen funcionando hasta que expiren).
    const asegurar = guardada.cedula
      ? asegurarSesionTerrenoCedula(token, centroValido, {
          cedula: guardada.cedula,
          letra: guardada.letra ?? "V",
          jerarquia: guardada.funcionario.jerarquia || "Otro",
        })
      : asegurarSesionTerreno(token, centroValido, guardada.funcionario);
    void asegurar
      .then(() => {
        if (cancelado) return;
        setOperadorSesion(guardada);
        setGateListo(true);
        setPantalla((p) => (p === "identificacion" ? "menu" : p));
      })
      .catch(() => {
        if (cancelado) return;
        olvidarSesionOperadorTerreno();
        setOperadorSesion(null);
        setGateListo(true);
        setPantalla("bienvenida");
      });
    return () => {
      cancelado = true;
    };
  }, [cargandoCentros, accesoDenegado, requiereIdentificacion, centroValido, token]);

  const [entrando, setEntrando] = useState(false);
  const [errorEntrar, setErrorEntrar] = useState("");
  // Evita reabrir la misma ?tarea= si el usuario vuelve al menú en esta carga.
  const [tareaDeepLinkConsumida, setTareaDeepLinkConsumida] = useState(false);

  /** El operador terminó la identificación por cédula (sesión ya emitida). */
  function alIdentificarse(resultado: {
    username: string;
    nombre: string;
    cedula: string;
    letra: "V" | "E";
    jerarquia: string;
    institucion: string;
    verificado_nexus: boolean;
  }) {
    const sesion: SesionOperadorTerreno = {
      centroId: centroValido,
      username: resultado.username,
      funcionario: {
        jerarquia: resultado.jerarquia,
        nombre: resultado.nombre,
        institucion: resultado.institucion,
        telefono: "",
      },
      cedula: resultado.cedula,
      letra: resultado.letra,
      verificadoNexus: resultado.verificado_nexus,
    };
    guardarSesionOperadorTerreno(sesion);
    setOperadorSesion(sesion);
    setPantalla("menu");
  }

  async function cambiarOperador() {
    olvidarSesionOperadorTerreno();
    setOperadorSesion(null);
    try {
      await cerrarSesionTerreno();
    } catch {
      /* seguir al formulario aunque falle el signOut */
    }
    setPantalla("bienvenida");
  }

  /**
   * Tras las instrucciones (o si ya se vieron): al reporte del centro del
   * enlace, o al selector. Con token del QR primero se canjea por la sesión
   * del operador del campamento (Edge Function `login-terreno`); así el
   * funcionario entra directo, sin usuario ni contraseña.
   */
  async function seguirAlReporte() {
    if (!centroValido) {
      setPantalla("selector-reporte");
      return;
    }
    const destino = urlReporteCentro(centroValido);
    if (!token) {
      window.location.href = destino;
      return;
    }
    setEntrando(true);
    setErrorEntrar("");
    try {
      if (operadorSesion?.cedula) {
        await asegurarSesionTerrenoCedula(token, centroValido, {
          cedula: operadorSesion.cedula,
          letra: operadorSesion.letra ?? "V",
          jerarquia: operadorSesion.funcionario.jerarquia || "Otro",
        });
      } else {
        await asegurarSesionTerreno(token, centroValido, operadorSesion?.funcionario);
      }
      window.location.href = destino;
    } catch (err) {
      setErrorEntrar(
        err instanceof Error ? err.message : "No se pudo entrar al reporte. Intente de nuevo.",
      );
      setEntrando(false);
      setPantalla("menu");
    }
  }

  function abrirReporte() {
    if (debeMostrarInstrucciones(INSTRUCCIONES_REPORTE_KEY)) setPantalla("instrucciones-reporte");
    else void seguirAlReporte();
  }

  function abrirGeolocalizacion() {
    if (!centroValido) {
      setErrorEntrar("Abra el enlace o código QR de su campamento para geolocalizarlo.");
      return;
    }
    if (debeMostrarInstrucciones(INSTRUCCIONES_GEO_KEY)) setPantalla("instrucciones-geo");
    else setPantalla("geolocalizar");
  }

  function abrirAutoridades() {
    if (!centroValido) {
      setErrorEntrar("Abra el enlace o código QR de su campamento para registrar autoridades.");
      return;
    }
    if (debeMostrarInstrucciones(INSTRUCCIONES_AUTORIDADES_KEY)) {
      setPantalla("instrucciones-autoridades");
    } else {
      setPantalla("autoridades");
    }
  }

  function abrirCapacidad() {
    if (!centroValido) {
      setErrorEntrar("Abra el enlace o código QR de su campamento para registrar la capacidad.");
      return;
    }
    if (debeMostrarInstrucciones(INSTRUCCIONES_CAPACIDAD_KEY)) {
      setPantalla("instrucciones-capacidad");
    } else {
      setPantalla("capacidad");
    }
  }

  function abrirCenso() {
    if (!centroValido) {
      setErrorEntrar("Abra el enlace o código QR de su campamento para acceder al censo.");
      return;
    }
    // /censo maneja sus propias instrucciones y token de sesión al llegar.
    window.location.href = urlCensoCentro(centroValido);
  }

  // Deep-link desde el sidebar de la app (?tarea=): tras identificar al
  // operador, abre la tarea pedida y limpia el query para no reabrirla.
  useEffect(() => {
    if (tareaDeepLinkConsumida || !gateListo || cargandoCentros || accesoDenegado) return;
    if (requiereIdentificacion && !operadorSesion) return;
    if (pantalla !== "menu") return;

    const tarea = tareaTerrenoDeUrl();
    if (!tarea) {
      setTareaDeepLinkConsumida(true);
      return;
    }

    quitarTareaDeUrl();
    setTareaDeepLinkConsumida(true);

    if (tarea === "reporte") abrirReporte();
    else if (tarea === "geo") abrirGeolocalizacion();
    else if (tarea === "autoridades") abrirAutoridades();
    else if (tarea === "capacidad") abrirCapacidad();
    else if (tarea === "censo") abrirCenso();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desbloquear el menú
  }, [
    tareaDeepLinkConsumida,
    gateListo,
    cargandoCentros,
    accesoDenegado,
    requiereIdentificacion,
    operadorSesion,
    pantalla,
  ]);

  const estadoReporteTerreno = useMemo(() => {
    if (entrando) return "Abriendo el parte…";
    if (cargandoCentros || cargandoReporte) return "Consultando estado…";
    if (reporteHoyCompleto) return "Parte de hoy listo";
    if (reporteTs ?? centro?.reporte_ts) return "En curso · faltan fases por cerrar";
    return "Aún sin reporte de hoy";
  }, [
    entrando,
    cargandoCentros,
    cargandoReporte,
    reporteHoyCompleto,
    reporteTs,
    centro?.reporte_ts,
  ]);

  const estadoCensoTerreno = useMemo(() => {
    if (cargandoCentros) return "Consultando estado…";
    if (censoCompleto && censoResumen) {
      return `${censoResumen.censados.toLocaleString("es")} de ${censoResumen.parte.toLocaleString("es")} personas · al día`;
    }
    if (censoResumen) {
      return `${censoResumen.censados.toLocaleString("es")} de ${censoResumen.parte.toLocaleString("es")} personas · faltan ${censoResumen.faltan.toLocaleString("es")}`;
    }
    if (!centro?.parte_personas) return "Por cédula · aún no hay parte del día";
    return "Por cédula · registre damnificados del campamento";
  }, [cargandoCentros, censoCompleto, censoResumen, centro?.parte_personas]);

  const estadoGeoTerreno = geolocalizado
    ? "Campamento ubicado en el mapa"
    : "Falta marcar la ubicación con GPS";

  const estadoAutoridadesTerreno = autoridadesOk
    ? "Directorio del campamento registrado"
    : "Falta registrar ente, política y seguridad";

  const estadoCapacidadTerreno = capacidadOk
    ? "Aforo y recursos registrados"
    : "Falta registrar camas, agua y baños";

  const reportePendiente =
    !entrando && !cargandoCentros && !cargandoReporte && reporteHoyCompleto !== true;
  const censoPendiente = !cargandoCentros && !censoCompleto;

  function cambiarTema(claro: boolean) {
    const nuevo: TemaTerreno = claro ? "claro" : "oscuro";
    guardarTemaTerreno(nuevo);
    setTema(nuevo);
  }

  function cambiarInstruccionesSiempre(valor: boolean) {
    setVerInstruccionesSiempre(valor);
    setInstruccionesSiempre(valor);
  }

  function restablecerInstrucciones() {
    restablecerInstruccionesVistas();
    setInstruccionesRestablecidas(true);
  }

  async function forzarActualizacionApp() {
    if (actualizandoApp) return;
    setActualizandoApp(true);
    setProgresoApp({
      porcentaje: 0,
      paso: "service_worker",
      etiqueta: "Preparando…",
    });
    try {
      await actualizarAppCampo(setProgresoApp);
    } catch {
      setActualizandoApp(false);
      setProgresoApp(null);
      setErrorEntrar(
        "No se pudo limpiar la caché. Cierre la app y ábrala de nuevo desde el enlace.",
      );
    }
  }

  if (requiereIdentificacion && !gateListo) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando acceso…</p>
      </div>
    );
  }

  if (mostrarBienvenida) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="mx-auto flex w-full max-w-xl shrink-0 flex-col gap-1 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <h1 className="text-base font-semibold leading-tight">Bienvenida</h1>
          <p className="text-xs text-muted-foreground">
            Lea las indicaciones antes de continuar
          </p>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <TerrenoBienvenida
            nombreCentro={centro?.nombre ?? "campamento"}
            onContinuar={() => setPantalla("identificacion")}
          />
        </main>
      </div>
    );
  }

  if (mostrarIdentificacion) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="mx-auto flex w-full max-w-xl shrink-0 flex-col gap-1 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <h1 className="text-base font-semibold leading-tight">Identificación</h1>
          <p className="text-xs text-muted-foreground">
            Identifíquese con su cédula antes de continuar
          </p>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <IdentificacionCedula
            token={token}
            centroNombre={centro?.nombre ?? "campamento"}
            centroCuerpo={centro?.cuerpo ?? ""}
            centroUnidad={centro?.unidad ?? ""}
            onIdentificado={alIdentificarse}
          />
        </main>
      </div>
    );
  }

  if (pantalla !== "menu") {
    const esInstruccionesReporte = pantalla === "instrucciones-reporte";
    const esInstruccionesGeo = pantalla === "instrucciones-geo";
    const esInstruccionesAut = pantalla === "instrucciones-autoridades";
    const esInstruccionesCap = pantalla === "instrucciones-capacidad";
    const esGeo = pantalla === "geolocalizar" || esInstruccionesGeo;
    const esAut = pantalla === "autoridades" || esInstruccionesAut;
    const esCap = pantalla === "capacidad" || esInstruccionesCap;
    const titulo = esCap
      ? "Capacidad"
      : esAut
        ? "Autoridades"
        : esGeo
          ? "Geolocalizar"
          : "Reporte";
    const subtitulo = esInstruccionesReporte
      ? "Cómo llenar el parte del campamento"
      : esInstruccionesGeo
        ? "Cómo ubicar el campamento con el GPS"
        : esInstruccionesAut
          ? "Cómo registrar el directorio del campamento"
          : esInstruccionesCap
            ? "Cómo registrar aforo y recursos Esfera"
            : pantalla === "geolocalizar"
              ? "Confirme el pin y guarde"
              : pantalla === "autoridades"
                ? "Ente encargado, Política, Seguridad, Salud y Justicia"
                : pantalla === "capacidad"
                  ? "Aforo oficial y recursos del campamento"
                  : "Seleccione el campamento que va a reportar";

    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <header className="mx-auto flex w-full max-w-xl shrink-0 items-center gap-2 px-4 pb-3 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setPantalla("menu")}
            aria-label="Volver al inicio"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent active:bg-accent"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">{titulo}</h1>
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          </div>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {esInstruccionesReporte ? (
            <ReporteInstrucciones
              onContinuar={() => {
                marcarInstruccionesVistas(INSTRUCCIONES_REPORTE_KEY);
                void seguirAlReporte();
              }}
            />
          ) : esInstruccionesGeo ? (
            <GeolocalizacionInstrucciones
              nombreCentro={centro?.nombre}
              onContinuar={() => {
                marcarInstruccionesVistas(INSTRUCCIONES_GEO_KEY);
                setPantalla("geolocalizar");
              }}
            />
          ) : esInstruccionesAut ? (
            <AutoridadesInstrucciones
              nombreCentro={centro?.nombre}
              onContinuar={() => {
                marcarInstruccionesVistas(INSTRUCCIONES_AUTORIDADES_KEY);
                setPantalla("autoridades");
              }}
            />
          ) : esInstruccionesCap ? (
            <CapacidadInstrucciones
              nombreCentro={centro?.nombre}
              onContinuar={() => {
                marcarInstruccionesVistas(INSTRUCCIONES_CAPACIDAD_KEY);
                setPantalla("capacidad");
              }}
            />
          ) : pantalla === "geolocalizar" && centroValido ? (
            <GeolocalizacionCentroPanel
              centroId={centroValido}
              centroNombre={centro?.nombre ?? "campamento"}
              token={token}
              onGuardado={(actualizadoAt) => {
                setGeolocalizado(true);
                setGeoTs(actualizadoAt);
                setPantalla("menu");
              }}
            />
          ) : pantalla === "autoridades" && centroValido ? (
            <AutoridadesTerrenoPanel
              centroId={centroValido}
              centroNombre={centro?.nombre ?? "campamento"}
              token={token}
              onGuardado={(tieneDirectorio, actualizadoAt) => {
                setAutoridadesOk(tieneDirectorio);
                if (tieneDirectorio) setAutoridadesTs(actualizadoAt);
              }}
            />
          ) : pantalla === "capacidad" && centroValido ? (
            <CapacidadTerrenoPanel
              centroId={centroValido}
              centroNombre={centro?.nombre ?? "campamento"}
              token={token}
              onGuardado={(tieneCapacidad, actualizadoAt) => {
                setCapacidadOk(tieneCapacidad);
                if (tieneCapacidad) setCapacidadTs(actualizadoAt);
              }}
            />
          ) : (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden py-4">
                <SelectorCentroLista
                  centros={centros}
                  centroId={centroReporteId}
                  cargando={cargandoCentros}
                  onSelect={(id) => {
                    setCentroReporteId(id);
                    window.location.href = urlReporteCentro(id);
                  }}
                  onContinuar={() => {}}
                />
                {errorCentros && <p className="mt-2 text-xs text-destructive">{errorCentros}</p>}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10 text-foreground">
      <main className="flex w-full max-w-md flex-col items-center gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-3xl"
          >
            ⛺
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Reportes en el terreno</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Campamentos Transitorios — Caracas
            </p>
          </div>
          {(token !== "" || centroParam !== "") && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                centro
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {cargandoCentros ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MapPin className="size-3.5" aria-hidden="true" />
              )}
              <span className="max-w-64 truncate">
                {cargandoCentros
                  ? "Identificando campamento…"
                  : (centro?.nombre ?? "Campamento no reconocido")}
              </span>
            </div>
          )}
          {errorEntrar && (
            <p className="max-w-xs text-xs leading-snug text-destructive">{errorEntrar}</p>
          )}
          {operadorSesion && (
            <div className="flex w-full max-w-sm flex-col items-center gap-1.5 rounded-xl border border-border bg-card/60 px-3 py-2">
              <p className="truncate text-center text-xs text-muted-foreground">
                Operando como{" "}
                <span className="font-medium text-foreground">
                  {operadorSesion.funcionario.nombre}
                </span>
                {operadorSesion.funcionario.jerarquia
                  ? ` · ${operadorSesion.funcionario.jerarquia}`
                  : ""}
              </p>
              {operadorSesion.cedula && <VincularTelegramTerreno />}
              <button
                type="button"
                onClick={() => void cambiarOperador()}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Otra persona / cambiar operador
              </button>
            </div>
          )}
          {operadorSesion?.cedula && (
            <div className="w-full max-w-sm rounded-xl border border-border bg-card/60 px-3 py-3">
              <SuscripcionesTerreno
                centroActualId={centroValido || undefined}
                onDesuscrito={(restantes, quitado) => {
                  const perdioActual =
                    quitado === null ||
                    (Boolean(centroValido) && !restantes.includes(centroValido));
                  if (perdioActual) void cambiarOperador();
                }}
              />
            </div>
          )}
        </header>

        {accesoDenegado ? (
          // Sin token válido y sin sesión no hay a dónde avanzar: en lugar de
          // botones que terminan en pantallas vacías, se explica cómo entrar.
          <section
            aria-label="Acceso restringido"
            className="w-full space-y-3 rounded-2xl border border-border bg-card p-6 text-center"
          >
            <LockKeyhole className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold">Acceso con código QR</p>
            {errorCentros && (
              <p className="text-xs leading-snug text-destructive">{errorCentros}</p>
            )}
            <p className="text-xs leading-snug text-muted-foreground">
              Cada campamento tiene su propio enlace y código QR. Solicítelo a la coordinación de
              la red (o al supervisor de su campamento) y vuelva a abrirlo desde ahí. Si es
              personal de coordinación, entre a la aplicación con su usuario.
            </p>
          </section>
        ) : (
          <nav aria-label="Tareas de terreno" className="flex w-full flex-col gap-2">
            <BotonTareaTerreno
              onClick={abrirReporte}
              disabled={entrando || cargandoCentros}
              titulo="Reporte Diario"
              estado={estadoReporteTerreno}
              actualizadoTs={reporteTs ?? centro?.reporte_ts ?? null}
              icono={<ClipboardList className={CLASE_ICONO_TAREA} />}
              iconoCargando={entrando}
              pendiente={reportePendiente}
            />
            <BotonTareaTerreno
              onClick={abrirCenso}
              disabled={cargandoCentros || !centroValido}
              titulo="Censo"
              estado={estadoCensoTerreno}
              actualizadoTs={censoTs}
              icono={<Users className={CLASE_ICONO_TAREA} />}
              pendiente={censoPendiente}
            />
            <BotonTareaTerreno
              onClick={abrirGeolocalizacion}
              disabled={cargandoCentros || !centroValido}
              titulo="Geolocalizar"
              estado={estadoGeoTerreno}
              actualizadoTs={geoTs}
              icono={<MapPinned className={CLASE_ICONO_TAREA} />}
              pendiente={!geolocalizado}
            />
            <BotonTareaTerreno
              onClick={abrirAutoridades}
              disabled={cargandoCentros || !centroValido}
              titulo="Autoridades"
              estado={estadoAutoridadesTerreno}
              actualizadoTs={autoridadesTs}
              icono={<Landmark className={CLASE_ICONO_TAREA} />}
              pendiente={!autoridadesOk}
            />
            <BotonTareaTerreno
              onClick={abrirCapacidad}
              disabled={cargandoCentros || !centroValido}
              titulo="Capacidad"
              estado={estadoCapacidadTerreno}
              actualizadoTs={capacidadTs}
              icono={<BedDouble className={CLASE_ICONO_TAREA} />}
              pendiente={!capacidadOk}
            />
          </nav>
        )}

        <InstalarAppTerreno />

        {!accesoDenegado && (
          <section
            aria-label="Actualizar aplicación"
            className="w-full space-y-3 rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 py-3.5"
          >
            <div className="flex items-start gap-3">
              <RefreshCw
                className="mt-0.5 size-8 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  ¿No ve cambios recientes?
                </p>
                <p className="mt-0.5 text-xs leading-snug text-amber-950/80 dark:text-amber-100/80">
                  La app se actualiza varias veces al día. Si algo se ve desactualizado,
                  actualice antes de reportar o censar.
                </p>
              </div>
            </div>
            {actualizandoApp && progresoApp ? (
              <div
                className="space-y-2"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {progresoApp.etiqueta}
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {progresoApp.porcentaje}%
                  </span>
                </div>
                <Progress
                  value={progresoApp.porcentaje}
                  className="h-2"
                  aria-label={`Progreso de actualización: ${progresoApp.porcentaje}%`}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void forzarActualizacionApp()}
                disabled={actualizandoApp}
                className={cn(
                  "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-600/50 bg-amber-600 text-sm font-medium text-white shadow-sm transition-colors",
                  "hover:bg-amber-700 active:bg-amber-800 disabled:opacity-60 dark:border-amber-500/50 dark:bg-amber-600 dark:hover:bg-amber-500",
                )}
              >
                <RefreshCw className="size-4" />
                Borrar caché y actualizar
              </button>
            )}
          </section>
        )}

        {!accesoDenegado && centroValido && (
          <ContactoAnalistasTerreno analistas={centro?.analistas_contacto} />
        )}

        <section
          aria-label="Tema de la pantalla"
          className="w-full space-y-2 rounded-xl border border-border bg-card/60 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {tema === "claro" ? (
                <Sun className="size-5 shrink-0 text-amber-500" aria-hidden="true" />
              ) : (
                <Moon className="size-5 shrink-0 text-primary" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">Modo claro</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  Fondo blanco para leer mejor a plena luz. La elección queda guardada en este
                  dispositivo.
                </p>
              </div>
            </div>
            <Switch
              checked={tema === "claro"}
              onCheckedChange={cambiarTema}
              aria-label="Activar modo claro"
            />
          </div>
        </section>

        {!accesoDenegado && (
          <section
            aria-label="Instrucciones de las planillas"
            className="w-full space-y-2 rounded-xl border border-border bg-card/60 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Ver instrucciones cada vez</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  Muestra las pantallas de instrucciones del reporte, geolocalización, autoridades
                  y capacidad en cada entrada.
                </p>
              </div>
              <Switch
                checked={instruccionesSiempre}
                onCheckedChange={cambiarInstruccionesSiempre}
                aria-label="Ver instrucciones cada vez"
              />
            </div>
            {!instruccionesSiempre && (
              <button
                type="button"
                onClick={restablecerInstrucciones}
                disabled={instruccionesRestablecidas}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {instruccionesRestablecidas
                  ? "Listo: volverán a salir una vez en este dispositivo."
                  : "Volver a mostrar las instrucciones una vez"}
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
