import { MessageCircle, Phone } from "lucide-react";
import {
  telHref,
  telegramHref,
  tieneTelefonoContacto,
  whatsappHref,
} from "@/lib/contacto";
import { IconoTelegram } from "@/components/IconoTelegram";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Llamar, WhatsApp y Telegram para un teléfono de contacto. */
export function AccionesContacto({
  telefono,
  className,
}: {
  telefono: string;
  className?: string;
}) {
  const limpio = telefono.trim();
  if (!tieneTelefonoContacto(limpio)) return null;

  const wa = whatsappHref(limpio);
  const tg = telegramHref(limpio);

  return (
    <div className={cn("flex shrink-0 gap-1", className)}>
      <Button asChild size="icon-sm" variant="outline">
        <a href={telHref(limpio)} title="Llamar">
          <Phone className="size-3.5" />
        </a>
      </Button>
      {wa && (
        <Button
          asChild
          size="icon-sm"
          variant="outline"
          className="border-emerald-500/30 text-emerald-400"
        >
          <a href={wa} target="_blank" rel="noreferrer" title="WhatsApp">
            <MessageCircle className="size-3.5" />
          </a>
        </Button>
      )}
      {tg && (
        <Button
          asChild
          size="icon-sm"
          variant="outline"
          className="border-sky-500/30 text-sky-400"
        >
          <a href={tg} target="_blank" rel="noreferrer" title="Telegram">
            <IconoTelegram className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}
