# CLAUDE.md — Guía para continuar el proyecto

> Documento de traspaso. Si eres una IA/desarrollador retomando este proyecto
> (por ejemplo desde el VPS), **lee esto primero**. Explica qué es, qué está
> hecho, cómo ejecutarlo y **qué falta** (Fase 2c: bitácora, despliegue · Fase 3:
> overlay del parque, export PDF). El proyecto y sus comentarios están en
> **español**; mantén ese idioma.

## Qué es

**Sala Situacional** para el monitoreo del **refugio transitorio del Parque del
Oeste "Alí Primera"** (Caracas/La Guaira), tras la tragedia del 24-jun-2026.
Herramienta de gestión de campamento (CCCM): mapa georreferenciado con sectores
y capas de servicios, detección de brechas vs. estándares humanitarios (Esfera),
cronómetro de limpieza, y funcionamiento **offline-first**. Objetivo: planificar,
distribuir responsabilidades por sector y decidir con datos.

Contexto humanitario/estatal en Venezuela → **soberanía de datos**: todo se
autoaloja en el VPS del usuario, sin nubes de terceros.

## Estado actual

- ✅ **Fase 1 — PWA offline (frontend):** completa y verificada.
- ✅ **Fase 2a — Backend de sincronización:** completo y verificado (`server/`).
- ✅ **Fase 2b — Integrar frontend ↔ backend:** completa y verificada. Login con
  gate de sesión, motor de sync (Dexie↔`/api/sync` con cola `outbox`), WebSocket
  en tiempo real, y roles en la UI (visor = solo lectura). Ver `src/data/{auth,api,sync}.ts`.
- ⏳ **Fase 2c:** bitácora "quién marcó limpio/recogió" (usar `POST /api/historial`
  al marcar limpio y en ediciones clave; mostrar en el tablero) y desplegar en el
  VPS. ✅ Gestión de usuarios desde la UI (admin) **ya implementada**
  (`src/features/usuarios/GestionUsuarios.tsx`), incluyendo asignar `sector_asignado`.
- 🟡 **Fase 3 (en progreso):** ✅ **vista sala de control** (`/dashboard`, pantalla
  grande proyectable) con **registro poblacional por fechas** (gráfico de área) y
 ✅ **registro de distribución de comida e hidratación** (panel "Comida" + tarjeta
 "Alimentación de hoy" en el dashboard) y ✅ **team de salubridad y aseo** (panel
 "Aseo": bitácora de limpieza de baños/duchas/basura). Falta: overlay de la ilustración del
  parque, export PDF de reportes. Se irá ampliando con más métricas. Ver
  `src/features/dashboard/DashboardView.tsx` y `src/features/distribucion/`.

La app **ya funciona 100% offline** con Dexie/IndexedDB. El backend solo añade la
capa compartida multiusuario; **no** debe romper el modo offline.

## Cómo ejecutar (desarrollo)

```bash
# Frontend (raíz)
npm install
npm run dev            # http://localhost:5173
npm run build          # genera dist/ (PWA)

# Backend (server/) — sin instalar Postgres: usa PGlite en proceso
cd server
npm install
npm run dev            # http://localhost:3001  (admin/admin1234 la 1ª vez)
```

Para la clave opcional de MapTiler: copia `.env.example` → `.env` y pega tu clave
en `VITE_MAPTILER_KEY` (NO commitear `.env`).

## Stack

**Frontend:** React 19 + Vite 7 + TypeScript + Tailwind v4 (plugin `@tailwindcss/vite`,
sin config) · **MapLibre GL** (mapa) + **Terra Draw** (dibujo) · **Dexie**
(IndexedDB) · **vite-plugin-pwa** · **react-router-dom** (rutas `/` y `/dashboard`).
UI con **shadcn/ui** (Radix + cva + `cn()` en `src/lib/utils.ts`, componentes en
`src/components/ui/`, estilo `radix-nova` en `components.json`) + **recharts** (via
componente `chart` de shadcn) para gráficos. Quedan restos del sistema propio
legacy (`src/ui/` Modal + `clases.ts`) en `PuntoForm`/`LineaForm`.

**Backend (`server/`):** **Fastify 5** + **PostgreSQL** (geom como `jsonb`, sin
PostGIS por ahora) · **@fastify/jwt v10** (JWT) · **@node-rs/argon2** (hash) ·
**@fastify/websocket** · **zod**. En dev usa **PGlite** (Postgres en proceso, WASM)
si no hay `DATABASE_URL`; en prod usa Postgres real.

## Arquitectura del frontend

```
src/
├─ domain/     tipos.ts (modelo + catálogos), estandares.ts (Esfera),
│              brechas.ts (cobertura/alertas/point-in-polygon), limpieza.ts (cronómetro),
│              poblacion.ts (serie diaria de población desde snapshots),
│              distribucion.ts (resumen de comida/hidratación por jornada),
│              salubridad.ts (resumen de limpieza de baños/duchas/basura por día)
├─ data/       db.ts (Dexie, versión 9 con migraciones), repos.ts (guardar/eliminar),
│              seed.ts (ejemplo), preferencias.ts (vista guardada en localStorage)
├─ map/        MapView.tsx (MapLibre + Terra Draw + marcadores HTML), estiloMapa.ts (bases)
├─ features/   sectores/SectorForm · puntos/PuntoForm · tablero/Tablero ·
│              distribucion/PanelDistribucion (registro de comida) ·
│              salubridad/PanelSalubridad (limpieza de baños/duchas/basura) ·
│              dashboard/DashboardView (sala de control /dashboard)
├─ components/ Navbar, PanelFlotante, … · ui/ (componentes shadcn: card, chart, badge…)
├─ lib/        utils.ts (cn())
└─ ui/         (legacy) Modal, clases.ts (clases Tailwind reutilizables)
```

Rutas (react-router en `src/main.tsx` + `src/App.tsx`): `/` = app del mapa
(`AppInterna`), `/dashboard` = sala de control a pantalla completa (`DashboardView`,
solo lectura). En prod Caddy hace fallback SPA a `index.html`; en la PWA se añadió
`navigateFallback` en `vite.config.ts` para deep-link offline a `/dashboard`.

Conceptos del dominio (ver `src/domain/tipos.ts`):
- **Sector**: polígono con `color`, `responsables[]` (nombre/telefono/categoria/funcion),
  censo, familias, vulnerables.
- **PuntoServicio**: 11 tipos (`hidratacion, comida, salud, sanitarios, duchas,
  residuos, carpa, recreacion, seguridad, energia, acceso`). Campos opcionales por
  tipo: seguridad → `organismo`+`movilidad`; baños/duchas → `genero`+`condicion`
  (improvisada no cuenta para el estándar); baños/duchas/basura → cronómetro
  `frecuenciaLimpiezaHoras`+`ultimaLimpieza`.
- **CensoSnapshot**: foto histórica del censo de un sector (`sector_id`, `ts`,
  `poblacion`, `familias`, `carpas`, `vulnerables`). **Append-only**: se genera al
  guardar un sector si cambian sus datos poblacionales. Id determinista
  `censo-<sectorId>-<YYYY-MM-DD>` → varias ediciones el mismo día colapsan en un
  punto (una foto por sector por día). Reconstruye la evolución poblacional.
- **Distribución de comida/hidratación** (entidad `distribuciones`, 2 "clases" en
  la misma tabla): **`JornadaComida`** = cabecera logística de una jornada del día
  (id `jor-<YYYY-MM-DD>-<jornada>`; `hora_llegada`, `raciones`, `proveedor`), y
  **`EntregaSector`** = marca "ya comió" de un sector en esa jornada (id
  `ent-<YYYY-MM-DD>-<jornada>-<sectorId>`; `entregado`, `hora_entrega`). Jornadas
  fijas: desayuno, almuerzo, cena, merienda, hidratación. Ids por día → cada
  jornada "se reinicia" sola cada día. Ver `src/domain/tipos.ts` y `distribucion.ts`.
- Todo lleva `id`, `updated_at`, `updated_by` (con sesión = `user.username`).

## Backend — contrato de la API (`server/`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/health` | — | Estado |
| POST | `/api/auth/login` | — | `{username,password}` → `{token, user}` |
| GET | `/api/auth/me` | auth | Payload del token |
| GET | `/api/usuarios` · POST | admin | Listar / crear usuarios (`sector_asignado` opcional) |
| PATCH | `/api/usuarios/:id` | admin | Editar usuario (nombre, rol, password, `sector_asignado`) |
| GET | `/api/sync?since=<ts>` | auth | `{sectores, puntos, lineas, censos, distribuciones, serverTime}` con filas cambiadas (incluye `deleted:true`) |
| POST | `/api/sync` | admin/coordinador/campo | Body `{sectores, puntos, lineas, censos, distribuciones}` (arrays de filas) → upsert **last-write-wins** |
| POST | `/api/sync/purge` | admin | Vaciar mapa (sectores/puntos/lineas). **NO** borra `censos` ni `distribuciones` (histórico se conserva) |
| GET/POST | `/api/historial` | auth / (no visor) | Bitácora |

> `GET /api/sync` y `POST /api/sync` incluyen también `limpiezas` (bitácora de
> salubridad/aseo). `/api/sync/purge` **no** borra `censos`, `distribuciones` ni
> `limpiezas` (el histórico se conserva).
| WS | `/ws?token=<jwt>` | auth | Difunde `{type:"cambio", entidad, filas, serverTime}` |

**Entidades sincronizables** (mismo modelo blob+metadatos, last-write-wins):
`sectores`, `puntos`, `lineas`, `censos`, `distribuciones`, `limpiezas`. Para añadir
una nueva hay que tocar, en cliente: `data/db.ts` (tabla + versión + tipo
`Entidad`/`OutboxItem`), `data/api.ts` (pull/push), `data/sync.ts`
(`aplicarLote`/`tablaDe`/pull/push/WS) y en servidor: `db/bootstrap.ts` (tabla),
`types.ts` (`Entidad`), `routes/sync.ts` (pull/push/difundir). `limpiezas`
(salubridad y aseo) fue el último añadido siguiendo exactamente este patrón —
úsalo de referencia.

**Fila de sync** = `{ id, updated_at:number, updated_by, deleted:boolean, data:<objeto completo> }`.
Cada entidad se guarda como **blob JSON + metadatos** → cambiar campos del cliente
NO requiere migrar la base. Upsert solo sobrescribe si `EXCLUDED.updated_at >=`
el existente (last-write-wins). El servidor pone `updated_by` desde el token
(no confía del cliente). Roles: admin(todo) · coordinador/campo(leer+escribir) ·
visor(solo leer).

Archivos backend: `src/index.ts` (arranque, plugins, WS), `src/routes/*`,
`src/auth.ts`, `src/db/client.ts` (adaptador PGlite/postgres), `src/db/bootstrap.ts`
(crea tablas), `src/ws.ts` (hub), `src/seedAdmin.ts`.

## ✅ Fase 2b — IMPLEMENTADA (referencia de cómo funciona)

> Ya está hecho y verificado. Esta sección documenta el diseño implementado.
Objetivo: la app comparte datos entre dispositivos en tiempo real, con login y
roles, **sin perder el offline**. Archivos: `src/data/auth.ts` (sesión),
`src/data/api.ts` (cliente HTTP), `src/data/sync.ts` (motor + WebSocket),
`src/features/auth/Login.tsx`, y proxy en `vite.config.ts`.

### 1. Config de API (mismo origen en prod)
- En prod, la PWA y la API comparten dominio: llamar a `/api` y `/ws` **relativos**.
- En dev, el frontend (5173) y el backend (3001) están separados → añadir **proxy
  de Vite** en `vite.config.ts`:
  ```ts
  server: { proxy: { "/api": "http://localhost:3001", "/ws": { target: "http://localhost:3001", ws: true } } }
  ```
  Así el frontend siempre usa rutas relativas.

### 2. Auth (login + sesión)
- Pantalla de **login** (usuario/contraseña) → `POST /api/auth/login`.
- Guardar `token` + `user` en `localStorage`; adjuntar `Authorization: Bearer` en
  cada fetch; manejar `401` (cerrar sesión). Crear `src/data/auth.ts` (estado de
  sesión) y un componente `Login`.
- Exponer `rol` a la UI.

### 3. Motor de sincronización (Dexie ↔ API)
- Añadir a Dexie una tabla **`outbox`**: cola de mutaciones pendientes con la
  **fila de sync completa** `{entidad, id, updated_at, deleted, data}`.
- En `repos.ts`, cada `guardarSector/guardarPunto` **encola** la fila; cada
  `eliminar*` encola un **tombstone** `{deleted:true, data:<última conocida>}` (el
  modelo usa **borrado suave**: hoy `repos.ts` borra en duro — cambiarlo para que
  además propague la baja).
- Worker de sync (p. ej. `src/data/sync.ts`): cuando hay conexión + sesión:
  1. **Push**: `POST /api/sync` con lo de `outbox`; al éxito, vaciar `outbox`.
  2. **Pull**: `GET /api/sync?since=<lastSync>` → aplicar a Dexie (si `deleted`
     borra local; si no, `put` respetando `updated_at`). Guardar `serverTime` como
     `lastSync` en localStorage.
  - Correr al reconectar (`window 'online'`) y periódicamente.
- **WebSocket**: conectar a `/ws?token=`; al recibir `{type:"cambio", filas}`
  aplicar a Dexie igual que el pull (tiempo real).
- Conflictos: **last-write-wins** por `updated_at` (ya resuelto en el servidor;
  el cliente aplica lo entrante si `updated_at >=` lo local).
- Al iniciar sesión, poner `updated_by = user.username` en las mutaciones locales.
- La UI ya usa `useLiveQuery` sobre Dexie → se re-renderiza sola cuando el sync
  escribe. Filtrar `deleted` en las queries de lectura.

### 4. Roles en la UI
- **visor**: ocultar/inhabilitar herramientas de dibujo, modo edición, formularios
  de edición y botones "marcar limpio". Solo lectura + tablero.
- coordinador/campo/admin: edición completa (admin además gestiona usuarios).

### 5. Bitácora (Fase 2c, ligado a esto)
- Al **marcar limpio/recoger basura** y en ediciones clave, `POST /api/historial`
  con `{accion, entidad, entidad_id, detalle}` → registra quién y cuándo. Mostrar
  en el tablero.

## ✅ Sala de control `/dashboard` (Fase 3, en progreso)

Vista independiente a pantalla completa pensada para **proyectar** en la sala
situacional. Solo lectura (todos los roles), se actualiza sola vía `useLiveQuery`
sobre Dexie + sync/WebSocket. Archivo: `src/features/dashboard/DashboardView.tsx`.
Se abre desde el botón **"Pantalla"** de la `Navbar` (link a `/dashboard`).

Contenido actual: reloj en vivo, KPIs grandes (población, familias, vulnerables,
sectores, puntos operativos, alertas), **gráfico de área "Registro poblacional por
fechas"**, **tarjeta "Alimentación de hoy"** (una casilla por jornada con hora de
llegada y barra de sectores servidos), semáforo de sectores, demografía por
edad/sexo, alertas y limpieza. Reutiliza las funciones de dominio existentes
(`kpisGlobales`, `generarAlertas`, `sumarVulnerables`, `infoLimpieza`,
`resumenDistribucion`) — no duplica lógica.

**Registro poblacional (cómo funciona):**
- Cada `guardarSector` con cambios de censo llama a `registrarCenso()` (`repos.ts`)
  → crea/actualiza un `CensoSnapshot` (tabla Dexie `censos`) y lo encola en `outbox`.
- `src/domain/poblacion.ts` → `serieDiariaPoblacion(snaps)` construye la serie por
  día haciendo **carry-forward** del último censo conocido de cada sector (así el
  total refleja todo el refugio, no solo lo recensado ese día). `variacionUltimoDia`
  deriva las entradas/salidas netas del día.
- La migración Dexie **v7** crea una foto inicial por cada sector existente para que
  el gráfico no arranque vacío (id determinista → sin duplicar entre dispositivos).
- Se sincroniza como 4ª entidad (`censos`). El histórico **no** se purga al vaciar
  el mapa.

**Cómo ampliarlo:** el dashboard es iterativo. Para una nueva métrica: añade su
cálculo en `domain/` (función pura sobre sectores/puntos/censos), y una tarjeta/serie
nueva en `DashboardView.tsx`. Para gráficos usa el componente `chart` de shadcn
(recharts) con `ChartContainer`/`ChartTooltip` y `var(--chart-N)` como colores.

## ✅ Distribución de comida e hidratación (Fase 3)

Registro del proceso de alimentación por **jornadas fijas del día** (desayuno,
almuerzo, cena, merienda + rondas de hidratación). Responde: ¿a qué hora llegó la
comida?, ¿qué sectores ya comieron y a qué hora?, ¿ya comieron todos?

**Datos:** entidad sincronizable `distribuciones` (5ª entidad), con dos clases de
fila (ver "Conceptos del dominio"): `JornadaComida` (cabecera logística) y
`EntregaSector` (marca por sector). Cada marca de sector es su **propia fila** →
varios responsables marcan a la vez sin pisarse (a diferencia de un único blob por
jornada). No se purga al vaciar el mapa.

**Funciones (`src/data/repos.ts`):** `guardarJornada(dia, jornada, datos)` (hora de
llegada / raciones / proveedor, merge parcial), `marcarEntrega(sector, dia, jornada,
entregado)` (fija `hora_entrega = now` al marcar), `marcarTodos(...)`.

**Lógica pura (`src/domain/distribucion.ts`):** `resumenDistribucion(dia, registros,
sectores)` agrupa las filas del día por jornada y calcula progreso `servidos/total`;
helpers `claveDiaLocal`, `formatoHora`, `horaAInput`/`horaDesdeInput` (para el
`<input type="time">` de ajuste manual de la hora de llegada).

**UI de registro:** `src/features/distribucion/PanelDistribucion.tsx`, abierto desde
el botón **"Comida"** de la `Navbar` (estado `distribucionAbierto` en `App.tsx`).
Selector de jornada, cabecera de llegada (hora **editable manualmente** por
admin/coordinador + botón "Ahora"; raciones/proveedor), y lista de sectores para
marcar "Ya comió".

**Permisos por rol:** el responsable de **campo** solo puede marcar **su** sector
(`sector_asignado`); **admin/coordinador** marcan cualquier sector, usan "Marcar
todos" y editan la logística de la jornada; **visor** solo lectura.

## ✅ Salubridad y aseo (Fase 3)

Team de limpieza del refugio: recolección de basura, limpieza de letrinas
portátiles y del área de duchas. Como el parque no tiene botes ni baños en todos
los sectores, la gente acude a **puntos concretos del parque** → el módulo opera
sobre los **puntos del mapa** de tipo `sanitarios`, `duchas` y `residuos` (no por
sector, a diferencia de la comida). Las letrinas deben limpiarse **mín. 2 veces/día**.

**Datos:** entidad sincronizable `limpiezas` (6.ª entidad), bitácora **append-only**:
cada marca "limpio/recogido" es su propia fila `RegistroLimpieza`
(`{ id:limp-<puntoId>-<ts>, punto_id, punto_tipo, punto_nombre, ts, dia, notas }`),
así se registra quién y cuándo, y varios responsables marcan sin pisarse. No se
purga al vaciar el mapa. Ver `src/domain/tipos.ts`.

**Funciones (`src/data/repos.ts`):** `marcarLimpieza(punto, notas?)` crea el evento
en `limpiezas` **y** actualiza `punto.ultimaLimpieza` (mantiene vivo el cronómetro
del mapa de `src/domain/limpieza.ts`); `deshacerUltimaLimpieza(punto, dia)`
(tombstone del último evento del día + recalcula `ultimaLimpieza`).

**Lógica pura (`src/domain/salubridad.ts`):** `metaLimpiezasDia(punto)` (veces/día
objetivo derivada de `frecuenciaLimpiezaHoras`, mín. 2) y `resumenSalubridad(dia,
puntos, registros)` → por punto `{ info, vecesHoy, meta, cumpleMeta, ultima,
ultimaPor }` + totales (`vencidos`, `pendientesMeta`). Reutiliza `esMantenimiento`
e `infoLimpieza` de `limpieza.ts` (no duplica el cronómetro).

**UI:** `src/features/salubridad/PanelSalubridad.tsx`, abierto desde el botón
**"Aseo"** de la `Navbar` (estado `salubridadAbierto` en `App.tsx`). Filtro por tipo
(Todos/Baños/Duchas/Basura), y por punto: anillo de estado, "X/meta hoy", última
limpieza + `@usuario`, botón "Limpio" (y "Deshacer"). El botón "marcar limpio" del
mapa (`marcarLimpio` en `App.tsx`) también usa `marcarLimpieza` → deja bitácora. El
dashboard enriquece la tarjeta "Limpieza y recolección" con "X/meta hoy" y el último
responsable.

**Permisos:** admin/coordinador/campo marcan cualquier punto; visor solo lectura
(los baños son ubicaciones compartidas del parque, no atadas a un sector).

**`sector_asignado`:** vincula un usuario de campo con su sector. Se asigna en la UI
de usuarios (admin) y **viaja en el token JWT** (`TokenPayload` en servidor,
`Usuario` en `src/data/auth.ts`). ⚠️ Al cambiar el sector de un usuario, debe
**re-loguearse** para que el token nuevo lo incluya.

## 🚀 Desplegar en el VPS (Docker) — SIGUIENTE PASO

Objetivo: dejar la app en `https://TU-DOMINIO` con Postgres + API + Caddy (HTTPS
automático). VPS del usuario: 6 vCPU / 12 GB / 200 GB, con dominio. Archivos ya
listos: `docker-compose.yml`, `Caddyfile`, `server/Dockerfile`, `Dockerfile.web`
(build de la PWA en Docker), `.dockerignore`, `.env.deploy.example`.

**La PWA se construye dentro de Docker** (`Dockerfile.web`: build de Vite + Caddy
sirviendo el `dist/` horneado en la imagen). NO hace falta Node ni `npm run build`
en el host: `docker compose up -d --build` reconstruye frontend **y** backend.

**Requisitos en el VPS:**
- Docker + Docker Compose v2. (No hace falta Node en el host.)
- Dominio con registro **A** apuntando a la IP del VPS.
- Puertos **80 y 443** abiertos (Caddy emite el certificado por HTTP-01).

**Pasos:**
```bash
git clone https://github.com/diazpolanco13/refugio-ali-primera.git
cd refugio-ali-primera

# 1) Secretos de despliegue (NO se commitean; .env está en .gitignore)
cp .env.deploy.example .env
#   Editar .env:  DOMAIN=refugio.tudominio.com
#                 DB_PASSWORD=...           (fuerte)
#                 JWT_SECRET=$(openssl rand -base64 48)
#                 ADMIN_USER=admin
#                 ADMIN_PASSWORD=...         (cambia el admin1234 por defecto)
#   (Opcional) clave MapTiler para bases HD — Vite la hornea al construir:
#                 VITE_MAPTILER_KEY=tu-clave   (puede ir en el mismo .env)

# 2) Levantar todo (construye PWA + API dentro de Docker)
docker compose up -d --build
```

**Verificar:**
- `docker compose ps` → db, server, caddy en "up".
- `docker compose logs -f server` → "Escuchando en :3001 (Postgres)" y (1ª vez) "Usuario admin creado".
- Abrir `https://TU-DOMINIO` → login. Entrar con ADMIN_USER / ADMIN_PASSWORD.
- `curl https://TU-DOMINIO/api/health` → `{"ok":true,"db":"postgres",...}`.

**Crear usuarios**: ya hay **UI de gestión** (botón "Usuarios" del admin). Como
alternativa por API, con el admin:
```bash
TOKEN=$(curl -s https://TU-DOMINIO/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"TU_PASS"}' | jq -r .token)
curl -s https://TU-DOMINIO/api/usuarios -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"username":"coord1","password":"secreto123","nombre":"Coordinador","rol":"coordinador"}'
```
Roles: `admin` · `coordinador` · `campo` · `visor` (solo lectura).

**Actualizar tras nuevos commits:**
```bash
git pull
docker compose up -d --build     # reconstruye PWA y API (lo que haya cambiado)
```
> ⚠️ El `--build` es obligatorio: sin él, Caddy sigue sirviendo el `dist/` viejo
> horneado en la imagen anterior y los cambios de frontend NO aparecen. Si un
> deploy automático solo hace `git pull` + `docker compose up` (sin `--build`),
> el frontend no se actualiza. Como el PWA usa `registerType: "autoUpdate"`, tras
> el rebuild el service worker nuevo se activa en la siguiente carga (puede hacer
> falta un hard-reload la primera vez).

**Notas de despliegue:**
- La PWA llama a `/api` y `/ws` **relativos** → Caddy los proxya a `server:3001`
  en el mismo dominio (WebSocket incluido). No hay que configurar URLs.
- El `dist/` se construye dentro de Docker (`Dockerfile.web`) y queda horneado en
  la imagen de Caddy. La clave opcional de MapTiler se pasa como build-arg
  `VITE_MAPTILER_KEY` (compose la toma del `.env`); si cambias la clave, hay que
  reconstruir con `--build`.
- Postgres persiste en el volumen `dbdata`. Backup:
  `docker compose exec db pg_dump -U refugio refugio > backup.sql`.
- Cambiar `JWT_SECRET` invalida las sesiones activas (todos deben re-login).
- Solo los VITE_* entran al bundle; `DB_PASSWORD`/`JWT_SECRET` NO se exponen.

## Notas / gotchas

- **Secretos:** `.env` (frontend, clave MapTiler) y el `.env` de despliegue están
  ignorados. `.env.example` va sin clave. Repo es público.
- **Terra Draw:** su modo `select` dispara `finish` al editar vértices; el handler
  de `finish` en `MapView.tsx` ignora eso cuando `modoEdicion` está activo (los
  cambios de geometría se guardan por el evento `change`). No romper esa guarda.
- **Marcadores** de puntos son **HTML markers** (no capa de círculos) para mostrar
  ícono+número+etiqueta hover sin depender de fuentes del mapa (mejor offline).
- **Cronómetro de limpieza:** el color del anillo se recalcula con un `ahora`
  (tick de 30 s en `App.tsx`). El estado depende de `Date.now()`.
- **Migración Dexie:** `db.ts` está en **versión 9** (v2 `coordinador`→`responsables`,
 v4 desglose por edad/sexo, v5 líneas, v6 carpas, v7 tabla `censos` + foto inicial
 por sector, v8 tabla `distribuciones`, v9 tabla `limpiezas`). Si cambias el esquema
 local, sube la versión y añade `upgrade`.
- **shadcn CLI:** al añadir componentes (`npx shadcn add …`) revisa que el import de
  `cn` quede como `@/lib/utils` (a veces el CLI lo escribe `src/lib/utils` y rompe
  Vite). Nuevas deps de UI/gráficos: `react-router-dom`, `recharts`.
- Un warning de React "changed size between renders" que aparece **solo en el
  entorno de preview del asistente** NO proviene de esta app (se comprobó); no
  aparece en un navegador normal.

## Verificación rápida

- Frontend: `npm run build` (typecheck + build). Probar en navegador: dibujar
  sector, colocar punto, marcar limpio, recargar offline (DevTools) y ver que
  persiste.
- Backend: `npm run typecheck --prefix server`; arrancar y probar
  `POST /api/auth/login` (admin/admin1234), `POST /api/sync` y `GET /api/sync?since=0`.
