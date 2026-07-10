// Portal público de trabajo en terreno (/terreno, sin login): una sola URL
// para repartir a los funcionarios. Accesos activos: Reporte, Geolocalización,
// Autoridades y Capacidad. El Censo queda visible pero bloqueado. Acepta
// ?centro=<id> / ?t=<token> para llegar ya apuntado a un campamento.

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BedDouble,
  CheckCircle2,
  ClipboardList,
  Landmark,
  Loader2,
  LockKeyhole,
  MapPin,
  MapPinned,
  RefreshCw,
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
import { TerrenoBienvenida } from "@/features/terreno/TerrenoBienvenida";
import { listarCentrosCenso, obtenerCentroTerreno, type CentroCenso } from "@/data/reposCenso";
import type { FuncionarioCenso } from "@/data/reposCenso";
import { asegurarSesionTerreno, cerrarSesionTerreno } from "@/data/loginTerreno";
import { tokenTerrenoActual } from "@/lib/tokenTerreno";
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
import { formatearHoraActualizacionTerreno } from "@/lib/terrenoActualizacion";
import {
  actualizarAppCampo,
  type ProgresoActualizacionApp,
} from "@/lib/actualizarAppCampo";
import {
  cargarSesionOperadorTerreno,
  funcionarioTerrenoVacio,
  guardarSesionOperadorTerreno,
  olvidarSesionOperadorTerreno,
  type SesionOperadorTerreno,
} from "@/lib/terrenoFuncionario";
import { FormularioIdentificacionFuncionario } from "@/features/censo/FormularioIdentificacionFuncionario";
import { cn } from "@/lib/utils";

function centroDeLaUrl(): string {
  return new URLSearchParams(window.location.search).get("centro")?.trim() ?? "";
}

function urlReporteCentro(centroId: string): string {
  return `/centros/reportes/${encodeURIComponent(centroId)}?vista=reporte&reportar=1`;
}

const CLASE_BOTON_CUADRADO =
  "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary active:bg-primary/10";

function LineaActualizacion({
  ts,
  resaltar,
}: {
  ts: number | null;
  resaltar?: boolean;
}) {
  const texto = formatearHoraActualizacionTerreno(ts);
  if (!texto) return null;
  return (
    <span
      className={cn(
        "text-[0.625rem] leading-tight tabular-nums",
        resaltar
          ? "text-emerald-600/75 dark:text-emerald-400/75"
          : "text-muted-foreground/80",
      )}
    >
      Act. {texto}
    </span>
  );
}

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
  const [instruccionesRestablecidas, setInstruccionesRestablecidas] = useState(false);
  const [geolocalizado, setGeolocalizado] = useState(false);
  const [autoridadesOk, setAutoridadesOk] = useState(false);
  const [capacidadOk, setCapacidadOk] = useState(false);
  const [geoTs, setGeoTs] = useState<number | null>(null);
  const [autoridadesTs, setAutoridadesTs] = useState<number | null>(null);
  const [capacidadTs, setCapacidadTs] = useState<number | null>(null);
  const [operadorSesion, setOperadorSesion] = useState<SesionOperadorTerreno | null>(null);
  const [gateListo, setGateListo] = useState(false);
  const [funcionarioDraft, setFuncionarioDraft] = useState<FuncionarioCenso>(funcionarioTerrenoVacio);
  const [resaltarId, setResaltarId] = useState(false);
  const [identificando, setIdentificando] = useState(false);
  const [errorIdentificacion, setErrorIdentificacion] = useState("");
  const [actualizandoApp, setActualizandoApp] = useState(false);
  const [progresoApp, setProgresoApp] = useState<ProgresoActualizacionApp | null>(
    null,
  );

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
  // Terminó la carga y no hay ningún campamento accesible: ni token válido ni
  // sesión autorizada. Desde este dispositivo no hay tarea posible.
  const accesoDenegado = !cargandoCentros && centros.length === 0;
  // Con QR: hay que identificarse antes del menú (usuarios temporales por persona).
  const requiereIdentificacion = Boolean(token && centroValido && !accesoDenegado);
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
    setFuncionarioDraft(guardada.funcionario);
    void asegurarSesionTerreno(token, centroValido, guardada.funcionario)
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

  async function confirmarIdentificacion() {
    if (!token || !centroValido) return;
    setIdentificando(true);
    setErrorIdentificacion("");
    try {
      const resp = await asegurarSesionTerreno(token, centroValido, funcionarioDraft);
      const sesion: SesionOperadorTerreno = {
        centroId: centroValido,
        username: resp.username,
        funcionario: { ...funcionarioDraft },
      };
      guardarSesionOperadorTerreno(sesion);
      setOperadorSesion(sesion);
      setPantalla("menu");
    } catch (err) {
      setErrorIdentificacion(
        err instanceof Error ? err.message : "No se pudo registrar su acceso. Intente de nuevo.",
      );
    } finally {
      setIdentificando(false);
    }
  }

  async function cambiarOperador() {
    olvidarSesionOperadorTerreno();
    setOperadorSesion(null);
    setFuncionarioDraft(funcionarioTerrenoVacio());
    setResaltarId(false);
    setErrorIdentificacion("");
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
      await asegurarSesionTerreno(
        token,
        centroValido,
        operadorSesion?.funcionario,
      );
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
            Registre quién opera en este dispositivo antes de continuar
          </p>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <FormularioIdentificacionFuncionario
            funcionario={funcionarioDraft}
            onChange={setFuncionarioDraft}
            onConfirmar={confirmarIdentificacion}
            centroNombre={centro?.nombre ?? "campamento"}
            etiquetaContinuar="Confirmar e ingresar"
            cargando={identificando}
            error={errorIdentificacion}
            resaltarFaltantes={resaltarId}
            onResaltarFaltantes={() => setResaltarId(true)}
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
                {" · "}
                {operadorSesion.funcionario.institucion}
              </p>
              <button
                type="button"
                onClick={() => void cambiarOperador()}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Otra persona / cambiar operador
              </button>
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
          <nav aria-label="Tareas de terreno" className="grid w-full grid-cols-2 gap-4">
            <button
              type="button"
              onClick={abrirReporte}
              disabled={entrando || cargandoCentros}
              className={cn(
                CLASE_BOTON_CUADRADO,
                (entrando || cargandoCentros) && "pointer-events-none opacity-70",
              )}
            >
              {entrando ? (
                <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <ClipboardList className="size-10 text-primary" aria-hidden="true" />
              )}
              <span className="text-sm font-semibold">Reporte</span>
              <span className="flex items-center gap-1 text-[0.6875rem] leading-tight text-muted-foreground">
                <LockKeyhole className="size-3 shrink-0" aria-hidden="true" />
                {entrando
                  ? "Entrando al campamento…"
                  : cargandoCentros
                    ? "Verificando acceso…"
                    : token && centro
                      ? "Parte del día · entra con el QR"
                      : "Parte del día · con usuario"}
              </span>
            </button>

            <button
              type="button"
              onClick={abrirGeolocalizacion}
              disabled={cargandoCentros || !centroValido}
              className={cn(
                CLASE_BOTON_CUADRADO,
                geolocalizado &&
                  "border-emerald-500/45 bg-emerald-500/10 hover:border-emerald-500/60 hover:bg-emerald-500/15",
                (cargandoCentros || !centroValido) && "pointer-events-none opacity-70",
              )}
            >
              {geolocalizado ? (
                <CheckCircle2 className="size-10 text-emerald-500" aria-hidden="true" />
              ) : (
                <MapPinned className="size-10 text-primary" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "text-sm font-semibold",
                  geolocalizado && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {geolocalizado ? "Geolocalizado" : "Geolocalizar"}
              </span>
              <span
                className={cn(
                  "text-[0.6875rem] leading-tight",
                  geolocalizado ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-muted-foreground",
                )}
              >
                {geolocalizado ? "Ubicación guardada · puede actualizar" : "GPS del campamento"}
              </span>
              <LineaActualizacion ts={geoTs} resaltar={geolocalizado} />
            </button>

            <button
              type="button"
              onClick={abrirAutoridades}
              disabled={cargandoCentros || !centroValido}
              className={cn(
                CLASE_BOTON_CUADRADO,
                autoridadesOk &&
                  "border-emerald-500/45 bg-emerald-500/10 hover:border-emerald-500/60 hover:bg-emerald-500/15",
                (cargandoCentros || !centroValido) && "pointer-events-none opacity-70",
              )}
            >
              {autoridadesOk ? (
                <CheckCircle2 className="size-10 text-emerald-500" aria-hidden="true" />
              ) : (
                <Landmark className="size-10 text-primary" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "text-sm font-semibold",
                  autoridadesOk && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                Autoridades
              </span>
              <span
                className={cn(
                  "text-[0.6875rem] leading-tight",
                  autoridadesOk
                    ? "text-emerald-600/80 dark:text-emerald-400/80"
                    : "text-muted-foreground",
                )}
              >
                {autoridadesOk ? "Directorio guardado · puede editar" : "Ente encargado · Política · Seguridad…"}
              </span>
              <LineaActualizacion ts={autoridadesTs} resaltar={autoridadesOk} />
            </button>

            <button
              type="button"
              onClick={abrirCapacidad}
              disabled={cargandoCentros || !centroValido}
              className={cn(
                CLASE_BOTON_CUADRADO,
                capacidadOk &&
                  "border-emerald-500/45 bg-emerald-500/10 hover:border-emerald-500/60 hover:bg-emerald-500/15",
                (cargandoCentros || !centroValido) && "pointer-events-none opacity-70",
              )}
            >
              {capacidadOk ? (
                <CheckCircle2 className="size-10 text-emerald-500" aria-hidden="true" />
              ) : (
                <BedDouble className="size-10 text-primary" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "text-sm font-semibold",
                  capacidadOk && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                Capacidad
              </span>
              <span
                className={cn(
                  "text-[0.6875rem] leading-tight",
                  capacidadOk
                    ? "text-emerald-600/80 dark:text-emerald-400/80"
                    : "text-muted-foreground",
                )}
              >
                {capacidadOk ? "Aforo y recursos · puede editar" : "Cupo · camas · agua…"}
              </span>
              <LineaActualizacion ts={capacidadTs} resaltar={capacidadOk} />
            </button>

            <div
              role="button"
              aria-disabled="true"
              aria-label="Censo: acceso desactivado"
              className={cn(
                CLASE_BOTON_CUADRADO,
                "pointer-events-none cursor-not-allowed opacity-55 hover:border-border hover:bg-card",
              )}
            >
              <Users className="size-10 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-semibold text-muted-foreground">Censo</span>
              <span className="flex items-center gap-1 text-[0.6875rem] leading-tight text-muted-foreground">
                <LockKeyhole className="size-3 shrink-0" aria-hidden="true" />
                Acceso desactivado
              </span>
            </div>
          </nav>
        )}

        {!accesoDenegado && centroValido && (
          <ContactoAnalistasTerreno analistas={centro?.analistas_contacto} />
        )}

        {!accesoDenegado && (
          <p className="max-w-xs text-center text-xs text-muted-foreground">
            Guarde esta página en la pantalla de inicio para acceder más rápido durante la jornada.
          </p>
        )}

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

        {!accesoDenegado && (
          <section
            aria-label="Actualizar aplicación (opcional)"
            className="w-full space-y-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">
                Actualizar aplicación{" "}
                <span className="font-normal">(opcional)</span>
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                Solo si no ve cambios recientes. No es necesario al entrar por
                primera vez.
              </p>
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
                  "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors",
                  "hover:bg-accent disabled:opacity-60",
                )}
              >
                <RefreshCw className="size-4" />
                Borrar caché y actualizar
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
