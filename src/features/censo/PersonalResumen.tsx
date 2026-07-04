import { Scale, Stethoscope, UserCog, Users } from "lucide-react";
import {
  normalizarPersonal,
  totalJusticia,
  totalPersonalOperativo,
  type PersonalCentro,
} from "@/domain/centrosTransitorios";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  personal: Partial<PersonalCentro> | null | undefined;
  compacto?: boolean;
  mostrarEstructura?: boolean;
  className?: string;
}

function Fila({
  etiqueta,
  valor,
  icono,
  siempre,
}: {
  etiqueta: string;
  valor: number;
  icono?: React.ReactNode;
  siempre?: boolean;
}) {
  if (!siempre && !valor) return null;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        {icono}
        {etiqueta}
      </span>
      <Badge
        variant="outline"
        className={cn("px-1.5", valor > 0 ? "text-foreground" : "text-muted-foreground")}
      >
        {valor.toLocaleString("es")}
      </Badge>
    </div>
  );
}

/** Vista de solo lectura del personal operativo desplegado en un centro. */
export function PersonalResumen({
  personal: raw,
  compacto = false,
  mostrarEstructura = false,
  className,
}: Props) {
  const p = normalizarPersonal(raw);
  const total = totalPersonalOperativo(p);
  const justicia = totalJusticia(p);
  const tieneDatos = total > 0;
  const filas = mostrarEstructura || tieneDatos;

  if (!filas) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Sin personal operativo registrado.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "space-y-1.5",
        compacto && "rounded-lg border border-border bg-muted/20 p-2",
        className,
      )}
    >
      {!compacto && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Users className="size-3" />
          Personal operativo
        </div>
      )}
      <Fila
        siempre={mostrarEstructura}
        etiqueta="Funcionarios"
        valor={p.funcionarios}
        icono={<UserCog className="size-3" />}
      />
      <Fila
        siempre={mostrarEstructura}
        etiqueta="Médicos"
        valor={p.medicos}
        icono={<Stethoscope className="size-3" />}
      />
      <Fila siempre={mostrarEstructura} etiqueta="Psicólogos" valor={p.psicologos} />
      {(justicia > 0 || mostrarEstructura) && (
        <>
          <div className="pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <Scale className="mr-1 inline size-3" />
            Justicia
          </div>
          <Fila siempre={mostrarEstructura} etiqueta="TJS / Juez de paz" valor={p.justicia_tjs} />
          <Fila siempre={mostrarEstructura} etiqueta="Ministerio Público" valor={p.justicia_mp} />
          <Fila siempre={mostrarEstructura} etiqueta="Defensoría" valor={p.justicia_defensoria} />
        </>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5 text-xs">
          <span className="font-medium text-muted-foreground">Total personal</span>
          <Badge variant="outline" className="px-1.5 font-semibold">
            {total.toLocaleString("es")}
          </Badge>
        </div>
      )}
    </div>
  );
}
