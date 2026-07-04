// Lista global de incidencias (ya filtradas y ordenadas por la vista): cada
// fila muestra el centro (con enlace a su ficha `/centro/:id`), la
// descripción, la etiqueta de severidad con su color, las categorías, el
// estado (abierta/resuelta) y quién/cuándo la registró o resolvió.

import { Link } from "react-router-dom";
import { CircleCheck, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORIAS_INCIDENCIA,
  META_ETIQUETA,
  type Incidencia,
} from "@/domain/incidencias";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";

interface Props {
  incidencias: Incidencia[];
  /** Índice id → centro para resolver el nombre de cada fila. */
  centrosPorId: Map<string, CentroTransitorio>;
}

const ICONO_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS_INCIDENCIA.map((c) => [c.valor, c.icono]),
);
const LABEL_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS_INCIDENCIA.map((c) => [c.valor, c.label]),
);

/** Formatea un timestamp (ms) como "3 jul, 14:05". */
function formatearTs(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formatea el día YYYY-MM-DD como "jue 3 jul 2026" (fecha local). */
function formatearDia(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ListaIncidencias({ incidencias, centrosPorId }: Props) {
  if (incidencias.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No hay incidencias que coincidan con los filtros seleccionados.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {incidencias.map((inc) => (
        <FilaIncidencia
          key={inc.id}
          incidencia={inc}
          centro={centrosPorId.get(inc.centro_id)}
        />
      ))}
    </div>
  );
}

function FilaIncidencia({
  incidencia,
  centro,
}: {
  incidencia: Incidencia;
  centro: CentroTransitorio | undefined;
}) {
  const meta = META_ETIQUETA[incidencia.etiqueta];
  const resuelta = incidencia.estado === "resuelta";
  const nombreCentro = centro
    ? `${centro.nro != null ? `N.° ${centro.nro} · ` : ""}${centro.nombre}`
    : incidencia.centro_id;

  return (
    <div
      className="rounded-lg border border-border bg-card/50 px-3 py-2.5"
      style={{ borderLeftWidth: 3, borderLeftColor: meta.color }}
    >
      {/* Cabecera: centro + etiqueta + estado */}
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/centro/${incidencia.centro_id}`}
          className="group flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground hover:text-primary"
          title="Abrir ficha del centro"
        >
          <span className="truncate group-hover:underline">{nombreCentro}</span>
          <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Badge
            variant="outline"
            className="text-[10px]"
            style={{ borderColor: `${meta.color}66`, color: meta.color }}
          >
            {meta.label}
          </Badge>
          {resuelta ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 text-[10px] text-emerald-400"
            >
              <CircleCheck className="size-3" />
              Resuelta
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 text-[10px] text-amber-400"
            >
              <span className="size-1.5 rounded-full bg-amber-400" />
              Abierta
            </Badge>
          )}
        </div>
      </div>

      {/* Descripción */}
      <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground/90">
        {incidencia.descripcion || "(sin descripción)"}
      </p>

      {/* Categorías */}
      {incidencia.categorias.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {incidencia.categorias.map((cat) => (
            <span
              key={cat}
              className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {ICONO_CATEGORIA[cat]} {LABEL_CATEGORIA[cat]}
            </span>
          ))}
        </div>
      )}

      {/* Quién / cuándo */}
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {formatearDia(incidencia.dia)} · registrada por{" "}
        <span className="font-medium text-foreground/80">
          {incidencia.updated_by || "—"}
        </span>{" "}
        ({formatearTs(incidencia.ts)})
        {resuelta && (
          <>
            {" "}
            · resuelta por{" "}
            <span className="font-medium text-emerald-400/90">
              {incidencia.resuelta_por || "—"}
            </span>{" "}
            ({formatearTs(incidencia.resuelta_ts ?? 0)})
          </>
        )}
      </p>
    </div>
  );
}
