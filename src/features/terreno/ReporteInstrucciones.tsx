// Pantalla de bienvenida del Reporte diario en terreno (equivalente a
// CensoInstrucciones): se muestra una vez por dispositivo antes de entrar al
// flujo del reporte, con el resumen de las fases del formulario.

import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  LockKeyhole,
  Package,
  Send,
  ShieldCheck,
  Users,
  Wrench,
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

/** Soporte de los reportes (no mostrar en UI; solo enlace a Telegram). */
const TELEGRAM_SOPORTE_REPORTE = "+584129317099";

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

/** Pantalla de inicio con instrucciones básicas para el reporte diario. */
export function ReporteInstrucciones({ onContinuar }: Props) {
  const enlaceTelegram = telegramHref(TELEGRAM_SOPORTE_REPORTE);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-lg">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-primary" />
          Instrucciones del reporte diario
        </CardTitle>
        <CardDescription>Lea esto antes de enviar el parte del campamento.</CardDescription>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <BloqueInstruccion icono={BookOpen} titulo="¿Qué es?">
          El <strong className="font-medium text-foreground">parte del día</strong> de su campamento: población,
          situación operativa y novedades. Se reporta{" "}
          <strong className="font-medium text-foreground">una vez al día</strong>; puede corregirlo durante la
          jornada y la última edición es la que vale.
        </BloqueInstruccion>

        <BloqueInstruccion icono={LockKeyhole} titulo="Requiere usuario">
          A diferencia del registro, el reporte pide{" "}
          <strong className="font-medium text-foreground">usuario y contraseña</strong>. Si no tiene acceso,
          solicítelo a la sala situacional.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Users} titulo="1 · Parte numérico">
          Damnificados, familias y desglose por edad y sexo, más los casos de salud del día. Si nada cambió respecto
          a ayer, use <strong className="font-medium text-foreground">«Confirmar sin cambios»</strong>.
        </BloqueInstruccion>

        <BloqueInstruccion icono={ShieldCheck} titulo="2 · Control operativo">
          Situación de seguridad y funcionamiento del campamento (aseguramiento, servicios, orden interno).
        </BloqueInstruccion>

        <BloqueInstruccion icono={Wrench} titulo="3 · Trabajos">
          Reparaciones y acondicionamientos en marcha. Revise la lista y confirme lo que sigue vigente.
        </BloqueInstruccion>

        <BloqueInstruccion icono={Package} titulo="4 · Requerimientos">
          Lo que el campamento necesita (insumos, dotación, personal). Sea específico con cantidades.
        </BloqueInstruccion>

        <BloqueInstruccion icono={CalendarPlus} titulo="5 · Novedades y eventos">
          Hechos resaltantes del día: supervisiones, ingresos y salidas, incidencias. Lo urgente márquelo como tal
          para que la sala lo vea de inmediato.
        </BloqueInstruccion>

        {enlaceTelegram && (
          <BloqueInstruccion icono={Send} titulo="¿Dudas o problemas?">
            Si tiene alguna pregunta sobre el reporte,{" "}
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

      <CardFooter className="shrink-0 border-t border-border pt-4">
        <Button type="button" className="h-11 w-full" onClick={onContinuar}>
          Entendido, continuar
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
