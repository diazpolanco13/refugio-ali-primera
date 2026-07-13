// Panel censo nominal vs parte (sala situacional).
// No usa censo rápido: fuente = useCensoNominalRed / ResumenCensoNominalCentro.

import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  estadoCensoNominalRed,
  type ResumenCensoNominalCentro,
} from "@/domain/censoNominalRed";
import { BarraCensoVsParteMini } from "@/features/censo/ContrasteCensoParte";

export interface ConteosCensoSala {
  completo: number;
  enCurso: number;
  sinIniciar: number;
}

/** Conteos de estado para cinta / franja plegada. */
export function conteosCensoNominalSala(
  resumenes: ResumenCensoNominalCentro[],
): ConteosCensoSala {
  let completo = 0;
  let enCurso = 0;
  let sinIniciar = 0;
  for (const r of resumenes) {
    const est = estadoCensoNominalRed(r);
    if (est === "meta_alcanzada" || est === "discrepancia") completo += 1;
    else if (est === "en_curso") enCurso += 1;
    else sinIniciar += 1;
  }
  return { completo, enCurso, sinIniciar };
}

function formatearHoraTs(ts: number): string {
  if (ts <= 0) return "Sin actividad";
  return new Date(ts).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  resumenes: ResumenCensoNominalCentro[];
  cargando?: boolean;
  idsVisibles?: Set<string>;
}

export function PanelCensoSala({ resumenes, cargando, idsVisibles }: Props) {
  const filas = resumenes
    .filter((r) => !idsVisibles || idsVisibles.has(r.centroId))
    .slice()
    .sort(
      (a, b) =>
        b.ultimoRegistroTs - a.ultimoRegistroTs ||
        (a.nro ?? 0) - (b.nro ?? 0) ||
        a.centroNombre.localeCompare(b.centroNombre, "es"),
    );

  const conteos = conteosCensoNominalSala(filas);
  const totalCenso = filas.reduce((acc, f) => acc + f.registrados, 0);
  const totalParte = filas.reduce((acc, f) => acc + f.metaRefugiados, 0);
  const pct =
    totalParte > 0 ? Math.min(100, Math.round((totalCenso / totalParte) * 100)) : 0;
  const enCursoOActivos = conteos.enCurso + conteos.sinIniciar;

  if (!cargando && filas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos de censo nominal en la red.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-sky-500/40 border-l-4 border-l-sky-400 bg-sky-500/10 px-2.5 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
              Red · censo nominal / parte
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-sky-50">
              {totalCenso.toLocaleString("es")}
              <span className="text-sm font-normal text-sky-200/70">
                {" "}
                / {totalParte.toLocaleString("es")}
              </span>
              <span className="ml-2 text-xs font-semibold text-sky-300">{pct}%</span>
            </p>
          </div>
          {enCursoOActivos > 0 && (
            <Badge
              variant="outline"
              className="shrink-0 border-sky-400/60 bg-sky-500/20 text-sky-200"
            >
              En curso · {conteos.enCurso}
            </Badge>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className="border-emerald-500/50 px-1.5 py-0 text-[10px] text-emerald-300"
          >
            Completo {conteos.completo}
          </Badge>
          <Badge
            variant="outline"
            className="border-amber-500/50 px-1.5 py-0 text-[10px] text-amber-300"
          >
            En curso {conteos.enCurso}
          </Badge>
          <Badge
            variant="outline"
            className="border-red-500/50 px-1.5 py-0 text-[10px] text-red-300"
          >
            Sin iniciar {conteos.sinIniciar}
          </Badge>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-950/50">
          <div
            className="h-full rounded-full bg-sky-400"
            style={{ width: `${Math.max(pct, totalCenso > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {filas.map((resumen) => {
          const titulo =
            resumen.nro != null
              ? `N.° ${resumen.nro} · ${resumen.centroNombre}`
              : resumen.centroNombre;
          return (
            <Link
              key={resumen.centroId}
              to={`/centros/censo/${resumen.centroId}`}
              className="block rounded-lg border border-border bg-card/60 px-2.5 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-medium text-foreground">
                  {titulo}
                </p>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatearHoraTs(resumen.ultimoRegistroTs)}
                </span>
              </div>
              <BarraCensoVsParteMini
                registrados={resumen.registrados}
                meta={resumen.metaRefugiados}
                contraste={resumen.contraste}
                cargando={cargando}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
