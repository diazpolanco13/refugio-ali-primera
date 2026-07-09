// Bandeja de denuncias y sugerencias de los damnificados (canal público por
// QR, tabla `denuncias_centros`). La ven quienes vigilan los campamentos:
// admin/analista_sae (toda la red, resuelven), autoridad (toda la red, solo
// lectura) y supervisor (SOLO sus campamentos — pasa revista y acciona). El
// operador de terreno no llega aquí: la RLS le devuelve vacío.

import { useMemo, useState } from "react";
import { CheckCircle2, FilterX, Phone, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import type { Sesion } from "@/data/authSupabase";
import { useDenuncias } from "@/data/useDenuncias";
import { resolverDenuncia } from "@/data/reposDenuncias";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import {
  CATEGORIAS_DENUNCIA,
  labelCategoriaDenuncia,
  type Denuncia,
} from "@/domain/denuncias";
import { puedeCrearCentros, puedeEditarCentro } from "@/domain/permisos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FiltroEstado = "abiertas" | "resueltas" | "todas";

interface Props {
  sesion: Sesion;
}

function fechaCorta(ts: number): string {
  return new Date(ts).toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TarjetaDenuncia({
  denuncia,
  nombreCentro,
  puedeResolver,
  onResolver,
  resolviendo,
}: {
  denuncia: Denuncia;
  nombreCentro: string;
  puedeResolver: boolean;
  onResolver: (nota: string) => void;
  resolviendo: boolean;
}) {
  const [resolviendoAbierto, setResolviendoAbierto] = useState(false);
  const [nota, setNota] = useState("");
  const emoji = CATEGORIAS_DENUNCIA.find((c) => c.valor === denuncia.categoria)?.emoji ?? "💬";
  const abierta = denuncia.estado === "abierta";

  return (
    <Card className={cn(!abierta && "opacity-75")}>
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <span aria-hidden="true">{emoji}</span>
            {labelCategoriaDenuncia(denuncia.categoria)}
          </Badge>
          <span className="text-xs font-medium">{nombreCentro}</span>
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

        <p className="whitespace-pre-wrap text-sm leading-snug">{denuncia.texto}</p>

        {denuncia.contacto && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            Contacto voluntario: <span className="text-foreground">{denuncia.contacto}</span>
          </p>
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

/** Bandeja del canal público de denuncias de damnificados (QR por campamento). */
export function IncidenciasRefugiadosView({ sesion }: Props) {
  const denuncias = useDenuncias();

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>("centros", {
    transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
    clientFilter: (c) => !c.deleted,
  });
  const centrosPorId = useMemo(
    () => new Map(filasCentros.map((c) => [c.id, c.nombre || c.id])),
    [filasCentros],
  );

  const [estado, setEstado] = useState<FiltroEstado>("abiertas");
  const [centroId, setCentroId] = useState("todos");
  const [categoria, setCategoria] = useState("todas");
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [errorResolver, setErrorResolver] = useState("");

  const hayFiltros = estado !== "abiertas" || centroId !== "todos" || categoria !== "todas";

  const filtradas = useMemo(() => {
    return [...denuncias]
      .filter((d) => {
        if (estado === "abiertas" && d.estado !== "abierta") return false;
        if (estado === "resueltas" && d.estado !== "resuelta") return false;
        if (centroId !== "todos" && d.centro_id !== centroId) return false;
        if (categoria !== "todas" && d.categoria !== categoria) return false;
        return true;
      })
      .sort((a, b) => b.ts - a.ts);
  }, [denuncias, estado, centroId, categoria]);

  const abiertas = denuncias.filter((d) => d.estado === "abierta").length;
  const centrosConDenuncias = useMemo(
    () => [...new Set(denuncias.map((d) => d.centro_id))].sort(),
    [denuncias],
  );

  async function resolver(denuncia: Denuncia, nota: string) {
    setResolviendoId(denuncia.id);
    setErrorResolver("");
    try {
      await resolverDenuncia(denuncia.id, denuncia.centro_id, sesion.user.username, nota);
    } catch (err) {
      setErrorResolver(err instanceof Error ? err.message : "No se pudo resolver la denuncia");
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-400">
          <span className="size-1.5 rounded-full bg-amber-400" />
          {abiertas} abiertas
        </Badge>
        <span className="text-xs text-muted-foreground">
          Reportes anónimos de los damnificados vía el QR público de cada campamento.
        </span>
        {puedeCrearCentros(sesion.user.rol) && (
          <Button asChild variant="outline" size="sm" className="ml-auto h-8 gap-1.5 text-xs">
            <Link to="/qrs-terreno">
              <Printer className="size-3.5" />
              Hoja de QRs
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={estado} onValueChange={(v) => setEstado(v as FiltroEstado)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="abiertas">Abiertas</SelectItem>
            <SelectItem value="resueltas">Resueltas</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={centroId} onValueChange={setCentroId}>
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue placeholder="Campamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los campamentos</SelectItem>
            {centrosConDenuncias.map((id) => (
              <SelectItem key={id} value={id}>
                {centrosPorId.get(id) ?? id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        {hayFiltros && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              setEstado("abiertas");
              setCentroId("todos");
              setCategoria("todas");
            }}
          >
            <FilterX className="size-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      {errorResolver && <p className="text-sm text-destructive">{errorResolver}</p>}

      {filtradas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {denuncias.length === 0
              ? "Aún no hay denuncias. Pegue los QR públicos en las carteleras de los campamentos para abrir el canal."
              : "Nada que mostrar con estos filtros."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtradas.map((d) => (
            <TarjetaDenuncia
              key={d.id}
              denuncia={d}
              nombreCentro={centrosPorId.get(d.centro_id) ?? d.centro_id}
              puedeResolver={puedeEditarCentro(sesion.user, d.centro_id)}
              onResolver={(nota) => void resolver(d, nota)}
              resolviendo={resolviendoId === d.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
