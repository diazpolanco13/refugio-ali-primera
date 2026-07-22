// Comparación lado a lado: parte (revista) vs censo.
// Cada columna repite los grupos demográficos para lectura autónoma.

import { AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import {
  progresoCensoVsParte,
  type ResumenCensoCentro,
} from "@/domain/censoResumen";
import {
  normalizarVulnerables,
  totalHombres,
  totalMujeres,
  totalPoblacion,
  type Vulnerables,
} from "@/domain/tipos";
import { cn } from "@/lib/utils";

function formatearDia(dia: string | null): string {
  if (!dia) return "—";
  const [y, m, d] = dia.split("-").map(Number);
  if (!y || !m || !d) return dia;
  return new Date(y, m - 1, d).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Fila =
  | {
      key: string;
      etiqueta: string;
      tipo: "sexo";
      h: keyof Vulnerables;
      m: keyof Vulnerables;
    }
  | {
      key: string;
      etiqueta: string;
      tipo: "total";
      campo: keyof Vulnerables;
    };

const FILAS: Fila[] = [
  { key: "rn", etiqueta: "Recién nacidos (0-2)", tipo: "sexo", h: "recien_nacidos_h", m: "recien_nacidos_m" },
  { key: "ninez", etiqueta: "Niñez (3-11)", tipo: "sexo", h: "ninos", m: "ninas" },
  { key: "adol", etiqueta: "Adolescentes (12-17)", tipo: "sexo", h: "adolescentes_h", m: "adolescentes_m" },
  { key: "adult", etiqueta: "Adultos (18-59)", tipo: "sexo", h: "adultos_h", m: "adultos_m" },
  { key: "mayor", etiqueta: "Adultos mayores (60+)", tipo: "sexo", h: "adultos_mayores_h", m: "adultos_mayores_m" },
];

function Num({ valor, tono }: { valor: number | null; tono?: "sky" | "pink" }) {
  if (valor == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        "tabular-nums",
        tono === "sky" && valor > 0 && "text-sky-400",
        tono === "pink" && valor > 0 && "text-pink-400",
        valor === 0 && "text-muted-foreground",
      )}
    >
      {valor.toLocaleString("es")}
    </span>
  );
}

function BarraAvance({ meta, actual }: { meta: number; actual: number }) {
  const escala = Math.max(meta, actual, 1);
  const pctParte = (meta / escala) * 100;
  const pctCenso = (actual / escala) * 100;
  const excede = actual > meta;

  return (
    <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/80">
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-all",
          excede ? "bg-red-500" : actual === meta ? "bg-emerald-500" : "bg-sky-500",
        )}
        style={{ width: `${pctCenso}%` }}
      />
      {meta > 0 && (
        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-foreground/60"
          style={{ left: `${pctParte}%` }}
        />
      )}
    </div>
  );
}

function ColumnaDesglose({
  datos,
  sinDesglose,
  mensajeSinDesglose,
}: {
  datos: Vulnerables;
  sinDesglose?: boolean;
  mensajeSinDesglose?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[1fr_2.5rem_2.5rem] gap-x-1 border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Grupo</span>
        <span className="text-center text-sky-400/90">♂</span>
        <span className="text-center text-pink-400/90">♀</span>
      </div>

      {sinDesglose ? (
        <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
          {mensajeSinDesglose ?? "Sin desglose demográfico."}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {FILAS.map((fila) => {
            if (fila.tipo === "total") {
              const valor = Number(datos[fila.campo] ?? 0);
              return (
                <li
                  key={fila.key}
                  className="grid grid-cols-[1fr_2.5rem_2.5rem] items-center gap-x-1 px-3 py-1.5 text-[11px]"
                >
                  <span className="truncate text-muted-foreground">{fila.etiqueta}</span>
                  <span className="col-span-2 text-center">
                    <Num valor={valor} tono="pink" />
                  </span>
                </li>
              );
            }

            const h = Number(datos[fila.h] ?? 0);
            const m = Number(datos[fila.m] ?? 0);
            return (
              <li
                key={fila.key}
                className="grid grid-cols-[1fr_2.5rem_2.5rem] items-center gap-x-1 px-3 py-1.5 text-[11px]"
              >
                <span className="truncate text-muted-foreground">{fila.etiqueta}</span>
                <span className="text-center">
                  <Num valor={h} tono="sky" />
                </span>
                <span className="text-center">
                  <Num valor={m} tono="pink" />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface Props {
  resumen: ResumenCensoCentro;
  ocupacionParte?: Partial<Vulnerables> | null;
}

export function ComparacionParteCenso({ resumen, ocupacionParte }: Props) {
  const avance = progresoCensoVsParte(resumen);
  const parte = normalizarVulnerables(ocupacionParte);
  const censo = normalizarVulnerables({
    recien_nacidos_h: resumen.recienNacidosH,
    recien_nacidos_m: resumen.recienNacidosM,
    ninos: resumen.ninos,
    ninas: resumen.ninas,
    adolescentes_h: resumen.adolescentesH,
    adolescentes_m: resumen.adolescentesM,
    adultos_h: resumen.adultosH,
    adultos_m: resumen.adultosM,
    adultos_mayores_h: resumen.adultosMayoresH,
    adultos_mayores_m: resumen.adultosMayoresM,
  });

  const totalParteDesglose = totalPoblacion(parte);
  const tieneDesgloseParte = totalParteDesglose > 0;
  const totalParte = avance.tieneParte ? avance.meta : totalParteDesglose;

  const borde =
    avance.contraste === "excede_parte"
      ? "border-red-500/35"
      : avance.contraste === "cuadra"
        ? "border-emerald-500/30"
        : "border-border";

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", borde)}>
      {/* Totales */}
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="min-w-0 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Parte (revista)
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums leading-none">
            {totalParte > 0 ? totalParte.toLocaleString("es") : "—"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {resumen.parteDia
              ? formatearDia(resumen.parteDia)
              : avance.tieneParte
                ? "Último reporte"
                : "Sin parte"}
            {resumen.parteFamilias != null && resumen.parteFamilias > 0
              ? ` · ${resumen.parteFamilias.toLocaleString("es")} fam.`
              : ""}
            {tieneDesgloseParte
              ? ` · ♂${totalHombres(parte)} ♀${totalMujeres(parte)}`
              : ""}
          </p>
        </div>
        <div className="min-w-0 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Censo en curso
          </p>
          <p
            className={cn(
              "mt-0.5 text-lg font-bold tabular-nums leading-none",
              avance.contraste === "excede_parte" && "text-red-500",
              avance.contraste === "cuadra" && "text-emerald-500",
              avance.contraste === "en_progreso" && "text-sky-500",
            )}
          >
            {avance.actual.toLocaleString("es")}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {avance.contraste === "en_progreso" && (
              <span className="text-sky-400">Faltan {avance.faltan.toLocaleString("es")}</span>
            )}
            {avance.contraste === "cuadra" && (
              <span className="text-emerald-400">Coincide</span>
            )}
            {avance.contraste === "excede_parte" && (
              <span className="text-red-400">
                +{avance.excedente.toLocaleString("es")} sobre el parte
              </span>
            )}
            {(avance.contraste === "sin_parte" || avance.contraste === "sin_censo") && (
              <span>En terreno</span>
            )}
            {` · ♂${resumen.hombres} ♀${resumen.mujeres}`}
          </p>
        </div>
      </div>

      {/* Barra de progreso (arriba del desglose) */}
      {avance.tieneParte && (
        <div className="space-y-1.5 border-t border-border px-3 py-2">
          <BarraAvance meta={avance.meta} actual={avance.actual} />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {avance.contraste === "cuadra" && (
                <>
                  <CheckCircle2 className="size-3 text-emerald-500" />
                  Cuadra con el parte
                </>
              )}
              {avance.contraste === "en_progreso" && (
                <>
                  <TrendingUp className="size-3 text-sky-500" />
                  En progreso
                </>
              )}
              {avance.contraste === "excede_parte" && (
                <>
                  <AlertTriangle className="size-3 text-red-500" />
                  Discrepancia
                </>
              )}
            </span>
            <span className="tabular-nums">
              {avance.actual.toLocaleString("es")} / {avance.meta.toLocaleString("es")}
            </span>
          </div>
        </div>
      )}

      {/* Desglose demográfico en dos columnas */}
      <div className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <ColumnaDesglose
          datos={parte}
          sinDesglose={!tieneDesgloseParte}
          mensajeSinDesglose={
            avance.tieneParte
              ? "El parte tiene total, pero aún no hay desglose demográfico."
              : "Sin parte de revista."
          }
        />
        <ColumnaDesglose datos={censo} />
      </div>
    </div>
  );
}
