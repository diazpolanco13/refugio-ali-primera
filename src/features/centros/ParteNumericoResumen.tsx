// Resumen compacto del parte numérico: totales, censo demográfico y Δ vs día anterior.

import { useState } from "react";
import {
  totalHombres,
  totalMujeres,
  totalPoblacion,
  type Vulnerables,
} from "@/domain/tipos";
import { ocupacionAlineadaAlTotal } from "@/domain/parteActualCentros";
import type { SnapshotOcupacion } from "@/domain/serieOcupacionCentros";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleDashed,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MetaActualizacionBloque } from "./MetaActualizacionBloque";

/** Último snapshot estrictamente anterior a `dia` (YYYY-MM-DD). */
export function ultimoSnapshotAntes(
  snapshots: SnapshotOcupacion[],
  dia: string,
): SnapshotOcupacion | undefined {
  return [...snapshots]
    .filter((s) => s.dia < dia)
    .sort((a, b) => b.dia.localeCompare(a.dia))[0];
}

function delta(valor: number, anterior?: number): number | null {
  if (anterior === undefined) return null;
  return valor - anterior;
}

/** Variación: verde +N si subió, rojo -N si bajó, nada si igual. */
function Delta({ valor, anterior }: { valor: number; anterior?: number }) {
  const d = delta(valor, anterior);
  if (d === null || d === 0) return null;
  if (d > 0) {
    return (
      <span className="text-[10px] font-bold text-emerald-400">+{d.toLocaleString("es")}</span>
    );
  }
  return <span className="text-[10px] font-bold text-rose-400">{d.toLocaleString("es")}</span>;
}

function KpiInline({
  etiqueta,
  valor,
  anterior,
  principal,
}: {
  etiqueta: string;
  valor: number;
  anterior?: number;
  principal?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-baseline gap-1.5 overflow-hidden rounded-md border px-2 py-1 sm:flex-1",
        principal ? "border-sky-500/25 bg-sky-500/10" : "border-border/50 bg-muted/20",
      )}
    >
      <span className="min-w-0 truncate text-[9px] text-muted-foreground">{etiqueta}</span>
      <span
        className={cn(
          "shrink-0 font-bold tabular-nums text-foreground",
          principal ? "text-base" : "text-sm",
        )}
      >
        {valor.toLocaleString("es")}
      </span>
      <Delta valor={valor} anterior={anterior} />
    </div>
  );
}

function CeldaHm({
  h,
  m,
  hAnt,
  mAnt,
}: {
  h: number;
  m: number;
  hAnt?: number;
  mAnt?: number;
}) {
  return (
    <>
      <td className="py-0.5 pl-1 text-right tabular-nums">
        <span className="text-[11px] font-medium text-foreground">{h.toLocaleString("es")}</span>{" "}
        <Delta valor={h} anterior={hAnt} />
      </td>
      <td className="py-0.5 text-right tabular-nums">
        <span className="text-[11px] font-medium text-foreground">{m.toLocaleString("es")}</span>{" "}
        <Delta valor={m} anterior={mAnt} />
      </td>
    </>
  );
}

const GRUPOS_ETARIOS: {
  etiqueta: string;
  h: keyof Vulnerables;
  m: keyof Vulnerables;
}[] = [
  { etiqueta: "0–2", h: "recien_nacidos_h", m: "recien_nacidos_m" },
  { etiqueta: "3–11", h: "ninos", m: "ninas" },
  { etiqueta: "12–17", h: "adolescentes_h", m: "adolescentes_m" },
  { etiqueta: "18–59", h: "adultos_h", m: "adultos_m" },
  { etiqueta: "60+", h: "adultos_mayores_h", m: "adultos_mayores_m" },
];

interface Props {
  snapshot: SnapshotOcupacion;
  snapshotAnterior?: SnapshotOcupacion;
  confirmado?: boolean;
  /** Si se define, la tarjeta es clicable y abre la fase Parte del formulario. */
  onAbrir?: () => void;
  /** Fecha/hora/usuario de la última actualización del parte. */
  meta?: { ts?: number | null; by?: string | null } | null;
}

export function ParteNumericoResumen({
  snapshot,
  snapshotAnterior,
  confirmado = true,
  onAbrir,
  meta,
}: Props) {
  const [desgloseAbierto, setDesgloseAbierto] = useState(false);
  // El total reportado manda: si un ajuste histórico dejó el censo desfasado,
  // alineamos el desglose para que al cambiar de día se vea la demografía
  // coherente con Beneficiados/Familias de ese día.
  const vuln = ocupacionAlineadaAlTotal(snapshot.ocupacion, snapshot.total_afectados);
  const vulnAnt = snapshotAnterior
    ? ocupacionAlineadaAlTotal(
        snapshotAnterior.ocupacion,
        snapshotAnterior.total_afectados,
      )
    : undefined;

  const refugiados = snapshot.total_afectados;
  const pobDesglose = totalPoblacion(vuln);
  const hombres = totalHombres(vuln);
  const mujeres = totalMujeres(vuln);

  const filasEtarias = GRUPOS_ETARIOS.filter(
    (g) =>
      (vuln[g.h] as number) > 0 ||
      (vuln[g.m] as number) > 0 ||
      (vulnAnt?.[g.h] ?? 0) > 0 ||
      (vulnAnt?.[g.m] ?? 0) > 0,
  );

  const hayDiscap =
    vuln.discapacidad_h > 0 ||
    vuln.discapacidad_m > 0 ||
    (vulnAnt?.discapacidad_h ?? 0) > 0 ||
    (vulnAnt?.discapacidad_m ?? 0) > 0;
  const hayEmb =
    vuln.embarazadas > 0 || (vulnAnt?.embarazadas ?? 0) > 0;

  const refAnt = snapshotAnterior?.dia
    ? snapshotAnterior.dia.split("-").slice(1).reverse().join("-")
    : null;

  return (
    <div
      role={onAbrir ? "button" : undefined}
      tabIndex={onAbrir ? 0 : undefined}
      onClick={onAbrir}
      onKeyDown={
        onAbrir
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAbrir();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-lg border border-sky-500/25 bg-sky-500/[0.04] px-2.5 py-2",
        onAbrir &&
          "cursor-pointer transition-colors hover:border-sky-500/50 hover:bg-sky-500/10 active:bg-sky-500/15",
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Users className="size-3.5 shrink-0 text-sky-400" />
        <span className="text-[11px] font-semibold text-foreground">Parte numérico</span>
        {refAnt && (
          <span className="text-[9px] text-muted-foreground">· Δ vs {refAnt}</span>
        )}
        {confirmado ? (
          <CircleCheck className="ml-auto size-3 text-emerald-400" />
        ) : (
          <CircleDashed className="ml-auto size-3 text-muted-foreground" />
        )}
        {onAbrir && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        <KpiInline
          etiqueta="Damnificados"
          valor={refugiados}
          anterior={snapshotAnterior?.total_afectados}
          principal
        />
        <KpiInline
          etiqueta="Familias"
          valor={snapshot.familias}
          anterior={snapshotAnterior?.familias}
          principal
        />
        <KpiInline
          etiqueta="Personal"
          valor={snapshot.personal_total}
          anterior={snapshotAnterior?.personal_total}
        />
        <KpiInline
          etiqueta="Mascotas"
          valor={vuln.mascotas}
          anterior={vulnAnt?.mascotas}
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="mt-1.5 h-7 w-full justify-between px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          // No abrir el formulario cuando solo se despliega el censo demográfico.
          e.stopPropagation();
          setDesgloseAbierto((v) => !v);
        }}
      >
        <span>
          Censo demográfico · {hombres.toLocaleString("es")} H / {mujeres.toLocaleString("es")} M
        </span>
        {desgloseAbierto ? (
          <ChevronUp className="size-3.5 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0" />
        )}
      </Button>

      {desgloseAbierto && (
      // Leer el desglose no debe disparar la apertura del formulario.
      <div
        className="mt-1 overflow-x-auto rounded-md border border-border/40 bg-muted/10"
        onClick={(e) => e.stopPropagation()}
      >
        <table className="w-full min-w-[280px] text-[10px]">
          <thead>
            <tr className="text-[9px] text-muted-foreground">
              <th className="px-2 py-1 text-left font-normal">Grupo</th>
              <th className="px-1 py-1 text-right font-normal">H</th>
              <th className="px-2 py-1 text-right font-normal">M</th>
            </tr>
          </thead>
          <tbody>
            {filasEtarias.map((g) => (
              <tr key={g.etiqueta} className="border-t border-border/30">
                <td className="px-2 py-0.5 text-muted-foreground">{g.etiqueta} años</td>
                <CeldaHm
                  h={vuln[g.h] as number}
                  m={vuln[g.m] as number}
                  hAnt={vulnAnt?.[g.h] as number | undefined}
                  mAnt={vulnAnt?.[g.m] as number | undefined}
                />
              </tr>
            ))}
            {hayDiscap && (
              <tr className="border-t border-border/30">
                <td className="px-2 py-0.5 text-muted-foreground">Discapacidad</td>
                <CeldaHm
                  h={vuln.discapacidad_h}
                  m={vuln.discapacidad_m}
                  hAnt={vulnAnt?.discapacidad_h}
                  mAnt={vulnAnt?.discapacidad_m}
                />
              </tr>
            )}
            {hayEmb && (
              <tr className="border-t border-border/30">
                <td className="px-2 py-0.5 text-muted-foreground">Embarazadas</td>
                <td className="py-0.5 pl-1 text-right" colSpan={2}>
                  <span className="text-[11px] font-medium text-foreground">
                    {vuln.embarazadas.toLocaleString("es")}
                  </span>{" "}
                  <Delta valor={vuln.embarazadas} anterior={vulnAnt?.embarazadas} />
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/50 bg-muted/20">
              <td className="px-2 py-1 font-medium text-muted-foreground">Total H/M</td>
              <td className="py-1 pl-1 text-right font-semibold tabular-nums">
                {hombres.toLocaleString("es")}{" "}
                <Delta valor={hombres} anterior={vulnAnt ? totalHombres(vulnAnt) : undefined} />
              </td>
              <td className="px-2 py-1 text-right font-semibold tabular-nums">
                {mujeres.toLocaleString("es")}{" "}
                <Delta valor={mujeres} anterior={vulnAnt ? totalMujeres(vulnAnt) : undefined} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}

      {desgloseAbierto && pobDesglose !== refugiados && refugiados > 0 && (
        <p className="mt-1 text-[9px] text-muted-foreground">
          Suma etaria {pobDesglose.toLocaleString("es")} ≠ total reportado{" "}
          {refugiados.toLocaleString("es")}
        </p>
      )}

      {meta && <MetaActualizacionBloque ts={meta.ts} by={meta.by} />}
    </div>
  );
}
