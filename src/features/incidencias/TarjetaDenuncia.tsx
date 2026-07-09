// Fila compacta de una denuncia/sugerencia del canal público (QR). Se usa en
// la bandeja global, el Buzón del campamento y la papelera (admin).

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Phone,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  CATEGORIAS_DENUNCIA,
  labelCategoriaDenuncia,
  type Denuncia,
} from "@/domain/denuncias";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fechaCorta(ts: number): string {
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TarjetaDenuncia({
  denuncia,
  nombreCentro,
  puedeResolver,
  onResolver,
  resolviendo,
  ocultarCentro = false,
  puedeGestionar = false,
  onEditar,
  onEliminar,
  eliminando = false,
  modoPapelera = false,
  onRestaurar,
  onPurgar,
  restaurando = false,
  purgando = false,
}: {
  denuncia: Denuncia;
  nombreCentro: string;
  puedeResolver: boolean;
  onResolver: (nota: string) => void;
  resolviendo: boolean;
  /** En el Buzón del centro el nombre ya está en el contexto. */
  ocultarCentro?: boolean;
  /** Admin / analista SAE: editar y soft-delete. */
  puedeGestionar?: boolean;
  onEditar?: () => void;
  onEliminar?: () => void;
  eliminando?: boolean;
  /** Vista de papelera (solo admin). */
  modoPapelera?: boolean;
  onRestaurar?: () => void;
  onPurgar?: () => void;
  restaurando?: boolean;
  purgando?: boolean;
}) {
  const [resolviendoAbierto, setResolviendoAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [expandida, setExpandida] = useState(false);
  const emoji = CATEGORIAS_DENUNCIA.find((c) => c.valor === denuncia.categoria)?.emoji ?? "💬";
  const abierta = denuncia.estado === "abierta";
  const tieneOrigen = Boolean(
    denuncia.ip || denuncia.dispositivo_huella || denuncia.user_agent,
  );
  const titulo = denuncia.titulo?.trim() || denuncia.texto;
  const textoExtra =
    denuncia.titulo?.trim() && denuncia.texto.trim() !== denuncia.titulo.trim()
      ? denuncia.texto
      : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-card/40 px-2.5 py-2",
        (!abierta || denuncia.deleted) && "opacity-75",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
              <span aria-hidden="true">{emoji}</span>
              {labelCategoriaDenuncia(denuncia.categoria)}
            </Badge>
            {!ocultarCentro && (
              <span className="truncate text-[11px] font-medium text-muted-foreground">
                {nombreCentro}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">{fechaCorta(denuncia.ts)}</span>
            {denuncia.deleted ? (
              <Badge
                variant="outline"
                className="h-5 border-destructive/40 px-1.5 text-[10px] text-destructive"
              >
                Eliminada
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  abierta
                    ? "border-amber-500/40 text-amber-500"
                    : "border-emerald-500/40 text-emerald-500",
                )}
              >
                {abierta ? "Abierta" : "Resuelta"}
              </Badge>
            )}
          </div>

          <p className="text-sm font-semibold leading-snug">{titulo}</p>

          {textoExtra && (
            <p
              className={cn(
                "text-xs leading-snug text-muted-foreground",
                !expandida && "line-clamp-1",
              )}
            >
              {textoExtra}
            </p>
          )}

          {(denuncia.contacto || tieneOrigen || (!abierta && !denuncia.deleted) || denuncia.deleted) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {denuncia.contacto && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="size-3 shrink-0" aria-hidden="true" />
                  <span className="text-foreground">{denuncia.contacto}</span>
                </span>
              )}
              {tieneOrigen && (
                <button
                  type="button"
                  onClick={() => setExpandida((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ShieldAlert className="size-3 shrink-0" aria-hidden="true" />
                  Origen
                  {expandida ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                </button>
              )}
              {!tieneOrigen && textoExtra && (
                <button
                  type="button"
                  onClick={() => setExpandida((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {expandida ? "Menos" : "Más"}
                  {expandida ? (
                    <ChevronUp className="size-3" />
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                </button>
              )}
              {!abierta && !denuncia.deleted && (
                <span>
                  Resuelta por{" "}
                  <span className="text-foreground">{denuncia.resuelta_por}</span>
                  {denuncia.resuelta_ts ? ` · ${fechaCorta(denuncia.resuelta_ts)}` : ""}
                </span>
              )}
              {denuncia.deleted && (
                <span>
                  Eliminada por{" "}
                  <span className="text-foreground">{denuncia.deleted_by ?? "—"}</span>
                  {denuncia.deleted_at ? ` · ${fechaCorta(denuncia.deleted_at)}` : ""}
                </span>
              )}
            </div>
          )}

          {expandida && (
            <div className="space-y-1 pt-0.5">
              {textoExtra && expandida && tieneOrigen && (
                <p className="whitespace-pre-wrap text-xs leading-snug text-muted-foreground">
                  {textoExtra}
                </p>
              )}
              {!abierta && denuncia.nota_resolucion && (
                <p className="text-[11px] text-muted-foreground">
                  Nota: {denuncia.nota_resolucion}
                </p>
              )}
              {tieneOrigen && (
                <div className="rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {denuncia.ip && (
                    <p>
                      IP: <span className="text-foreground">{denuncia.ip}</span>
                    </p>
                  )}
                  {denuncia.dispositivo_huella && (
                    <p>
                      Huella:{" "}
                      <span className="text-foreground">{denuncia.dispositivo_huella}</span>
                    </p>
                  )}
                  {denuncia.dispositivo_meta?.timezone && (
                    <p>
                      Zona:{" "}
                      <span className="text-foreground">{denuncia.dispositivo_meta.timezone}</span>
                      {denuncia.dispositivo_meta.platform
                        ? ` · ${denuncia.dispositivo_meta.platform}`
                        : ""}
                    </p>
                  )}
                  {denuncia.user_agent && (
                    <p className="break-all opacity-80">{denuncia.user_agent}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {resolviendoAbierto && (
            <div className="space-y-1.5 pt-1">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="¿Qué se hizo? (opcional)"
                className="w-full resize-y rounded-md border border-border bg-card px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={resolviendo}
                  onClick={() => onResolver(nota)}
                >
                  <CheckCircle2 className="size-3.5" />
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setResolviendoAbierto(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {modoPapelera ? (
            <>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-7"
                disabled={restaurando || purgando}
                onClick={onRestaurar}
                title="Restaurar"
              >
                <RotateCcw className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-7 text-destructive hover:text-destructive"
                disabled={restaurando || purgando}
                onClick={onPurgar}
                title="Borrar definitivo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              {abierta && puedeResolver && !resolviendoAbierto && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setResolviendoAbierto(true)}
                  title="Resolver"
                >
                  <CheckCircle2 className="size-3.5" />
                </Button>
              )}
              {puedeGestionar && (
                <>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-7"
                    disabled={eliminando}
                    onClick={onEditar}
                    title="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    disabled={eliminando}
                    onClick={onEliminar}
                    title="Eliminar"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
