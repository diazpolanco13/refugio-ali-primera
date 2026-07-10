// Formulario de identificación del funcionario de campo (censo / terreno).

import { ArrowRight, ClipboardList, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { FuncionarioCenso } from "@/data/reposCenso";
import {
  AvisoCamposFaltantes,
  LabelCampoCenso,
  camposFaltantesFuncionario,
  claseInputFaltante,
  esCampoFaltante,
} from "@/features/censo/censoFormularioShared";
import { cn } from "@/lib/utils";

interface Props {
  funcionario: FuncionarioCenso;
  onChange: (f: FuncionarioCenso) => void;
  onConfirmar: () => void | Promise<void>;
  centroNombre: string;
  /** Texto del botón principal. */
  etiquetaContinuar?: string;
  cargando?: boolean;
  error?: string;
  /** Mostrar avisos de campos faltantes (tras intento fallido). */
  resaltarFaltantes?: boolean;
  onResaltarFaltantes?: () => void;
  /** Acción opcional junto al campamento (p. ej. «Cambiar» centro). */
  accionCentro?: React.ReactNode;
  /** Bloque extra bajo los campos (p. ej. geolocalización del censo). */
  children?: React.ReactNode;
  titulo?: string;
  descripcion?: React.ReactNode;
}

/** Identificación del funcionario que opera en campo. */
export function FormularioIdentificacionFuncionario({
  funcionario,
  onChange,
  onConfirmar,
  centroNombre,
  etiquetaContinuar = "Confirmar e ingresar",
  cargando = false,
  error,
  resaltarFaltantes = false,
  onResaltarFaltantes,
  accionCentro,
  children,
  titulo = "Datos del funcionario",
  descripcion,
}: Props) {
  const faltantes = camposFaltantesFuncionario(funcionario);
  const completo = faltantes.length === 0;

  function setCampo<K extends keyof FuncionarioCenso>(campo: K, valor: FuncionarioCenso[K]) {
    onChange({ ...funcionario, [campo]: valor });
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4 text-primary" />
          {titulo}
        </CardTitle>
        <CardDescription>
          {descripcion ?? (
            <>
              Identifíquese para operar en{" "}
              <span className="font-medium text-foreground">{centroNombre}</span>. Cada persona
              crea su propio acceso temporal.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!completo) {
              onResaltarFaltantes?.();
              return;
            }
            void onConfirmar();
          }}
        >
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
            <MapPin className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Campamento
              </p>
              <p className="truncate text-sm font-medium">{centroNombre}</p>
            </div>
            {accionCentro}
          </div>

          <Separator />
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Funcionario que opera
          </p>

          <div className="space-y-1.5">
            <LabelCampoCenso
              htmlFor="func-jerarquia"
              resaltar={resaltarFaltantes && esCampoFaltante("jerarquia", faltantes)}
            >
              Jerarquía / cargo
            </LabelCampoCenso>
            <Input
              id="func-jerarquia"
              value={funcionario.jerarquia}
              disabled={cargando}
              onChange={(e) => setCampo("jerarquia", e.target.value)}
              placeholder="Ej: Sargento Mayor, Coordinador…"
              className={cn(
                "h-11",
                resaltarFaltantes &&
                  esCampoFaltante("jerarquia", faltantes) &&
                  claseInputFaltante,
              )}
            />
          </div>
          <div className="space-y-1.5">
            <LabelCampoCenso
              htmlFor="func-nombre"
              resaltar={resaltarFaltantes && esCampoFaltante("nombre", faltantes)}
            >
              Nombre y apellido
            </LabelCampoCenso>
            <Input
              id="func-nombre"
              value={funcionario.nombre}
              disabled={cargando}
              onChange={(e) => setCampo("nombre", e.target.value)}
              placeholder="Nombre completo del funcionario"
              className={cn(
                "h-11",
                resaltarFaltantes && esCampoFaltante("nombre", faltantes) && claseInputFaltante,
              )}
            />
          </div>
          <div className="space-y-1.5">
            <LabelCampoCenso
              htmlFor="func-institucion"
              resaltar={resaltarFaltantes && esCampoFaltante("institucion", faltantes)}
            >
              Institución
            </LabelCampoCenso>
            <Input
              id="func-institucion"
              value={funcionario.institucion}
              disabled={cargando}
              onChange={(e) => setCampo("institucion", e.target.value)}
              placeholder="Ej: GNB, Protección Civil, Alcaldía…"
              className={cn(
                "h-11",
                resaltarFaltantes &&
                  esCampoFaltante("institucion", faltantes) &&
                  claseInputFaltante,
              )}
            />
          </div>
          <div className="space-y-1.5">
            <LabelCampoCenso
              htmlFor="func-telefono"
              resaltar={resaltarFaltantes && esCampoFaltante("telefono", faltantes)}
            >
              Teléfono (Telegram)
            </LabelCampoCenso>
            <Input
              id="func-telefono"
              type="tel"
              inputMode="tel"
              value={funcionario.telefono}
              disabled={cargando}
              onChange={(e) => setCampo("telefono", e.target.value)}
              placeholder="0412-0000000"
              className={cn(
                "h-11",
                resaltarFaltantes &&
                  esCampoFaltante("telefono", faltantes) &&
                  claseInputFaltante,
              )}
            />
          </div>

          {children}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <AvisoCamposFaltantes campos={faltantes} visible={resaltarFaltantes} />
            </div>
            <Button
              type="submit"
              className="h-11 w-full shrink-0 sm:w-auto sm:min-w-[14rem]"
              disabled={!completo || cargando}
            >
              {cargando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  {etiquetaContinuar}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
