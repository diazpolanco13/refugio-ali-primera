import {
  ArrowRight,
  Baby,
  BookOpen,
  ClipboardList,
  LocateFixed,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { telegramHref } from "@/lib/contacto";

/** Soporte del censo (no mostrar en UI; solo enlace a Telegram). */
const TELEGRAM_SOPORTE_CENSO = "+584129317099";

interface Props {
  onContinuar: () => void;
}

function BloqueInstruccion({
  icono: Icono,
  titulo,
  children,
}: {
  icono: typeof BookOpen;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icono className="size-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium leading-snug">{titulo}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/** Pantalla de inicio con instrucciones básicas para el funcionario censador. */
export function CensoInstrucciones({ onContinuar }: Props) {
  const enlaceTelegram = telegramHref(TELEGRAM_SOPORTE_CENSO);

  return (
    <Card className="-mt-3 flex min-h-[calc(100dvh-9rem)] flex-col shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-primary" />
          Instrucciones para el censo
        </CardTitle>
        <CardDescription>Lea esto antes de comenzar el registro en el campamento.</CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <BloqueInstruccion icono={ClipboardList} titulo="¿Qué es?">
          Planilla para registrar a las <strong className="font-medium text-foreground">personas damnificadas</strong>{" "}
          de un <strong className="font-medium text-foreground">campamento transitorio</strong>. Cada registro se
          guarda al instante.
        </BloqueInstruccion>

        <BloqueInstruccion icono={BookOpen} titulo="Pasos">
          <span className="block">
            <strong className="font-medium text-foreground">1. Campamento</strong> — Elija el campamento e
            identifíquese.
          </span>
          <span className="block">
            <strong className="font-medium text-foreground">2. Registro</strong> — Ingrese los datos de cada persona.
          </span>
          <span className="block">
            <strong className="font-medium text-foreground">3. Registrados</strong> — Revise la lista y confirme el
            cierre al terminar.
          </span>
        </BloqueInstruccion>

        <BloqueInstruccion icono={Users} titulo="Varios funcionarios">
          Varios funcionarios pueden censar el mismo campamento a la vez, cada uno desde su dispositivo. Coordinen
          zonas o familias y revise en «Registrados» antes de registrar para no duplicar personas.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Baby} titulo="Niños y niñas">
          En menores de 18 años indique el parentesco con el jefe de familia. Registre primero al padre, madre o
          representante y luego a los hijos, para anotar la cédula del representante. Si no la conoce, marque «No se
          conoce» y continúe.
        </BloqueInstruccion>

        <BloqueInstruccion icono={LocateFixed} titulo="Geolocalización">
          Geolocalizar ayuda a validar que está en el campamento, pero no es obligatorio: si falla el GPS o no hay
          permiso, puede continuar igual.
        </BloqueInstruccion>

        {enlaceTelegram && (
          <BloqueInstruccion icono={Send} titulo="¿Dudas o problemas?">
            Si tiene alguna pregunta sobre el uso de la planilla,{" "}
            <a
              href={enlaceTelegram}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              escríbanos por Telegram
            </a>
            .
          </BloqueInstruccion>
        )}
      </CardContent>

      <CardFooter className="border-t border-border pt-4">
        <Button type="button" className="h-11 w-full" onClick={onContinuar}>
          Entendido, comenzar
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
