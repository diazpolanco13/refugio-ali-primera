// Pestaña Buzón de la ficha del centro: canal de denuncias/sugerencias de los
// damnificados (QR público) + bandeja scoped a este campamento.

import { useMemo, useState } from "react";
import { FilterX } from "lucide-react";
import type { Sesion } from "@/data/authSupabase";
import { useDenuncias } from "@/data/useDenuncias";
import {
  editarDenuncia,
  resolverDenuncia,
  softDeleteDenuncia,
} from "@/data/reposDenuncias";
import { CATEGORIAS_DENUNCIA, type Denuncia } from "@/domain/denuncias";
import { puedeEditarCentro, puedeGestionarDenuncias } from "@/domain/permisos";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TarjetaDenuncia } from "@/features/incidencias/TarjetaDenuncia";
import {
  DialogoEdicionDenuncia,
  type DatosFormularioDenuncia,
} from "@/features/incidencias/DialogoEdicionDenuncia";
import { AccesoDenunciaCentro } from "./AccesoDenunciaCentro";

type FiltroEstado = "todas" | "abiertas" | "resueltas";

const PESTANAS_ESTADO: { id: FiltroEstado; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "abiertas", label: "Abiertas" },
  { id: "resueltas", label: "Resueltas" },
];

const tabTriggerClass = cn(
  "relative shrink-0 rounded-none px-3 py-2 text-xs font-medium sm:text-sm",
  "!h-full !border-x-transparent !border-t-transparent !border-b-2 !border-b-transparent !bg-transparent !shadow-none",
  "text-muted-foreground transition-colors hover:text-foreground",
  "after:!hidden after:!content-none",
  "data-active:!border-x-transparent data-active:!border-t-transparent data-active:!border-b-primary",
  "data-active:!bg-transparent data-active:!font-semibold data-active:!text-teal-300 data-active:!shadow-none",
  "dark:data-active:!border-b-primary dark:data-active:!bg-transparent",
);

interface Props {
  centro: CentroTransitorio;
  sesion: Sesion;
}

export function BuzonCentroPanel({ centro, sesion }: Props) {
  const denuncias = useDenuncias({ centroId: centro.id });

  const [estado, setEstado] = useState<FiltroEstado>("abiertas");
  const [categoria, setCategoria] = useState("todas");
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState("");
  const [editando, setEditando] = useState<Denuncia | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);
  const [eliminarTarget, setEliminarTarget] = useState<Denuncia | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const hayFiltroCategoria = categoria !== "todas";
  const puedeResolver = puedeEditarCentro(sesion.user, centro.id);
  const puedeGestionar = puedeGestionarDenuncias(sesion.user.rol);

  const conteos = useMemo(() => {
    let abiertas = 0;
    let resueltas = 0;
    for (const d of denuncias) {
      if (d.estado === "abierta") abiertas += 1;
      else resueltas += 1;
    }
    return { todas: denuncias.length, abiertas, resueltas };
  }, [denuncias]);

  const filtradas = useMemo(() => {
    return [...denuncias]
      .filter((d) => {
        if (estado === "abiertas" && d.estado !== "abierta") return false;
        if (estado === "resueltas" && d.estado !== "resuelta") return false;
        if (categoria !== "todas" && d.categoria !== categoria) return false;
        return true;
      })
      .sort((a, b) => b.ts - a.ts);
  }, [denuncias, estado, categoria]);

  async function resolver(denuncia: Denuncia, nota: string) {
    setResolviendoId(denuncia.id);
    setErrorAccion("");
    try {
      await resolverDenuncia(denuncia.id, denuncia.centro_id, sesion.user.username, nota);
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo resolver la denuncia");
    } finally {
      setResolviendoId(null);
    }
  }

  async function guardarEdicion(datos: DatosFormularioDenuncia) {
    if (!editando) return;
    setGuardandoEdicion(true);
    setErrorEdicion(null);
    try {
      await editarDenuncia(editando.id, editando.centro_id, sesion.user.username, datos);
      setEditando(null);
    } catch (err) {
      setErrorEdicion(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function confirmarEliminar() {
    if (!eliminarTarget) return;
    setEliminando(true);
    setErrorAccion("");
    try {
      await softDeleteDenuncia(
        eliminarTarget.id,
        eliminarTarget.centro_id,
        sesion.user.username,
      );
      setEliminarTarget(null);
    } catch (err) {
      setErrorAccion(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="space-y-4">
      <AccesoDenunciaCentro centro={centro} />

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Denuncias y sugerencias anónimas de los damnificados de este campamento.
        </p>

        <Tabs
          value={estado}
          onValueChange={(v) => setEstado(v as FiltroEstado)}
          className="gap-0"
        >
          <div className="border-b border-border">
            <TabsList
              variant="line"
              className="!flex h-10 w-full justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {PESTANAS_ESTADO.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className={tabTriggerClass}>
                  {p.label}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1.5 h-4 min-w-4 px-1 text-[9px] tabular-nums",
                      p.id === "abiertas" &&
                        conteos.abiertas > 0 &&
                        "bg-amber-500/15 text-amber-400",
                    )}
                  >
                    {conteos[p.id]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {CATEGORIAS_DENUNCIA.map((c) => (
                <SelectItem key={c.valor} value={c.valor}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hayFiltroCategoria && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setCategoria("todas")}
            >
              <FilterX className="size-3.5" />
              Limpiar
            </Button>
          )}
        </div>

        {errorAccion && <p className="text-sm text-destructive">{errorAccion}</p>}

        {filtradas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {denuncias.length === 0
                ? "Aún no hay denuncias en este campamento. Publique el QR del canal para abrir el buzón."
                : "Nada que mostrar con estos filtros."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtradas.map((d) => (
              <TarjetaDenuncia
                key={d.id}
                denuncia={d}
                nombreCentro={centro.nombre}
                ocultarCentro
                puedeResolver={puedeResolver}
                onResolver={(nota) => void resolver(d, nota)}
                resolviendo={resolviendoId === d.id}
                puedeGestionar={puedeGestionar}
                onEditar={() => {
                  setErrorEdicion(null);
                  setEditando(d);
                }}
                onEliminar={() => setEliminarTarget(d)}
                eliminando={eliminando && eliminarTarget?.id === d.id}
              />
            ))}
          </div>
        )}
      </div>

      <DialogoEdicionDenuncia
        denuncia={editando}
        abierto={editando != null}
        guardando={guardandoEdicion}
        error={errorEdicion}
        onCerrar={() => {
          if (!guardandoEdicion) setEditando(null);
        }}
        onGuardar={(datos) => void guardarEdicion(datos)}
      />

      <AlertDialog
        open={eliminarTarget != null}
        onOpenChange={(abierto) => {
          if (!abierto && !eliminando) setEliminarTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta denuncia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se moverá a la papelera (borrado suave). Solo el administrador podrá
              verla o restaurarla después.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={eliminando}
              onClick={(e) => {
                e.preventDefault();
                void confirmarEliminar();
              }}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
