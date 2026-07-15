import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/centros/censo", label: "Por campamento", icono: LayoutGrid, exact: true },
  // Staging (censo_registros): planilla previa; el listado nominal vive en /centros/refugiados.
  { to: "/centros/censo/personas", label: "Censo anterior", icono: List, exact: false },
] as const;

export function CensoRedTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/20 p-1">
      {TABS.map(({ to, label, icono: Icono, exact }) => {
        const activo = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activo
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icono className="size-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
