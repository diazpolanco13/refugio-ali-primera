import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Lock, SprayCan, Undo2 } from "lucide-react";
import { db } from "@/data/db";
import { deshacerUltimaLimpieza, marcarLimpieza } from "@/data/repos";
import type { Sesion } from "@/data/auth";
import {
  META_POR_TIPO,
  type PuntoServicio,
  type RegistroLimpieza,
  type TipoPunto,
} from "@/domain/tipos";
import { MANTENIMIENTO_TIPOS, formatoDuracion } from "@/domain/limpieza";
import { resumenSalubridad, type ResumenPuntoLimpieza } from "@/domain/salubridad";
import { claveDiaLocal, formatoHora } from "@/domain/distribucion";
import { PanelFlotante } from "@/components/PanelFlotante";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  sesion: Sesion;
  onCerrar: () => void;
}

type Filtro = "todos" | TipoPunto;

const FILTROS: { valor: Filtro; label: string; icono: string }[] = [
  { valor: "todos", label: "Todos", icono: "🧹" },
  ...MANTENIMIENTO_TIPOS.map((t) => ({
    valor: t,
    label: META_POR_TIPO[t]?.label.split(" / ")[0] ?? t,
    icono: META_POR_TIPO[t]?.icono ?? "❓",
  })),
];

export function PanelSalubridad({ sesion, onCerrar }: Props) {
  const rol = sesion.user.rol;
  const puedeEditar = rol === "admin" || rol === "coordinador" || rol === "campo";

  const dia = claveDiaLocal();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Reloj para refrescar los cronómetros de limpieza (cada 30 s).
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const puntos = useLiveQuery(() => db.puntos.toArray(), [], [] as PuntoServicio[]);
  const registros = useLiveQuery(
    () => db.limpiezas.toArray(),
    [],
    [] as RegistroLimpieza[],
  );

  const resumen = useMemo(
    () => resumenSalubridad(dia, puntos, registros, ahora),
    [dia, puntos, registros, ahora],
  );

  const visibles = useMemo(
    () =>
      filtro === "todos"
        ? resumen.puntos
        : resumen.puntos.filter((r) => r.punto.tipo === filtro),
    [resumen.puntos, filtro],
  );

  return (
    <PanelFlotante
      titulo="Salubridad y aseo"
      descripcion="Limpieza de baños, duchas y recolección de basura"
      icono={<SprayCan className="size-4 text-primary" />}
      onCerrar={onCerrar}
    >
      {/* Resumen del día */}
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {resumen.total} punto{resumen.total === 1 ? "" : "s"} de aseo
        </span>
        {resumen.vencidos > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {resumen.vencidos} vencido{resumen.vencidos > 1 ? "s" : ""}
          </Badge>
        )}
        {resumen.total > 0 && resumen.pendientesMeta > 0 && (
          <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-400">
            {resumen.pendientesMeta} sin meta
          </Badge>
        )}
      </div>

      {/* Filtro por tipo */}
      <div className="mb-3 grid grid-cols-4 gap-1.5">
        {FILTROS.map((f) => {
          const activo = f.valor === filtro;
          return (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center transition-colors",
                activo
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <span className="text-lg leading-none">{f.icono}</span>
              <span className="text-[10px] font-medium leading-tight">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de puntos */}
      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {resumen.total === 0
            ? "No hay puntos de baños, duchas ni basura. Colócalos en el mapa para registrar su aseo."
            : "No hay puntos de este tipo."}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visibles.map((r) => (
            <PuntoAseo
              key={r.punto.id}
              r={r}
              dia={dia}
              ahora={ahora}
              puedeEditar={puedeEditar}
            />
          ))}
        </ul>
      )}
    </PanelFlotante>
  );
}

function PuntoAseo({
  r,
  dia,
  ahora,
  puedeEditar,
}: {
  r: ResumenPuntoLimpieza;
  dia: string;
  ahora: number;
  puedeEditar: boolean;
}) {
  const { punto, info, vecesHoy, meta, cumpleMeta, ultima, ultimaPor } = r;
  const meta_icono = META_POR_TIPO[punto.tipo]?.icono ?? "❓";

  return (
    <li>
      <Card
        size="sm"
        className={cn(
          "py-2",
          info?.estado === "vencido" && "border-destructive/40 bg-destructive/5",
          cumpleMeta && info?.estado !== "vencido" && "border-emerald-500/40 bg-emerald-500/5",
        )}
      >
        <CardContent className="flex items-center justify-between gap-2 px-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: info?.color ?? "#94a3b8" }}
              />
              <span className="text-base leading-none">{meta_icono}</span>
              <span className="truncate text-sm font-medium text-foreground">
                {punto.nombre || META_POR_TIPO[punto.tipo]?.label || punto.tipo}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 text-[10px] tabular-nums",
                  cumpleMeta
                    ? "border-emerald-500/40 text-emerald-500"
                    : "text-muted-foreground",
                )}
              >
                {vecesHoy}/{meta} hoy
              </Badge>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {ultima ? (
                <span>
                  Limpio {formatoHora(ultima)} · hace {formatoDuracion(ahora - ultima)}
                  {ultimaPor ? ` · @${ultimaPor}` : ""}
                </span>
              ) : (
                "Sin registro hoy"
              )}
            </div>
          </div>
          {puedeEditar ? (
            <div className="flex shrink-0 items-center gap-1">
              {vecesHoy > 0 && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Deshacer última limpieza"
                  title="Deshacer la última limpieza de hoy"
                  onClick={() => deshacerUltimaLimpieza(punto, dia)}
                >
                  <Undo2 className="size-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={() => marcarLimpieza(punto)}
              >
                <Check className="size-3.5" />
                Limpio
              </Button>
            </div>
          ) : (
            <Lock className="size-3.5 shrink-0 text-muted-foreground/50" />
          )}
        </CardContent>
      </Card>
    </li>
  );
}
