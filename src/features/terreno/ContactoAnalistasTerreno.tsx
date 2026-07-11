// Contactos Telegram de analistas SAE del campamento (pie del menú /terreno).

import { IconoTelegram } from "@/components/IconoTelegram";
import { Button } from "@/components/ui/button";
import type { AnalistaContactoTerreno } from "@/data/reposCenso";
import { telegramHref, tieneTelefonoContacto } from "@/lib/contacto";

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
