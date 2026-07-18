// Indicador visual del estado del API Nexus (registro por cédula).
// Sondeo al montar / refrescar; también se actualiza si una búsqueda falla o revive.
// Compacto (una línea) para no comer pantalla en móvil: se expande con un
// toque y solo se abre solo cuando Nexus está caído o inestable.

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  consultarEstadoNexusApi,
  type EstadoNexusApi,
  type InformeEstadoNexus,
} from "@/data/reposNexus";
import { incidentesAbiertosPublico } from "@/data/reposEstadoServicios";
import {
  formatoDuracion,
  formatoHora,
  type IncidenteAbiertoPublico,
} from "@/domain/estadoServicios";
import { cn } from "@/lib/utils";

export type NexusEnLinea = boolean | null;

/** Señal desde una búsqueda real (no es un poll al health). */
export type SenalConsultaNexus = {
  ts: number;
  resultado: "ok" | "caida";
};

interface Props {
  /** Notifica si Nexus responde en línea (null = aún comprobando). */
  onEstado?: (enLinea: NexusEnLinea) => void;
  /** Actualiza el banner cuando una consulta por cédula confirma caída o recuperación. */
  senalConsulta?: SenalConsultaNexus | null;
  className?: string;
}

function informeDesdeSenal(resultado: "ok" | "caida"): InformeEstadoNexus {
  const now = Date.now();
  if (resultado === "ok") {
    return {
      estado: "online",
      gatewayOk: true,
      upstreamStatus: 200,
      checkedAt: now,
      cached: false,
      detail: "Confirmado por una consulta exitosa",
    };
  }
  return {
    estado: "offline",
    gatewayOk: true,
    upstreamStatus: 502,
    checkedAt: now,
    cached: false,
    detail: "Detectado por una consulta fallida",
  };
}

function aplicarEstado(
  r: InformeEstadoNexus,
  onEstado?: (enLinea: NexusEnLinea) => void,
) {
  if (r.estado === "online") onEstado?.(true);
  else if (r.estado === "offline" || r.estado === "degraded") onEstado?.(false);
  else onEstado?.(null);
}

function mensajeDe(informe: InformeEstadoNexus | null, cargando: boolean): {
  titulo: string;
  cuerpo: string;
  tono: "online" | "offline" | "degraded" | "checking" | "unknown";
} {
  if (cargando && !informe) {
    return {
      tono: "checking",
      titulo: "Comprobando Nexus…",
      cuerpo: "Verificando si el registro por cédula está disponible.",
    };
  }
  const estado = informe?.estado ?? "unknown";
  if (estado === "online") {
    return {
      tono: "online",
      titulo: "Nexus en línea",
      cuerpo:
        "Las búsquedas por cédula consultan el registro vivo. Las respuestas se guardan para reutilizarlas.",
    };
  }
  if (estado === "degraded") {
    return {
      tono: "degraded",
      titulo: "Servicios NEXUS/SAIME con fallas",
      cuerpo:
        "El registro de identidad está fallando: las búsquedas nuevas salen vacías aunque la cédula exista. Pause el censo por cédula e intente más tarde. Las cédulas ya consultadas (caché) sí funcionan.",
    };
  }
  if (estado === "offline") {
    return {
      tono: "offline",
      titulo: "Nexus fuera de línea",
      cuerpo:
        "El servidor del registro está caído. Puede usar cédulas ya consultadas (caché) o la planilla manual.",
    };
  }
  return {
    tono: "unknown",
    titulo: "Estado de Nexus desconocido",
    cuerpo:
      "No se pudo comprobar el servicio. Intente de nuevo o use la planilla manual.",
  };
}

export function EstadoNexusApi({ onEstado, senalConsulta, className }: Props) {
  const [informe, setInforme] = useState<InformeEstadoNexus | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState(false);

  const sondear = useCallback(
    async (force = false) => {
      setCargando(true);
      const r = await consultarEstadoNexusApi({ force });
      setInforme(r);
      setCargando(false);
      aplicarEstado(r, onEstado);
    },
    [onEstado],
  );

  // Solo al montar (y al pulsar refrescar). Sin intervalo: con muchos
  // censadores un poll periódico satura el API institucional.
  useEffect(() => {
    let cancel = false;
    (async () => {
      const r = await consultarEstadoNexusApi();
      if (cancel) return;
      setInforme(r);
      setCargando(false);
      aplicarEstado(r, onEstado);
    })();
    return () => {
      cancel = true;
    };
  }, [onEstado]);

  // Una búsqueda fallida/exitosa actualiza el banner sin otro hit a /health.
  useEffect(() => {
    if (!senalConsulta) return;
    const r = informeDesdeSenal(senalConsulta.resultado);
    setInforme(r);
    setCargando(false);
    aplicarEstado(r, onEstado);
  }, [senalConsulta, onEstado]);

  const msg = mensajeDe(informe, cargando);
  const estadoApi: EstadoNexusApi | "unknown" | "checking" =
    cargando && !informe ? "checking" : (informe?.estado ?? "unknown");

  // Caído/inestable/desconocido sí es vital (usar caché o planilla manual):
  // se abre solo. En línea se pliega para devolver la pantalla al censo.
  const requiereAtencion =
    msg.tono === "offline" || msg.tono === "degraded" || msg.tono === "unknown";
  useEffect(() => {
    setAbierto(requiereAtencion);
  }, [requiereAtencion]);

  // Con falla a la vista, buscar el incidente registrado por el vigilante:
  // "desde cuándo y cuánto lleva" deja claro que la caída es institucional,
  // ya está registrada y no hace falta reportarla.
  const [incidente, setIncidente] = useState<IncidenteAbiertoPublico | null>(null);
  useEffect(() => {
    if (!requiereAtencion) {
      setIncidente(null);
      return;
    }
    let cancel = false;
    void incidentesAbiertosPublico().then((lista) => {
      if (cancel) return;
      setIncidente(lista.find((i) => i.servicio === "nexus") ?? null);
    });
    return () => {
      cancel = true;
    };
  }, [requiereAtencion]);

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        msg.tono === "online" && "border-emerald-600/40 bg-emerald-600/10",
        msg.tono === "offline" && "border-destructive/40 bg-destructive/10",
        msg.tono === "degraded" && "border-amber-600/40 bg-amber-500/10",
        (msg.tono === "checking" || msg.tono === "unknown") && "bg-muted/50",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 pl-3 pr-1.5 py-1">
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <span
            className={cn(
              "inline-block size-2 shrink-0 rounded-full",
              estadoApi === "online" &&
                "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/30 animate-pulse",
              estadoApi === "offline" && "bg-destructive",
              estadoApi === "degraded" && "bg-amber-500 animate-pulse",
              (estadoApi === "checking" || estadoApi === "unknown") &&
                "bg-muted-foreground/50",
            )}
            aria-hidden
          />
          <span
            className={cn(
              "truncate text-xs font-medium",
              msg.tono === "online" && "text-emerald-950 dark:text-emerald-100",
              msg.tono === "offline" && "text-destructive",
              msg.tono === "degraded" && "text-amber-950 dark:text-amber-100",
            )}
          >
            {msg.titulo}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground/70 transition-transform",
              abierto && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0"
          disabled={cargando}
          title="Volver a comprobar"
          onClick={() => void sondear(true)}
        >
          {cargando ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          <span className="sr-only">Comprobar de nuevo</span>
        </Button>
      </div>
      {abierto ? (
        <p
          className={cn(
            "px-3 pb-2 text-xs leading-snug",
            msg.tono === "online" && "text-emerald-900/80 dark:text-emerald-100/80",
            msg.tono === "degraded" && "text-amber-900/80 dark:text-amber-100/80",
            msg.tono === "offline" && "text-destructive/90",
            (msg.tono === "checking" || msg.tono === "unknown") &&
              "text-muted-foreground",
          )}
        >
          {msg.cuerpo}
          {incidente ? (
            <>
              {" "}
              <span className="font-medium">
                Falla registrada desde las {formatoHora(incidente.inicio_ts)} (
                {formatoDuracion(Date.now() - incidente.inicio_ts)}).
              </span>{" "}
              Es una falla del sistema institucional, no de la plataforma; los
              analistas ya fueron notificados.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
