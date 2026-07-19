// Lista los campamentos a los que está suscrito el operador de terreno y
// permite darse de baja (uno o todos). La suscripción es global (perfiles.
// centros_asignados): define qué campamentos puede reportar; las alertas
// Telegram son solo una consecuencia cuando hay vínculo.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { desuscribirCampamentoTerreno } from "@/data/desuscribirTerreno";
import { supabase } from "@/data/supabaseClient";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
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
import { Button } from "@/components/ui/button";
import { etiquetaCentro } from "@/features/usuarios/TarjetaUsuario";

type CentroFila = CentroTransitorio & { deleted: boolean };

interface Props {
  /** Si se baja del campamento del QR actual, el padre puede limpiar sesión. */
  centroActualId?: string;
  onDesuscrito?: (centrosRestantes: string[], centroQuitado: string | null) => void;
}

export function SuscripcionesTerreno({ centroActualId, onDesuscrito }: Props) {
  const [centrosAsignados, setCentrosAsignados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [accionando, setAccionando] = useState(false);
  const [confirmar, setConfirmar] = useState<"todos" | string | null>(null);

  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );
  const centrosPorId = useMemo(() => {
    const m = new Map<string, CentroFila>();
    for (const c of filasCentros) m.set(c.id, c);
    return m;
  }, [filasCentros]);

  const recargar = useCallback(async () => {
    setError("");
    try {
      const { data: sesion } = await supabase.auth.getSession();
      const uid = sesion.session?.user?.id;
      if (!uid) {
        setCentrosAsignados([]);
        return;
      }
      const { data, error: err } = await supabase
        .from("perfiles")
        .select("centros_asignados")
        .eq("user_id", uid)
        .maybeSingle();
      if (err) throw new Error(err.message);
      setCentrosAsignados(
        Array.isArray(data?.centros_asignados) ? data.centros_asignados : [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las suscripciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  async function ejecutar(centroId: string | null) {
    setAccionando(true);
    setError("");
    try {
      const restantes = await desuscribirCampamentoTerreno({ centroId });
      setCentrosAsignados(restantes);
      setConfirmar(null);
      onDesuscrito?.(restantes, centroId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desuscribir");
    } finally {
      setAccionando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Cargando suscripciones…
      </div>
    );
  }

  if (centrosAsignados.length === 0) {
    return (
      <p className="text-center text-[11px] leading-snug text-muted-foreground">
        No está suscrito a ningún campamento. Al escanear un QR e
        identificarse, vuelve a quedar suscrito.
      </p>
    );
  }

  const etiquetaConfirmar =
    confirmar === "todos"
      ? "todos los campamentos"
      : confirmar
        ? etiquetaCentro(centrosPorId.get(confirmar), confirmar)
        : "";

  return (
    <div className="w-full space-y-2">
      <p className="text-center text-[11px] font-medium text-foreground">
        Campamentos suscritos
      </p>
      <p className="text-center text-[10px] leading-snug text-muted-foreground">
        Usted está registrado como operador de estos campamentos y puede
        reportarlos.
      </p>
      {error && (
        <p className="text-center text-[11px] text-destructive">{error}</p>
      )}
      <ul className="space-y-1.5">
        {centrosAsignados.map((id) => {
          const centro = centrosPorId.get(id);
          const esActual = id === centroActualId;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {etiquetaCentro(centro, id)}
                </p>
                {esActual && (
                  <p className="text-[10px] text-muted-foreground">Campamento actual</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 text-destructive"
                disabled={accionando}
                onClick={() => setConfirmar(id)}
              >
                <UserMinus className="size-3.5" />
                Baja
              </Button>
            </li>
          );
        })}
      </ul>
      {centrosAsignados.length > 1 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full text-destructive"
          disabled={accionando}
          onClick={() => setConfirmar("todos")}
        >
          <UserMinus className="size-3.5" />
          Darse de baja de todos
        </Button>
      )}

      <AlertDialog
        open={confirmar != null}
        onOpenChange={(abierto) => !abierto && !accionando && setConfirmar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Darse de baja de {etiquetaConfirmar}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deja de ser operador de ese campamento: ya no podrá reportarlo y,
              si tiene Telegram vinculado, tampoco recibirá sus alertas ni
              recordatorios. Puede volver a suscribirse escaneando el QR e
              identificándose de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accionando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={accionando}
              onClick={(e) => {
                e.preventDefault();
                void ejecutar(confirmar === "todos" ? null : confirmar);
              }}
            >
              {accionando ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
