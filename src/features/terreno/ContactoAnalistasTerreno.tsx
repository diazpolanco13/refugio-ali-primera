// Contactos Telegram de analistas SAE del campamento (pie del menú /terreno).

import { Button } from "@/components/ui/button";
import type { AnalistaContactoTerreno } from "@/data/reposCenso";
import { telegramHref, tieneTelefonoContacto } from "@/lib/contacto";

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

/** Nombre corto para el botón (quita rangos largos si hace falta espacio). */
function nombreCorto(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length <= 28) return limpio;
  return `${limpio.slice(0, 26)}…`;
}

/** Pie de menú: contactos Telegram de los analistas SAE del campamento. */
export function ContactoAnalistasTerreno({
  analistas,
}: {
  analistas: AnalistaContactoTerreno[] | null | undefined;
}) {
  const conTelegram = (analistas ?? []).filter(
    (a) => a.telegram && tieneTelefonoContacto(a.telegram),
  );
  if (conTelegram.length === 0) return null;

  return (
    <section
      aria-label="Contacto analistas SAE"
      className="w-full max-w-sm space-y-2.5 px-1"
    >
      <p className="text-center text-xs leading-snug text-muted-foreground">
        Si tiene dudas, contacte a los analistas SAE por Telegram
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {conTelegram.map((a) => {
          const href = telegramHref(a.telegram!);
          if (!href) return null;
          return (
            <Button
              key={`${a.nombre}-${a.telegram}`}
              asChild
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-sky-500/25 bg-card/40 text-xs font-medium text-foreground hover:border-sky-500/40 hover:bg-sky-500/10"
            >
              <a href={href} target="_blank" rel="noreferrer">
                <IconoTelegram className="size-3.5 shrink-0 text-sky-400" />
                <span className="max-w-[11rem] truncate">{nombreCorto(a.nombre)}</span>
              </a>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
