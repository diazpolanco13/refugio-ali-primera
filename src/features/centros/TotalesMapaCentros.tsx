import type { ReactNode } from "react";
import { Home, PawPrint, ShieldCheck, Users, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { totalUnidadesConteo } from "@/domain/complejosCentros";
import {
  centrosDeProduccion,
  normalizarCentro,
  poblacionCentro,
  totalPersonalOperativo,
  type CentroTransitorio,
} from "@/domain/centrosTransitorios";
import { cn } from "@/lib/utils";

interface Props {
  centros: CentroTransitorio[];
  className?: string;
}

function KpiMapa({
  icono,
  etiqueta,
  valor,
}: {
  icono: ReactNode;
  etiqueta: string;
  valor: number;
}) {
  return (
    <Card
      size="sm"
      className="min-w-[6.5rem] shrink-0 border-white/10 bg-background/60 py-2 shadow-lg shadow-black/25 backdrop-blur-md lg:min-w-0"
    >
      <CardContent className="flex items-center gap-2 px-2.5 sm:px-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-primary ring-1 ring-white/10">
          {icono}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {etiqueta}
          </span>
          <span className="block text-sm font-bold tabular-nums leading-tight text-foreground sm:text-base">
            {valor.toLocaleString("es")}
          </span>
        </span>
      </CardContent>
    </Card>
  );
}

/** Totales visibles del mapa calculados desde el parte vigente de cada campamento. */
export function TotalesMapaCentros({ centros, className }: Props) {
  let familias = 0;
  let refugiados = 0;
  let personal = 0;
  let mascotas = 0;

  for (const centro of centrosDeProduccion(centros)) {
    const normalizado = normalizarCentro(centro);
    familias += normalizado.familias_ocupadas;
    refugiados += poblacionCentro(normalizado);
    personal += totalPersonalOperativo(normalizado.personal);
    mascotas += normalizado.ocupacion.mascotas;
  }

  return (
    <div
      className={cn(
        // Grid 5 cols solo en lg+: en tablet (md) el ancho no alcanza y las cards
        // se aplastaban a solo icono. Hasta lg se mantiene fila con scroll.
        "pointer-events-auto flex gap-1.5 overflow-x-auto scrollbar-oculto lg:grid lg:grid-cols-5 lg:gap-2 lg:overflow-visible",
        className,
      )}
    >
      <KpiMapa
        icono={<Home className="size-3.5" />}
        etiqueta="Camp."
        valor={totalUnidadesConteo(centrosDeProduccion(centros))}
      />
      <KpiMapa icono={<Users2 className="size-3.5" />} etiqueta="Fam." valor={familias} />
      <KpiMapa icono={<Users className="size-3.5" />} etiqueta="Damnif." valor={refugiados} />
      <KpiMapa icono={<ShieldCheck className="size-3.5" />} etiqueta="Func." valor={personal} />
      <KpiMapa icono={<PawPrint className="size-3.5" />} etiqueta="Masc." valor={mascotas} />
    </div>
  );
}
