// Portal público de trabajo en terreno (/terreno, sin login): una sola URL
// para repartir a los funcionarios, con dos accesos — el Reporte diario del
// campamento (app completa, requiere usuario) y el Censo de damnificados
// (planilla pública). Acepta ?centro=<id> para llegar ya apuntado a un
// campamento: el censo lo preselecciona y el reporte abre su ficha directo;
// sin centro en el enlace, "Reporte diario" muestra el mismo selector de
// campamentos que usa el censo antes de entrar a la app. La primera vez (por
// dispositivo) el reporte pasa antes por su pantalla de instrucciones, y el
// pie del menú permite restablecerlas o verlas siempre.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Loader2, LockKeyhole, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SelectorCentroLista } from "@/features/censo/SelectorCentroLista";
import { ReporteInstrucciones } from "@/features/terreno/ReporteInstrucciones";
import { listarCentrosCenso, type CentroCenso } from "@/data/reposCenso";
import {
  INSTRUCCIONES_REPORTE_KEY,
  debeMostrarInstrucciones,
  marcarInstruccionesVistas,
  restablecerInstruccionesVistas,
  setVerInstruccionesSiempre,
  verInstruccionesSiempre,
} from "@/lib/instruccionesCampo";
import { cn } from "@/lib/utils";

function centroDeLaUrl(): string {
  return new URLSearchParams(window.location.search).get("centro")?.trim() ?? "";
}

function urlReporteCentro(centroId: string): string {
  return `/centros/reportes/${encodeURIComponent(centroId)}?vista=reporte&reportar=1`;
}

const CLASE_BOTON_CUADRADO =
  "flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary active:bg-primary/10";

type Pantalla = "menu" | "instrucciones-reporte" | "selector-reporte";

export function TerrenoView() {
  const centroParam = useMemo(centroDeLaUrl, []);
  const [pantalla, setPantalla] = useState<Pantalla>("menu");
  const [centros, setCentros] = useState<CentroCenso[]>([]);
  const [cargandoCentros, setCargandoCentros] = useState(true);
  const [errorCentros, setErrorCentros] = useState("");
  const [centroReporteId, setCentroReporteId] = useState("");
  const [instruccionesSiempre, setInstruccionesSiempre] = useState(verInstruccionesSiempre);
  const [instruccionesRestablecidas, setInstruccionesRestablecidas] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarCentrosCenso()
      .then((lista) => {
        if (!cancelado) setCentros(lista);
      })
      .catch((err) => {
        if (!cancelado)
          setErrorCentros(
            err instanceof Error ? err.message : "No se pudo cargar la lista de campamentos",
          );
      })
      .finally(() => {
        if (!cancelado) setCargandoCentros(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const centro = centros.find((c) => c.id === centroParam);
  // El enlace solo arrastra el centro si existe en la red (evita propagar un
  // id malformado a la planilla o a la ficha del reporte).
  const centroValido = centro ? centroParam : "";
  const urlCenso = centroValido ? `/censo?centro=${encodeURIComponent(centroValido)}` : "/censo";

  /** Tras las instrucciones (o si ya se vieron): al reporte del centro del enlace, o al selector. */
  function seguirAlReporte() {
    if (centroValido) window.location.href = urlReporteCentro(centroValido);
    else setPantalla("selector-reporte");
  }

  function abrirReporte() {
    if (debeMostrarInstrucciones(INSTRUCCIONES_REPORTE_KEY)) setPantalla("instrucciones-reporte");
    else seguirAlReporte();
  }

  function cambiarInstruccionesSiempre(valor: boolean) {
    setVerInstruccionesSiempre(valor);
    setInstruccionesSiempre(valor);
  }

  function restablecerInstrucciones() {
    restablecerInstruccionesVistas();
    setInstruccionesRestablecidas(true);
  }

  if (pantalla !== "menu") {
    const esInstrucciones = pantalla === "instrucciones-reporte";
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
            <h1 className="text-base font-semibold leading-tight">Reporte diario</h1>
            <p className="text-xs text-muted-foreground">
              {esInstrucciones
                ? "Cómo llenar el parte del campamento"
                : "Seleccione el campamento que va a reportar"}
            </p>
          </div>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {esInstrucciones ? (
            <ReporteInstrucciones
              onContinuar={() => {
                marcarInstruccionesVistas(INSTRUCCIONES_REPORTE_KEY);
                seguirAlReporte();
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
                    // Marca la fila elegida (feedback inmediato) y sale a la app
                    // completa; el login aparece ahí si no hay sesión.
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
          {centroParam !== "" && (
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
        </header>

        <nav aria-label="Tareas de terreno" className="grid w-full grid-cols-2 gap-4">
          <button type="button" onClick={abrirReporte} className={CLASE_BOTON_CUADRADO}>
            <ClipboardList className="size-10 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold">Reporte diario</span>
            <span className="flex items-center gap-1 text-[0.6875rem] leading-tight text-muted-foreground">
              <LockKeyhole className="size-3 shrink-0" aria-hidden="true" />
              Parte del día · con usuario
            </span>
          </button>
          <a href={urlCenso} className={CLASE_BOTON_CUADRADO}>
            <Users className="size-10 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold">Censo</span>
            <span className="text-[0.6875rem] leading-tight text-muted-foreground">
              Registro de damnificados · sin clave
            </span>
          </a>
        </nav>

        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Guarde esta página en la pantalla de inicio para acceder más rápido durante la jornada.
        </p>

        <section
          aria-label="Instrucciones de las planillas"
          className="w-full space-y-2 rounded-xl border border-border bg-card/60 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Ver instrucciones cada vez</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Muestra las pantallas de instrucciones del censo y del reporte en cada entrada.
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
      </main>
    </div>
  );
}
