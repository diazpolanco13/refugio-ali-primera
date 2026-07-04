# CLAUDE.md — Guía para continuar el proyecto

> Documento de traspaso. Si eres una IA/desarrollador retomando este proyecto
> (por ejemplo desde el VPS), **lee esto primero**. Explica qué es, hacia dónde
> va, qué está hecho, cómo ejecutarlo y qué falta. El proyecto y sus comentarios
> están en **español**; mantén ese idioma.

## Qué es

Herramienta de **gestión humanitaria (CCCM)** para la emergencia de Caracas/La
Guaira tras la tragedia del **24-jun-2026**. Nació como **Sala Situacional** de un
solo refugio, el **Parque del Oeste "Alí Primera"**, y tras el desalojo del parque
migró a gestionar la **red de ~50 Centros Transitorios** repartidos por el Área
Metropolitana y Gran Caracas. Hoy el producto es **la red de centros**: registrar
el **estado, capacidad y ocupación** de cada centro, decidir **a dónde reubicar
gente** (cupo real / cuello de botella) y seguir la **evolución diaria de la
ocupación** de toda la red.

> El módulo original del Parque "Alí Primera" (mapa por sectores, puntos de
> servicio, distribución de comida, salubridad) **fue retirado** del producto
> (commit `803d499`). El repositorio ya no contiene ese código. La herramienta
> actual se centra exclusivamente en `/centros` y `/dashboard`.

**Soberanía de datos:** todo se autoaloja. La capa de datos vive en un
**Supabase** propio (Postgres + Auth + Realtime + Storage) del proyecto
`xzwifkckkakldnzkdeby`. La PWA se sirve desde el VPS del usuario vía Dokploy. No
se usan nubes de terceros más que Supabase. **Único uso de Supabase Storage:**
las **fotos de los centros** (bucket público `centros-fotos`); el resto de los
datos viven en Postgres.

## Estado actual

- ✅ **Migración a Supabase completa (Fases 1–7).** Se eliminó el backend Fastify
  propio, el offline-first (Dexie/outbox/sync engine), el JWT propio y PGlite. La
  app ahora habla directo con Supabase vía `@supabase/supabase-js` (Postgres,
  Auth, Realtime, Storage) desde el frontend.
- ✅ **Esquema Supabase:** 10 tablas (7 sync blob+jsonb + `ocupaciones_centros`
  + `perfiles` + `historial`), RLS por rol, Edge Function `create-user`. Ver
  sección "Supabase — esquema y RLS".
- ✅ **Datos migrados:** 49 centros del Excel + snapshot inicial 2026-07-03 en
  `ocupaciones_centros`; usuarios migrados a `auth.users` + `perfiles` (admin +
  xavier, login verificado).
- ✅ **Frontend:** nueva capa `src/data/` (supabaseClient, authSupabase,
  useSupabaseQuery, reposSupabase, useOcupacionesCentros, desenvolver). Todos
  los componentes migrados a Supabase (login, centros, dashboard, usuarios).
- ✅ **Histórico de ocupación:** tabla `ocupaciones_centros`, gráfico individual
  en `DetalleCentro` y agregado de la red en `DashboardView` (Fase 6).
- ✅ **Cutover de producción (Fase 7):** `server/` eliminado, `docker-compose`/
  `Dockerfile.web`/`Caddyfile` actualizados, `refugio-backend` detenido en
  Dokploy, frontend redeployado. (Ver "Producción REAL".)

### Qué falta / próximos pasos

- 🧩 **Gestión de usuarios (gaps):** la Edge Function `create-user` cubre
  **crear** usuarios. **Eliminar usuarios** y **cambiar la password de otro
  usuario** requieren futuras Edge Functions (hoy solo Supabase Studio o el MCP
  pueden hacerlo con `service_role`).
- 🔁 **Traslados entre centros:** hoy el tablero es comparativo (decides tú).
  Falta (si se pide) registrar/rastrear **movimientos de refugiados entre
  centros** y, opcionalmente, un motor de sugerencias de reubicación.
- 🗑️ **Limpieza menor:** queda `src/data/centrosTransitorios.ts` (catálogo
  estático de los 50 centros) como fallback/ referencia; la fuente de verdad
  ahora es la tabla `centros` en Supabase. Se puede eliminar del bundle más
  adelante.
- 📊 **Dashboard de la red:** hoy `/dashboard` agrega la red. Se puede ampliar
  con mapa de calor por parroquia, series por grupo (Área Metropolitana vs Gran
  Caracas), etc.

## Cómo ejecutar (desarrollo)

```bash
# Frontend (raíz). Único proceso: ya no hay backend propio.
npm install
npm run dev   # http://localhost:5173
npm run build # genera dist/ (PWA)
npm run typecheck
```

Requiere `.env` local (no se commitea) con:
```
VITE_SUPABASE_URL=https://xzwifkckkakldnzkdeby.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_MAPTILER_KEY=           # opcional, bases "HD"
```
Sin `VITE_SUPABASE_*` la app no puede loguear ni leer datos.

**Atajo (recomendado):** `./reiniciar.sh` levanta el frontend (:5173) en
segundo plano. Subcomandos: `update` (git pull ff-only + reinicia), `stop`,
`logs`. Reinstala dependencias solo si cambió `package-lock.json`. ⚠️ Es **solo
desarrollo**; **no** toca producción.

## Stack

**Frontend:** React 19 + Vite 7 + TypeScript + Tailwind v4 (plugin
`@tailwindcss/vite`, sin config) · **MapLibre GL** (mapa) + **Terra Draw**
(dibujo) · **@supabase/supabase-js** (Postgres, Auth, Realtime, Storage) ·
**vite-plugin-pwa** (service worker para caché de assets) · **react-router-dom**
(rutas `/`, `/dashboard`, `/usuarios`) · **recharts** (gráficos, vía componente
`chart` de shadcn). UI con **shadcn/ui** (Radix + cva + `cn()` en
`src/lib/utils.ts`, componentes en `src/components/ui/`, estilo `radix-nova` en
`components.json`).

**Capa de datos:** **Supabase** (Postgres + Auth + Realtime + Storage),
accedida vía `@supabase/supabase-js` desde el frontend. No hay backend propio:
cada mutación es un `upsert`/`delete` directo a Postgres; Realtime
(`postgres_changes`) refresca la UI en todos los dispositivos conectados. La
creación de usuarios se hace con una **Edge Function** (`create-user`) que usa
`service_role` (el frontend nunca tiene esa key).

## Arquitectura del frontend

```
src/
├─ domain/ tipos.ts (modelo + catálogos), estandares.ts (Esfera),
│  centrosTransitorios.ts (modelo del centro + normalizar),
│  capacidadCentros.ts (cupo real / cuello de botella según Esfera),
│  redCentros.ts (KPIs y agregados de la red),
│  prioridadCentros.ts (orden de urgencia),
│  serieOcupacionCentros.ts (series temporales con carry-forward),
│  permisos.ts (roles y permisos)
├─ data/ supabaseClient.ts (cliente supabase-js con VITE_SUPABASE_*),
│  authSupabase.ts (login/signOut/onAuthStateChange + perfil desde `perfiles`),
│  useSupabaseQuery.ts (hook select + Realtime, reemplaza a useLiveQuery),
│  useSupabaseConectado.ts (estado de conexión a Realtime para la UI),
│  useOcupacionesCentros.ts (snapshots de `ocupaciones_centros` con Realtime),
│  reposSupabase.ts (upserts/Deletes + snapshot de ocupación al guardar centro),
│  desenvolver.ts (aplana filas blob+jsonb `{id,updated_at,deleted,data}` → T),
│  supabase.ts (subida de foto de centro al bucket `centros-fotos`),
│  centrosTransitorios.ts (catálogo estático de los 50 centros, fallback),
│  preferenciasMapa.ts (vista guardada en localStorage)
├─ map/ MapView.tsx (MapLibre + Terra Draw + marcadores HTML), estiloMapa.ts
├─ features/ centros/ (FOCO: CentrosView, CentrosMap, MarcadorCentro, InfoCentro,
│  DetalleCentro, TableroCentros, CentroForm, LevantamientoCentro,
│  RequerimientosCentro, PanelCentros, GraficoOcupacionCentro) ·
│  dashboard/ (DashboardView, GraficoOcupacionRed) ·
│  censo/ (DesgloseDemografico, DesglosePersonal, PersonalResumen) ·
│  tablero/ (DemografiaResumen) ·
│  auth/Login · usuarios/GestionUsuarios
├─ components/ Navbar, PanelFlotante, MarcaAgua, BadgeRol, PantallaCarga,
│  AccionesContacto · ui/ (componentes shadcn: card, chart, badge…)
├─ lib/ utils.ts (cn())
└─ ui/ (legacy) Modal, clases.ts — solo quedan restos en PuntoForm/LineaForm
```

Rutas (react-router en `src/main.tsx` + `src/App.tsx`): `/` = `CentrosView`
(red de Centros Transitorios, **foco actual**), `/dashboard` = `DashboardView`
(sala de control a pantalla completa, solo lectura), `/usuarios` =
`GestionUsuarios` (admin). En prod Traefik (Dokploy) hace fallback SPA a
`index.html`; en la PWA se añadió `navigateFallback` en `vite.config.ts` para
deep-link offline a esas rutas.

Conceptos del dominio (ver `src/domain/tipos.ts`):
- **`Vulnerables`**: desglose demográfico por edad y sexo con grupos etarios
  excluyentes que suman la población: recién nacidos (0-2), niñez (3-11),
  adolescentes (12-17), adultos (18-59), adultos mayores (60+); más grupos
  transversales `embarazadas` y `discapacidad/patologías` (subconjuntos que
  pueden solaparse); y `mascotas` (conteo aparte que **no** suma como
  población). `normalizarVulnerables` tolera filas viejas sin los campos nuevos
  (default 0).
- **CentroTransitorio**: levantamiento de campo (secciones I–VI:
  identificación, coordinación, seguridad, servicios sí/no, población,
  novedades), `requerimientos[]`, `capacidad` (camas/duchas/pocetas/lavaderos/
  contenedores **instaladas vs operativas** + agua tanque/operativa/litros),
  `ocupacion` (`Vulnerables`), **`personal`** (`PersonalCentro`: funcionarios,
  médicos, psicólogos, justicia TJS/MP/Defensoría), `familias_ocupadas`,
  `responsables`, `foto_url`, `estado`, `notas`. Helpers: `poblacionCentro()`
  (refugiados), `totalPersonalOperativo()`, `personasLogistica()` (refugiados +
  personal → demanda de agua/comida/baños).
- **Cuello de botella** (`capacidadCentros.ts`, pura): `analisisCentro(centro)`
  usa **`personasLogistica`** para calcular requerimientos Esfera (pocetas
  1/20, duchas 1/50, agua 15 l/persona/día; camas 1:1), toma la **capacidad
  efectiva = mínimo** entre los recursos medidos, y de ahí **`cupoReal`** y
  **`cuelloDeBotella`**. Semáforo verde/amarillo/rojo por % de ocupación.
- Todo lleva `id`, `updated_at`, `updated_by` (con sesión = `user.username`).

## Supabase — esquema y RLS

Proyecto `xzwifkckkakldnzkdeby`. 10 tablas en el schema `public`:

**7 tablas sincronizables (blob + jsonb, idénticas al backend Fastify viejo):**
`sectores`, `puntos`, `lineas`, `censos`, `distribuciones`, `limpiezas`,
`centros`. Esquema: `id text PK, updated_at bigint, updated_by text, deleted
bool, data jsonb`. `centros` además tiene `geom geography(Point, 4326)` (PostGIS)
aparte del blob. Upsert **last-write-wins** (`updated_at`); borrado **suave**
(`deleted: true`). El frontend usa `desenvolver()` para aplanar `data` + metadatos
al tipo de dominio.

**`ocupaciones_centros`** (tipada, el histórico): `id uuid PK default
gen_random_uuid()`, `centro_id text not null references centros(id) on delete
cascade`, `dia date not null`, `ts bigint`, `total_afectados int`, `familias
int`, `personal_total int`, `ocupacion jsonb`, `updated_at bigint`,
`updated_by text`, **`unique(centro_id, dia)`** (una fila por centro por día; la
última edición del día gana), índices en `(dia)` y `(centro_id, dia)`.

**`perfiles`**: `user_id uuid references auth.users`, `username text unique`,
`nombre`, `rol check in (admin, coordinador, campo, visor)`,
`sector_asignado`, `jerarquia`, `cedula`, `responsabilidad`, `whatsapp`,
`telegram`, `brazalete`, `hash_id unique`, `marca_agua bool default true`,
`created_at timestamptz default now()`. Vinculada a `auth.users` por `user_id`.
Los usuarios de campo no tienen email real → se usa el sintético
`<username>@refugio.app` en `auth.users`.

**`historial`**: `id uuid, ts bigint, usuario text, accion, entidad,
entidad_id, detalle jsonb`. Bitácora (pendiente de revivir en la UI).

**RLS (patrón común a las tablas de la app):** usuarios autenticados **leen**
todo; **admin / coordinador / campo** escriben; **visor** solo lee. `perfiles`:
cada usuario lee su propio perfil; admin CRUD todos; todos pueden leer campos
básicos (nombre, rol, sector_asignado) para mostrar "quién marcó".

**Edge Function `create-user`** (desplegada vía MCP `deploy_edge_function`):
recibe `{username, password, nombre, rol, sector_asignado, ...}` y usa
`service_role` para (1) crear el `auth.users` con email `<username>@refugio.app`
+ password y (2) insertar el `perfiles` con el `user_id` recién creado.
`verify_jwt: true` + check interno de rol → solo admins autenticados pueden
invocarla. El frontend la llama con el token del admin logueado. **Gaps:**
eliminar usuarios y cambiar la password de otros requieren futuras Edge
Functions (hoy se hace desde Supabase Studio o el MCP con `service_role`).

**Bucket `centros-fotos`** (Storage, público, 5 MB, solo imágenes): las fotos se
suben con la anon key (RLS `insert`/`update`/`select` para `anon,
authenticated` en `storage.objects` con `bucket_id = 'centros-fotos'`). La URL
pública se guarda dentro de `data` del centro (`foto_url`) y viaja con el sync.
Sin cambios respecto a la fase pre-migración.

**Verificación / auditoría:** `get_advisors` (MCP Supabase) con `type=security`
reporta advertencias conocidas y no críticas: `spatial_ref_sys` sin RLS (tabla
de PostGIS, no de la app), `postgis` instalado en `public`, funciones
`st_estimatedextent`/`rls_auto_enable` `SECURITY DEFINER` ejecutables por
`anon`/`authenticated` (propias de PostGIS/Supabase), y `centros-fotos` con
policy broad SELECT (público, permite listar). Ninguna afecta a las tablas de
la app.

## Histórico de ocupación de centros

Tabla `ocupaciones_centros` (tipada, no blob). **Una fila por centro por día**
(`unique(centro_id, dia)`): la última edición del día gana. El frontend escribe
el snapshot desde `reposSupabase.guardarCentro()` cuando la `ocupacion` cambió
respecto al centro previo (no hay trigger de BD; el frontend sabe si cambió).

- **Hook `useOcupacionesCentros({ centroId?, desde? })`** (`src/data/`): select
  inicial + Realtime (`postgres_changes` a `ocupaciones_centros`). Devuelve
  `SnapshotOcupacion[]`.
- **Lógica pura `src/domain/serieOcupacionCentros.ts`**:
  `serieDiariaOcupacionRed(snapshots, centros)` (agregado de Caracas por día con
  carry-forward del último snapshot conocido de cada centro),
  `serieDiariaOcupacionCentro(centroId, snapshots)` (serie de un centro),
  `variacionUltimoDia(snapshots)` (entradas/salidas netas del día).
- **`GraficoOcupacionCentro`** (`AreaChart` recharts, en `DetalleCentro`, sección
  desplegable): serie diaria de un centro. Eje X = fecha, eje Y = total de
  refugiados.
- **`GraficoOcupacionRed`** (`AreaChart` en `DashboardView`): serie agregada de
  los 49 centros, con desglose por grupo (Área Metropolitana vs Gran Caracas).
- **Snapshot inicial 2026-07-03** cargado para los 49 centros en la Fase 2 (el
  "día 1" de la red). Los gráficos arrancan desde ahí.

Usa el componente `chart` de shadcn (`ChartContainer`/`ChartTooltip`) con
`var(--chart-N)` como colores (siguiendo la regla del workspace de usar el MCP
de shadcn para cualquier diseño de UI).

## Auth y usuarios

- **Login** (`src/features/auth/Login.tsx` + `src/data/authSupabase.ts`): el
  usuario escribe su `username` y password; la capa lo mapea a
  `<username>@refugio.app` y llama a `supabase.auth.signInWithPassword`.
  `onAuthStateChange` mantiene la sesión. Tras login se carga el `perfil` desde
  `perfiles` (donde están `rol`, `sector_asignado`, `hash_id`, `marca_agua`,
  etc.) y se arma el `Usuario` de la app.
- **Sesión** (`useSesion()`): `useSyncExternalStore` sobre el estado interno
  que publica `onAuthStateChange`. Mantiene la misma interfaz pública que la
  capa legacy (`getSesion`, `getToken`, `cerrarSesion`, `setSesion`) para no
  romper consumidores.
- **Gestión de usuarios** (`/usuarios`, `GestionUsuarios.tsx`): el admin lista
  `perfiles`, edita rol/sector/etc., y **crea** usuarios invocando la Edge
  Function `create-user`. **No** puede eliminar usuarios ni cambiar la password
  de otros (faltan Edge Functions; ver "Gaps").
- **Roles:** `admin` (todo + gestión de usuarios) · `coordinador`/`campo`
  (leen + escriben) · `visor` (solo leen). Los chequeos de permiso viven en
  `src/domain/permisos.ts`.
- **Marca de agua** anti-foto: `MarcaAgua` muestra la identidad del usuario y
  la fecha si `perfil.marca_agua !== false`.

## Red de Centros Transitorios (`/centros`, foco actual)

La ruta `/centros` (`src/features/centros/`) permite **registrar el estado de
cada centro** y decidir a dónde reubicar refugiados con criterio.

**UI:** `CentrosView` (conmutador **Mapa / Tablero / Prioridades**). En el mapa,
`MarcadorCentro` es una **píldora horizontal**: logo del cuerpo + **`refugiados
/ funcionarios`** (ej. `200 / 25`) + punto de semáforo. Al seleccionar un
centro, `DetalleCentro` prioriza lo operativo a simple vista: KPIs grandes de
**refugiados** y **familias**, **personal total** (mini-totales por categoría),
tarjeta de **logística** (agua, comida, baños), **gráfico de ocupación**
(desplegable), los desgloses demográfico y de personal en **secciones
desplegables**, foto, Maps, coordinación, seguridad, requerimientos, capacidad
vs ocupación, responsables. `TableroCentros` compara centros por cupo real.
`CentroForm` por pestañas I–VI + Requerimientos, Capacidad, Contactos; el
**personal operativo** se edita en **V · Población** (`DesglosePersonal.tsx`).
Permisos: admin/coordinador/campo editan; **visor solo lectura**.

**Foto vía Supabase Storage:** la foto se sube al bucket público
`centros-fotos` (`src/data/supabase.ts`: comprime a JPEG ~1280px antes de
subir) y se guarda solo la **URL** dentro del dato del centro. Requiere
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; sin ellas el botón de foto
queda desactivado.

## Sala de control `/dashboard`

Vista independiente a pantalla completa pensada para **proyectar** en la sala
situacional. Solo lectura (todos los roles), se actualiza sola vía
`useSupabaseQuery` + Realtime. Archivo: `src/features/dashboard/DashboardView.tsx`.
Se abre desde el botón **"Pantalla"** de la `Navbar` (link a `/dashboard`).

Contenido: reloj en vivo, KPIs grandes (refugiados, familias, personal
operativo, centros con datos, cupo disponible, centros críticos), **gráfico
`GraficoOcupacionRed`** (histórico agregado de la red con carry-forward),
población por parroquia, estado de la red (centros por nivel de urgencia),
demografía de la red y lista de centros que requieren atención (ordenados por
`prioridadCentros.ts`). Indicador de conexión a Supabase (`useSupabaseConectado`).

## Producción REAL — corre en Dokploy

**Dominio de producción:** `https://m0n1t0r-d3-3v3nt0s.net`.

- **`refugio-ali-primera`** — la **PWA/frontend** (aplicación en Dokploy,
  `applicationId: mzf_H0G_JcYUoTZfbJkQI`). Se construye desde GitHub:
  `owner=diazpolanco13, repo=refugio-ali-primera, branch=main, buildPath=/`,
  build type **nixpacks**, `autoDeploy: true`, `triggerType: push`. Un push a
  `main` **debería** redesplegarla solo (verifica en el panel). Env vars del
  build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (horneadas en el bundle),
  `NIXPACKS_NODE_VERSION=22`.
- **`refugio-backend`** — **DETENIDO** (Fase 7). Compose
  `ACKYOsSdQcksY0vu31loO` que antes corría Postgres + API Fastify. Se dejó en
  **stop** (no destruido) por si hay que rollback. Ya no se usa: Supabase
  reemplaza auth, Postgres, Realtime y la API.
- El enrutado/HTTPS lo hace **Traefik** (de Dokploy). Ya no hay `/api` ni `/ws`
  en el dominio de producción: la PWA habla directo con Supabase.

### Desplegar / actualizar producción (Dokploy)

1. **Sube el código a GitHub `main`** (`git push origin main`). El frontend se
   construye desde `main`; sin push, el redeploy horneará código viejo.
   Confirma con `git ls-remote origin main`.
2. El `autoDeploy: true` debería disparar el rebuild solo. Si no, **Redeploy**
   desde el panel de Dokploy (app `refugio-ali-primera`) o vía MCP
   `application-redeploy` con `applicationId: mzf_H0G_JcYUoTZfbJkQI`.
3. **Verifica** que la nueva versión está activa (ver abajo).

### Verificar producción tras un deploy

```bash
# La PWA responde (HTML del frontend):
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://m0n1t0r-d3-3v3nt0s.net/
# Debe dar 200 y servir el index.html de la PWA.

# Ya NO hay /api ni /ws (el backend está detenido). Esto debe fallar (404/502):
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://m0n1t0r-d3-3v3nt0s.net/api/health
```

Login de prueba (verificado en la Fase 2): `admin` / `refugio_admin_2026`
(email `admin@refugio.app`). Otro usuario: `xavier` /
`refugio_xavier_2026`. **Cambia estas contraseñas cuanto antes.**

## Alternativa manual: desplegar en el VPS con Docker Compose

> Referencia por si algún día se despliega sin Dokploy. **Lo que corre hoy es
> Dokploy.** Tras la Fase 7, el `docker-compose.yml` queda solo con el servicio
> `caddy` (sirve la PWA); ya no hay `db` ni `server`.

```bash
git clone https://github.com/diazpolanco13/refugio-ali-primera.git
cd refugio-ali-primera
cp .env.deploy.example .env
# Editar .env: DOMAIN, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (y opcional
# VITE_MAPTILER_KEY). Ya NO hay DB_PASSWORD/JWT_SECRET/ADMIN_*.
docker compose up -d --build
```

`Dockerfile.web` hornea la PWA (build de Vite) y la sirve con Caddy. Las
`VITE_*` se pasan como build-args (compose las toma del `.env`). El
`Caddyfile` ya no proxya `/api` ni `/ws`: solo sirve `dist/` con fallback SPA.

## Notas / gotchas

- **Secretos:** `.env` (frontend, `VITE_SUPABASE_*` y `VITE_MAPTILER_KEY`) y el
  `.env` de despliegue están en `.gitignore`. `.env.example` va sin claves.
  Repo es público.
- **Terra Draw:** su modo `select` dispara `finish` al editar vértices; el handler
  de `finish` en `MapView.tsx` ignora eso cuando `modoEdicion` está activo (los
  cambios de geometría se guardan por el evento `change`). No romper esa guarda.
- **Marcadores** de puntos son **HTML markers** (no capa de círculos) para
  mostrar ícono+número+etiqueta hover sin depender de fuentes del mapa.
- **PWA / service worker:** `vite-plugin-pwa` con `autoUpdate`. Ya no hay
  offline-first con cola/outbox; el SW queda para caché de assets estáticos y
  deep-link offline (`navigateFallback: index.html`). `runtimeCaching` cachea
  tiles de mapa ya visitados.
- **shadcn CLI:** al añadir componentes (`npx shadcn add …`) revisa que el
  import de `cn` quede como `@/lib/utils` (a veces el CLI lo escribe
  `src/lib/utils` y rompe Vite).
- **`@/data/supabase.ts`** (Storage) **vs `@/data/supabaseClient.ts`** (cliente
  general): el primero es el helper legacy de subida de fotos (solo Storage);
  el segundo es el cliente supabase-js que usa toda la nueva capa. No
  confundirlos.
- Un warning de React "changed size between renders" que aparece **solo en el
  entorno de preview del asistente** NO proviene de esta app (se comprobó); no
  aparece en un navegador normal.

## Verificación rápida

- Frontend: `npm run typecheck` y `npm run build` (deben pasar limpios). Probar
  en navegador: login con `admin`, listar los 49 centros, editar ocupación de
  un centro y ver el snapshot en `ocupaciones_centros` (Supabase Studio),
  abrir el gráfico individual y el de red, editar en un dispositivo y ver
  refresco en otro (Realtime), subir foto.
- Supabase: `list_tables` (verbose) y `get_advisors` (security) vía MCP para
  confirmar esquema y RLS.
