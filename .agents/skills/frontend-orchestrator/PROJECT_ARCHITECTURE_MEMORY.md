# Project Architecture Memory — Campamentos Transitorios

> Actualizar en F6 de cada orquestación. Fecha de snapshot: 2026-07-10.

## Propósito del producto

Dashboard operativo de **Campamentos Transitorios** (CCCM / crisis, Caracas): mapa de centros, reportes diarios, censo, población, incidencias/denuncias, configuración SEBIN, bitácora.

## Stack

| Capa | Tecnología |
|------|------------|
| Build | Vite 7 + TypeScript 5.8 |
| UI | React 19, Tailwind 4, shadcn/ui (Radix), CVA, Lucide |
| Routing | react-router-dom 7, lazy routes + Suspense |
| Maps | maplibre-gl 5, terra-draw |
| Backend | Supabase (JS client + edge functions) |
| Charts/PDF | recharts, @react-pdf/renderer, jspdf |

## Estructura de carpetas (frontend)

```
src/
  App.tsx                 # rutas lazy + Suspense por sección (skeletons)
  index.css               # tokens / tema dark + skeleton-shimmer
  components/             # shell + shared + ui/*
  components/ui/          # primitivas shadcn (incl. skeleton shimmer|pulse)
  components/skeletons/   # frames y primitivas de loading compartidas
  contexts/               # MapaCentrosContext
  data/                   # supabaseClient, auth, repos*, use*
  domain/                 # permisos, tipos, reglas
  features/               # centros, censo, incidencias, refugiados, …
  layouts/                # AppShell, migas
  map/                    # estiloMapa, escalaVista
  lib/                    # utils (cn), splash, helpers
```

## Decisiones arquitectónicas vigentes

1. **Sin TanStack Query / Zustand / Redux** por ahora — hooks `use*` + Context puntuales.
2. **Lazy por vista pesada** en `App.tsx`; precarga del chunk de ruta inicial durante restore de sesión.
3. **Shell estable:** `AppShell` = Sidebar + TopBar + Outlet; mapa provider envuelve el shell.
4. **Permisos en dominio** (`domain/permisos.ts`) filtran menú y rutas.
5. **UI en español** en labels y muchos nombres de componentes de feature.
6. **Skeleton primitivo:** `components/ui/skeleton.tsx` con `variant: "shimmer" | "pulse"`; menú: `SidebarMenuSkeleton` (pulse).
7. **Loading de arranque:** `PantallaCarga` (brand + spinner) — solo boot/sesión y rutas públicas (`/censo`).
8. **Fallbacks autenticados:** skeletons de sección por familia de layout (`SectionSuspense` + `*Skeleton`); sidebar/TopBar permanecen montados.
9. **Design system:** shadcn; preferir MCP/registry antes de inventar primitivas.
10. **`useSupabaseQueryConEstado`:** expone `{ datos, cargando, error }` para skeletons; `useSupabaseQuery` sigue devolviendo `T[]`.

## Componentes base relevantes

| Componente | Rol |
|------------|-----|
| `AppShell` | Layout global |
| `AppSidebar` | Menú lateral por rol |
| `TopBar` | Barra superior / online |
| `PantallaCarga` | Boot / sesión / `/censo` |
| `SectionSuspense` | Boundary Suspense tipado |
| `SectionSkeletonFrame` + `Loading*` | Primitivas de loading |
| `EstadoVacio` / `EstadoError` | Empty / error presentacionales |
| `MapaSectionSkeleton` | Fallback + loading datos del mapa |
| `Skeleton` / `SidebarMenuSkeleton` | Loading UI |
| `CentrosMap` + controles | Mapa operativo |
| `MapaCentrosProvider` | Estado mapa compartido |

## Rutas del menú lateral (referencia)

Según rol (no todas visibles siempre):

- Pantalla (`/dashboard`) → `DashboardViewSkeleton`
- Mapa (`/centros/mapa`) → `MapaSectionSkeleton`
- Campamentos / tablero (`/centros/tablero`) → `TableroCampamentosSkeleton`
- Reportes diarios red + subsecciones ficha centro → `TablaRedSkeleton` / `FichaCentroSkeleton`
- Censo rápido red (`/centros/censo-rapido`) → `TablaRedSkeleton`
- Población red (`/centros/refugiados`) → `TablaRedSkeleton`
- Bandejas incidencias → `BandejaIncidenciasSkeleton`
- Gestión usuarios, Unidades SEBIN → `GestionSkeleton`
- Logs → `LogsSkeleton`
- Items “En desarrollo” (traslados, preferencias)

## Patrones de fetching

- `useX` hooks en `src/data/` retornan data + loading + error
- `useSupabaseQueryConEstado` para vistas skeletonizadas
- Repos encapsulan Supabase
- Bootstrap de unidades SEBIN en shell (`useBootstrapUnidadesSebin`)

## Estilo visual / tokens

- Dark operativo, `bg-background`, acento `primary`
- Densidad alta, sin cards decorativas en shell
- Skeletons: `bg-muted` + shimmer (`.animate-skeleton-shimmer`) o pulse
- Font: Geist variable

## Deuda conocida / oportunidades

- Distinguir `isRefreshing` vs loading inicial en hooks densos (casos salud, denuncias)
- Skeleton específico por subsecciones de ficha de centro
- Prefetch on hover de chunks desde el sidebar

## Feature usuarios (gestión)

- Cobertura de centros: helpers puros en `features/usuarios/coberturaCentros.ts` (unión de `centros_asignados` de roles con `rolUsaCentrosAsignados`)
- Filtro/búsqueda: `filtrarUsuarios.ts`; UI en `BarraFiltrosUsuarios` (Input + Tabs) + KPIs `ResumenCoberturaCentros`
- `TarjetaUsuario` colapsable (≤3 chips + expandir); contenedor `GestionUsuarios` solo orquesta

## Historial de orquestaciones

| Fecha | Tema | Notas |
|-------|------|-------|
| 2026-07-10 | Skeletons menú+mapa | Implementado: contrato shimmer, familias, wire App.tsx, useSupabaseQueryConEstado |
| 2026-07-10 | Gestión usuarios UX | Buscador, KPIs cobertura, Tabs por rol, chips colapsables |
