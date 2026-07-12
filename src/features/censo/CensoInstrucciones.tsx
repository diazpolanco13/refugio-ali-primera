import {
  ArrowRight,
  Baby,
  BookOpen,
  ClipboardList,
  Home,
  ListChecks,
  Send,
  ShieldAlert,
  Users,
  WifiOff,
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
        <div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/** Pantalla de inicio: cómo censar por cédula (Nexus) y armar el hogar. */
export function CensoInstrucciones({ onContinuar }: Props) {
  const enlaceTelegram = telegramHref(TELEGRAM_SOPORTE_CENSO);

  return (
    <Card className="-mt-3 flex min-h-[calc(100dvh-9rem)] flex-col shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-primary" />
          Instrucciones para el censo
        </CardTitle>
        <CardDescription>
          Lea esto una vez. El registro se hace por cédula y se agrupa por familia.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <BloqueInstruccion icono={ClipboardList} titulo="¿Qué hace esta planilla?">
          Registra a las{" "}
          <strong className="font-medium text-foreground">personas damnificadas</strong> de un{" "}
          <strong className="font-medium text-foreground">campamento</strong>, verificando la
          identidad con la cédula y formando el{" "}
          <strong className="font-medium text-foreground">hogar</strong> (jefe/a + familiares).
          Cada alta se guarda al instante.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Home} titulo="Orden correcto (importante)">
          <ol className="list-decimal space-y-1.5 pl-3.5">
            <li>
              <strong className="font-medium text-foreground">Empiece por el jefe o jefa</strong>{" "}
              de familia (quien representa el hogar en el campamento).
            </li>
            <li>
              Digite la cédula → verifique nombre y datos → confirme si es jefe/a.
            </li>
            <li>
              Complete la{" "}
              <strong className="font-medium text-foreground">damnificación</strong> (vivienda y
              pérdidas) y cree el hogar.
            </li>
            <li>
              Después agregue al resto: cónyuge, hijos con cédula y menores sin documento.
            </li>
          </ol>
        </BloqueInstruccion>

        <BloqueInstruccion icono={Baby} titulo="Niños y personas sin cédula">
          Los menores (u otros sin documento) se agregan{" "}
          <strong className="font-medium text-foreground">dentro del hogar ya creado</strong>, no
          como un hogar aparte. Indique el parentesco con el jefe/a. No invente una cédula.
        </BloqueInstruccion>

        <BloqueInstruccion icono={ListChecks} titulo="Las tres pestañas">
          <ul className="list-disc space-y-1.5 pl-3.5">
            <li>
              <strong className="font-medium text-foreground">Censo</strong> — registro por cédula
              (vía principal).
            </li>
            <li>
              <strong className="font-medium text-foreground">Censados</strong> — avance vs el
              parte, lista de personas y familias (puede expandir cada hogar).
            </li>
            <li>
              <strong className="font-medium text-foreground">Censo Manual</strong> — solo aparece
              si Nexus está fuera de línea.
            </li>
          </ul>
        </BloqueInstruccion>

        <BloqueInstruccion icono={WifiOff} titulo="Si Nexus no está en línea">
          Verá el aviso «Nexus fuera de línea». Puede usar cédulas ya consultadas (caché) o la
          pestaña <strong className="font-medium text-foreground">Censo Manual</strong>. Cuando
          Nexus vuelva, el manual se oculta solo.
        </BloqueInstruccion>

        <BloqueInstruccion icono={ShieldAlert} titulo="Cédula ya registrada">
          Si la cédula ya figura en otro campamento, la planilla se detiene y muestra fecha y
          lugar. No cree un segundo hogar: reporte a los analistas SAE (Telegram / WhatsApp del
          aviso) o confirme solo si le indican que debe continuar.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Users} titulo="Varios censistas a la vez">
          Varios dispositivos pueden censar el mismo campamento. Coordinen por zona o por
          familias y revise <strong className="font-medium text-foreground">Censados</strong>{" "}
          antes de registrar, para no duplicar personas.
        </BloqueInstruccion>

        {enlaceTelegram && (
          <BloqueInstruccion icono={Send} titulo="¿Dudas o problemas?">
            Si la cédula no aparece, el hogar no se crea o tiene un error de datos,{" "}
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
