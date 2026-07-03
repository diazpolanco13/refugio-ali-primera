import { MessageCircle, Phone } from "lucide-react";
import {
  telHref,
  telegramHref,
  tieneTelefonoContacto,
  whatsappHref,
} from "@/lib/contacto";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function IconoTelegram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

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
