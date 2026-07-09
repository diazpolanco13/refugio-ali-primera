// Papelera de denuncias de damnificados (borrado suave). Solo accesible para
// el admin: puede restaurar o purgar definitivamente.

import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useDenuncias } from "@/data/useDenuncias";
import { purgarDenuncia, restaurarDenuncia } from "@/data/reposDenuncias";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import type { Denuncia } from "@/domain/denuncias";
import { puedeVerPapeleraDenuncias } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { ANCHO_VISTA_PRINCIPAL, MarcoVista } from "@/components/VistaContenedor";
import { VistaEncabezado } from "@/components/VistaEncabezado";
import { TarjetaDenuncia } from "./TarjetaDenuncia";

interface Props {
  sesion: Sesion;
}

export function DenunciasEliminadasView({ sesion }: Props) {
  if (!puedeVerPapeleraDenuncias(sesion.user.rol)) {
    return <Navigate to="/incidencias/refugiados" replace />;
  }

  return <PapeleraContenido sesion={sesion} />;
}

function PapeleraContenido({ sesion }: Props) {
  const denuncias = useDenuncias({ alcance: "eliminadas" });

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const centrosPorId = useMemo(
    () => new Map(filasCentros.map((c) => [c.id, c.nombre || c.id])),
    [filasCentros],
  );

  const ordenadas = useMemo(
    () => [...denuncias].sort((a, b) => (b.deleted_at ?? b.ts) - (a.deleted_at ?? a.ts)),
    [denuncias],
  );

  const [accionId, setAccionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [purgarTarget, setPurgarTarget] = useState<Denuncia | null>(null);

  async function restaurar(denuncia: Denuncia) {
    setAccionId(denuncia.id);
    setError("");
    try {
      await restaurarDenuncia(denuncia.id, denuncia.centro_id, sesion.user.username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restaurar");
    } finally {
      setAccionId(null);
    }
  }

  async function confirmarPurgar() {
    if (!purgarTarget) return;
    setAccionId(purgarTarget.id);
    setError("");
    try {
      await purgarDenuncia(purgarTarget.id, purgarTarget.centro_id);
      setPurgarTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar");
    } finally {
      setAccionId(null);
    }
  }

  return (
    <MarcoVista
      ancho={ANCHO_VISTA_PRINCIPAL}
      rellenarAltura
      className="overflow-hidden"
      marcoClassName="flex min-h-0 flex-col"
    >
      <VistaEncabezado
        icono={Trash2}
        acento="rojo"
        titulo="Denuncias eliminadas"
        descripcion="Papelera del canal de damnificados (borrado suave). Solo administradores."
        acciones={
          <Badge variant="outline" className="gap-1">
            {ordenadas.length} en papelera
          </Badge>
        }
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {ordenadas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay denuncias eliminadas.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {ordenadas.map((d) => (
              <TarjetaDenuncia
                key={d.id}
                denuncia={d}
                nombreCentro={centrosPorId.get(d.centro_id) ?? d.centro_id}
                puedeResolver={false}
                onResolver={() => {}}
                resolviendo={false}
                modoPapelera
                onRestaurar={() => void restaurar(d)}
                onPurgar={() => setPurgarTarget(d)}
                restaurando={accionId === d.id}
                purgando={accionId === d.id}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={purgarTarget != null}
        onOpenChange={(abierto) => {
          if (!abierto && accionId == null) setPurgarTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La denuncia desaparecerá de la
              base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accionId != null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={accionId != null}
              onClick={(e) => {
                e.preventDefault();
                void confirmarPurgar();
              }}
            >
              {accionId != null ? "Borrando…" : "Borrar definitivo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MarcoVista>
  );
}
