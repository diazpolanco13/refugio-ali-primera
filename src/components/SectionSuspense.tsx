import { Suspense, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Boundary de Suspense tipado para rutas/secciones dentro del shell.
 * Uso: `<SectionSuspense fallback={<MapaSectionSkeleton />}><Vista /></SectionSuspense>`
 */
export function SectionSuspense({ fallback, children }: Props) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
