import { Scale, Stethoscope, UserCog, Users } from "lucide-react";
import {
  normalizarPersonal,
  totalJusticia,
  totalPersonalOperativo,
  type PersonalCentro,
} from "@/domain/centrosTransitorios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumInput } from "@/components/ui/num-input";
import { cn } from "@/lib/utils";

interface Props {
  personal: PersonalCentro;
  onCampo: (campo: keyof PersonalCentro, valor: number) => void;
  deshabilitado?: boolean;
  mostrarTotales?: boolean;
}

/**
 * Grid de personal operativo desplegado en un centro (funcionarios, salud y
 * justicia). Mismo estilo de tarjetas que el desglose demográfico por sexo.
 */
export function DesglosePersonal({
  personal,
  onCampo,
  deshabilitado,
  mostrarTotales = true,
}: Props) {
  const p = normalizarPersonal(personal);
  const total = totalPersonalOperativo(p);
  const justicia = totalJusticia(p);

  return (
    <div>
      <div className="space-y-2">
        <FilaPersonal
          titulo="Funcionarios"
          descripcion="Apoyo administrativo y logístico del centro"
          icono={<UserCog className="size-3.5 text-slate-400" />}
          valor={p.funcionarios}
          onChange={(n) => onCampo("funcionarios", n)}
          deshabilitado={deshabilitado}
        />
        <FilaPersonal
          titulo="Médicos"
          descripcion="Personal de salud desplegado"
          icono={<Stethoscope className="size-3.5 text-rose-400" />}
          valor={p.medicos}
          onChange={(n) => onCampo("medicos", n)}
          deshabilitado={deshabilitado}
        />
        <FilaPersonal
          titulo="Psicólogos"
          descripcion="Apoyo psicosocial"
          icono={<Users className="size-3.5 text-violet-400" />}
          valor={p.psicologos}
          onChange={(n) => onCampo("psicologos", n)}
          deshabilitado={deshabilitado}
        />
        <Card size="sm" className="py-2">
          <CardHeader className="px-3 pb-1">
            <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Scale className="size-3.5 text-amber-500" />
              Funcionarios de justicia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-3 pt-0">
            <SubFila
              etiqueta="TJS / Juez de paz"
              valor={p.justicia_tjs}
              onChange={(n) => onCampo("justicia_tjs", n)}
              deshabilitado={deshabilitado}
            />
            <SubFila
              etiqueta="Ministerio Público"
              valor={p.justicia_mp}
              onChange={(n) => onCampo("justicia_mp", n)}
              deshabilitado={deshabilitado}
            />
            <SubFila
              etiqueta="Defensoría del Pueblo"
              valor={p.justicia_defensoria}
              onChange={(n) => onCampo("justicia_defensoria", n)}
              deshabilitado={deshabilitado}
            />
          </CardContent>
        </Card>
      </div>

      {mostrarTotales && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TotalBadge etiqueta="Justicia" valor={justicia} clase="text-amber-400" />
          <TotalBadge etiqueta="Personal total" valor={total} />
        </div>
      )}
    </div>
  );
}

function FilaPersonal({
  titulo,
  descripcion,
  icono,
  valor,
  onChange,
  deshabilitado,
}: {
  titulo: string;
  descripcion?: string;
  icono: React.ReactNode;
  valor: number;
  onChange: (n: number) => void;
  deshabilitado?: boolean;
}) {
  return (
    <Card size="sm" className="py-2">
      <CardContent className="flex items-center justify-between gap-3 px-3">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            {icono}
            {titulo}
          </span>
          {descripcion && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{descripcion}</p>
          )}
        </div>
        <NumInput className="w-24 shrink-0" value={valor} disabled={deshabilitado} onChange={onChange} />
      </CardContent>
    </Card>
  );
}

function SubFila({
  etiqueta,
  valor,
  onChange,
  deshabilitado,
}: {
  etiqueta: string;
  valor: number;
  onChange: (n: number) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-[11px] text-muted-foreground">{etiqueta}</Label>
      <NumInput className="w-24" value={valor} disabled={deshabilitado} onChange={onChange} />
    </div>
  );
}

function TotalBadge({
  etiqueta,
  valor,
  clase,
}: {
  etiqueta: string;
  valor: number;
  clase?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-2 py-1.5 text-center">
      <div className={cn("text-base font-bold text-foreground", clase)}>
        {valor.toLocaleString("es")}
      </div>
      <div className="text-[10px] text-muted-foreground">{etiqueta}</div>
    </div>
  );
}
