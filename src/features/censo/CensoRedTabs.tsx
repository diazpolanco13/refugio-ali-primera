import { Link, useLocation } from "react-router-dom";
import { FileSpreadsheet, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  DESC_IMPORTACIONES_EXCEL,
  LABEL_IMPORTACIONES_EXCEL,
} from "@/domain/importacionesExcel";

const TABS = [
  { to: "/centros/censo", label: "Por campamento", icono: LayoutGrid, exact: true },
  // censo_registros origen=import_excel: relaciones externas no verificadas.
  {
    to: "/centros/censo/personas",
    label: LABEL_IMPORTACIONES_EXCEL,
    icono: FileSpreadsheet,
    exact: false,
    title: DESC_IMPORTACIONES_EXCEL,
  },
] as const;

export function CensoRedTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/20 p-1">
      {TABS.map((tab) => {
        const { to, label, icono: Icono, exact } = tab;
        const title = "title" in tab ? tab.title : undefined;
        const activo = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            title={title}
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
