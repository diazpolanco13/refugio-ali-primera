import { Fragment, useMemo } from "react";
import { Link, matchPath, useLocation, useSearchParams } from "react-router-dom";
import { useSupabaseQuery } from "@/data/useSupabaseQuery";
import { desenvolver, type FilaSync } from "@/data/desenvolver";
import type { CentroTransitorio } from "@/domain/centrosTransitorios";
import { migasPanDeRuta, type MigaPan } from "@/layouts/migasPan";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function MigasPanLista({ migas, compacto }: { migas: MigaPan[]; compacto?: boolean }) {
  if (migas.length === 0) return null;

  const migasVisibles =
    compacto && migas.length > 2 ? migas.slice(-2) : migas;

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap text-xs sm:text-sm">
        {migasVisibles.map((miga, i) => {
          const esUltima = i === migasVisibles.length - 1;
          return (
            <Fragment key={`${miga.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem
                className={cn(
                  "min-w-0",
                  compacto ? "max-w-[7rem] sm:max-w-[14rem]" : "max-w-[9rem] sm:max-w-[14rem]",
                )}
              >
                {esUltima || !miga.to ? (
                  <BreadcrumbPage className="truncate font-medium">
                    {miga.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={miga.to} className="truncate">
                      {miga.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Migas de pan dinámicas según la ruta actual (incluye nombre del campamento). */
export function MigasPanNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const esMovil = useIsMobile();
  const modoReporte = searchParams.get("reportar") === "1";

  const matchCentro = matchPath("/centro/:id", location.pathname);
  const matchReportesCentro = matchPath("/centros/reportes/:centroId", location.pathname);
  const matchCensoCentro = matchPath("/centros/censo-rapido/:centroId", location.pathname);
  const centroId =
    matchCentro?.params.id ??
    matchReportesCentro?.params.centroId ??
    matchCensoCentro?.params.centroId;

  type CentroFila = CentroTransitorio & { deleted: boolean };
  const filasCentros = useSupabaseQuery<CentroFila, FilaSync<CentroTransitorio>>(
    "centros",
    {
      filter: (q) => q.eq("id", centroId ?? "__none__"),
      transform: desenvolver as (raw: FilaSync<CentroTransitorio>) => CentroFila,
      clientFilter: (c) => !c.deleted,
    },
  );

  const centro = useMemo(
    () => (centroId ? filasCentros.find((c) => c.id === centroId) : undefined),
    [filasCentros, centroId],
  );

  const migas = useMemo(
    () => migasPanDeRuta(location.pathname, searchParams, centro),
    [location.pathname, searchParams, centro],
  );

  return <MigasPanLista migas={migas} compacto={esMovil && modoReporte} />;
}
