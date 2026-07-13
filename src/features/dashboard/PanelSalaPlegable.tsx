// Panel plegable de la sala situacional: abierto = card con scroll;
// cerrado = franja estrecha con conteos + nombre vertical.
// Persistencia en localStorage bajo `sala.paneles.<id>`.

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const PREFIJO_LS = "sala.paneles.";

function leerAbierto(id: string, defecto: boolean): boolean {
  try {
    const raw = localStorage.getItem(PREFIJO_LS + id);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return defecto;
}

function guardarAbierto(id: string, abierto: boolean) {
  try {
    localStorage.setItem(PREFIJO_LS + id, abierto ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export type TonoConteoPlegado = "ok" | "warn" | "danger" | "neutral";

export interface ItemConteoPlegado {
  valor: number;
  tono: TonoConteoPlegado;
  /** Tooltip / accesible. */
  label: string;
}

/** Franja plegada: primero números (verde/ámbar/rojo), después nombre vertical. */
export function ResumenPlegadoSala({
  nombre,
  items,
}: {
  nombre: string;
  items: ItemConteoPlegado[];
}) {
  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-hidden py-0.5">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        {items.map((item) => (
          <span
            key={item.label}
            title={`${item.label}: ${item.valor}`}
            className={cn(
              "flex size-7 items-center justify-center rounded-md border text-[11px] font-bold tabular-nums",
              item.tono === "ok" &&
                "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
              item.tono === "warn" &&
                "border-amber-500/60 bg-amber-500/15 text-amber-300",
              item.tono === "danger" &&
                "border-red-500/60 bg-red-500/15 text-red-300",
              item.tono === "neutral" &&
                "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            {item.valor}
          </span>
        ))}
      </div>
      <span
        className="min-h-0 flex-1 select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        {nombre}
      </span>
    </div>
  );
}

interface Props {
  id: string;
  titulo: string;
  /** Abreviado para la franja plegada (si no hay resumenPlegado). */
  tituloCorto?: string;
  badge?: number | string | null;
  /** Contenido custom de la franja plegada (reemplaza badge suelto). */
  resumenPlegado?: ReactNode;
  /** Por defecto abierto. */
  defectoAbierto?: boolean;
  /**
   * Contenido que llena la altura (gráficos). Sin scroll interno;
   * el hijo debe usar flex/`min-h-0`.
   */
  contenidoFlexible?: boolean;
  className?: string;
  children: ReactNode;
}

export function PanelSalaPlegable({
  id,
  titulo,
  tituloCorto,
  badge,
  resumenPlegado,
  defectoAbierto = true,
  contenidoFlexible = false,
  className,
  children,
}: Props) {
  const [abierto, setAbierto] = useState(() => leerAbierto(id, defectoAbierto));

  useEffect(() => {
    guardarAbierto(id, abierto);
  }, [id, abierto]);

  const badgeVisible =
    badge != null && badge !== "" && badge !== 0 ? String(badge) : null;

  return (
    <Collapsible
      open={abierto}
      onOpenChange={setAbierto}
      className={cn(
        "min-h-0 transition-[flex-basis,width] duration-200",
        abierto ? "min-w-[12rem] flex-1" : "w-11 shrink-0",
        className,
      )}
    >
      {abierto ? (
        <Card className="flex h-full min-h-0 flex-col gap-2 py-3">
          <CardHeader className="shrink-0 pb-0">
            <CardTitle className="flex items-center justify-between gap-2 text-sm lg:text-base">
              <span className="truncate">{titulo}</span>
              <span className="flex shrink-0 items-center gap-1">
                {badgeVisible && (
                  <Badge variant="outline" className="text-[10px]">
                    {badgeVisible}
                  </Badge>
                )}
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Plegar ${titulo}`}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                </CollapsibleTrigger>
              </span>
            </CardTitle>
          </CardHeader>
          <CollapsibleContent className="min-h-0 flex-1 overflow-hidden">
            <CardContent
              className={cn(
                "h-full max-h-full pt-0",
                contenidoFlexible
                  ? "flex min-h-0 flex-col overflow-hidden"
                  : "overflow-y-auto",
              )}
            >
              {children}
            </CardContent>
          </CollapsibleContent>
        </Card>
      ) : (
        <div className="flex h-full min-h-0 w-11 flex-col items-center rounded-xl border border-border bg-card py-2 shadow-sm">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Expandir ${titulo}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </CollapsibleTrigger>
          {resumenPlegado ?? (
            <span
              className="mt-3 flex-1 select-none text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              {tituloCorto ?? titulo}
            </span>
          )}
        </div>
      )}
    </Collapsible>
  );
}
