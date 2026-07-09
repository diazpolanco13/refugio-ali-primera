// Tarjeta de una denuncia/sugerencia del canal público (QR). Se usa en la
// bandeja global de damnificados y en el Buzón de cada campamento.
// La telemetría de origen (IP / huella) es solo para detectar abuso; no se
// muestra al denunciante. La MAC no es accesible desde el navegador.

import { useState } from "react";
import { CheckCircle2, Phone, ShieldAlert } from "lucide-react";
import {
  CATEGORIAS_DENUNCIA,
  labelCategoriaDenuncia,
  type Denuncia,
} from "@/domain/denuncias";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
}: {
  denuncia: Denuncia;
  nombreCentro: string;
  puedeResolver: boolean;
  onResolver: (nota: string) => void;
  resolviendo: boolean;
  /** En el Buzón del centro el nombre ya está en el contexto. */
  ocultarCentro?: boolean;
}) {
  const [resolviendoAbierto, setResolviendoAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const [verOrigen, setVerOrigen] = useState(false);
  const emoji = CATEGORIAS_DENUNCIA.find((c) => c.valor === denuncia.categoria)?.emoji ?? "💬";
  const abierta = denuncia.estado === "abierta";
  const tieneOrigen = Boolean(
    denuncia.ip || denuncia.dispositivo_huella || denuncia.user_agent,
  );

  return (
    <Card className={cn(!abierta && "opacity-75")}>
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span aria-hidden="true">{emoji}</span>
            {labelCategoriaDenuncia(denuncia.categoria)}
          </Badge>
          {!ocultarCentro && (
            <span className="text-xs font-medium">{nombreCentro}</span>
          )}
          <span className="text-xs text-muted-foreground">{fechaCorta(denuncia.ts)}</span>
          <Badge
            variant="outline"
            className={cn(
              "ml-auto",
              abierta
                ? "border-amber-500/40 text-amber-500"
                : "border-emerald-500/40 text-emerald-500",
            )}
          >
            {abierta ? "Abierta" : "Resuelta"}
          </Badge>
        </div>

        {denuncia.titulo ? (
          <p className="text-sm font-semibold leading-snug">{denuncia.titulo}</p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-snug text-muted-foreground">
          {denuncia.texto}
        </p>

        {denuncia.contacto && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            Contacto voluntario: <span className="text-foreground">{denuncia.contacto}</span>
          </p>
        )}

        {tieneOrigen && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setVerOrigen((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {verOrigen ? "Ocultar origen" : "Ver origen (anti-abuso)"}
            </button>
            {verOrigen && (
              <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
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

        {!abierta && (
          <p className="text-xs text-muted-foreground">
            Resuelta por <span className="text-foreground">{denuncia.resuelta_por}</span>
            {denuncia.resuelta_ts ? ` · ${fechaCorta(denuncia.resuelta_ts)}` : ""}
            {denuncia.nota_resolucion ? ` — ${denuncia.nota_resolucion}` : ""}
          </p>
        )}

        {abierta && puedeResolver && (
          <div className="space-y-2 pt-1">
            {resolviendoAbierto ? (
              <>
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="¿Qué se hizo? (opcional, queda en el registro)"
                  className="w-full resize-y rounded-md border border-border bg-card px-2.5 py-2 text-sm outline-none focus:border-primary"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={resolviendo}
                    onClick={() => onResolver(nota)}
                  >
                    <CheckCircle2 className="size-4" />
                    Confirmar resolución
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setResolviendoAbierto(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setResolviendoAbierto(true)}
              >
                <CheckCircle2 className="size-4" />
                Resolver
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
