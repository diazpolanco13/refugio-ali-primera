# CLAUDE.md — Guía para continuar el proyecto

> Documento de traspaso. Si eres una IA/desarrollador retomando este proyecto
> (por ejemplo desde el VPS), **lee esto primero**. Explica qué es, hacia dónde
> va, qué está hecho, cómo ejecutarlo y qué falta. El proyecto y sus comentarios
> están en **español**; mantén ese idioma.

## Qué es

Herramienta de **gestión humanitaria (CCCM)** para la emergencia de Caracas/La
Guaira tras la tragedia del **24-jun-2026**. Nació como **Sala Situacional** de un
solo refugio, el **Parque del Oeste "Alí Primera"** (mapa georreferenciado por
sectores, capas de servicios, brechas vs. estándares humanitarios **Esfera**,
cronómetro de limpieza, distribución de comida y salubridad), y **funciona
offline-first**.

> 🔀 **DIRECCIÓN ACTUAL DEL PROYECTO (jul-2026) — LÉELO.** El Parque "Alí Primera"
> se está **desalojando** y su población se redistribuye en una **red de ~50
> Centros Transitorios** repartidos por el Área Metropolitana y Gran Caracas. Por
> eso el foco del proyecto **migró de un solo refugio a gestionar toda la red de
> centros**. El trabajo nuevo se concentra en la vista **`/centros`** (Fase 4):
> registrar el **estado, capacidad y ocupación** de cada centro y decidir **a dónde
> reubicar gente** (cupo real / cuello de botella). La herramienta original de Alí
> Primera (ruta `/`) **se conserva y se reutiliza** (mismo modelo demográfico
> `Vulnerables`, mismos estándares Esfera, mismo motor de sync), pero **ya no es el
> centro del producto**: es un refugio más (de hecho, de salida). Si vas a construir
> algo nuevo, hazlo pensando en **la red de centros**, no en un único parque.

**Dos implementaciones (rutas):**
- **`/`** — herramienta original del Parque "Alí Primera": mapa por sectores +
  puntos de servicio + líneas, tablero, distribución de comida, salubridad
  (`AppInterna` en `src/App.tsx`). Legado activo, en modo mantenimiento.
- **`/centros`** — **gestión de la red de 50 Centros Transitorios** (el foco de
  hoy): estado/capacidad/ocupación por centro, detalle con cuello de botella y
  tablero comparativo para reubicar (`src/features/centros/`).
- **`/dashboard`** — sala de control proyectable (hoy centrada en el parque; a
  futuro debería cubrir la red — ver "Qué falta").

Contexto humanitario/estatal en Venezuela → **soberanía de datos**: todo se
autoaloja en el VPS del usuario, sin nubes de terceros. **Única excepción** (decisión
explícita del usuario, jul-2026): las **fotos de los centros** se guardan en
**Supabase Storage** (solo la imagen; los datos siguen en el backend propio).

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
 "Alimentación de hoy" + **gráfico de líneas "Comidas repartidas por fechas"** en el
 dashboard) y ✅ **team de salubridad y aseo** (panel
 "Aseo": bitácora de limpieza de baños/duchas/basura). Falta: overlay de la ilustración del
  parque, export PDF de reportes. Se irá ampliando con más métricas. Ver
  `src/features/dashboard/DashboardView.tsx` y `src/features/distribucion/`.
- 🟢 **Fase 4 — FOCO ACTUAL: red de 50 Centros Transitorios** (`/centros`): ✅
  registro de estado por centro (levantamiento de campo secciones I–VI, capacidad,
  ocupación demográfica, **personal operativo**, requerimientos logísticos,
  responsables, foto), ✅ marcadores en mapa con **refugiados / funcionarios**,
  ✅ panel de detalle con KPIs visibles y desgloses desplegables, ✅ **cuello de
  botella** (cupo real según Esfera, incluyendo personal en la logística de agua/
  comida/baños), ✅ **tablero comparativo** y ✅ formulario **por pestañas**.
  Foto vía **Supabase Storage** (también en prod Dokploy). Ver sección "Red de
  Centros Transitorios" y `src/features/centros/`.

La app **ya funciona 100% offline** con Dexie/IndexedDB (la foto de centros es la
única función que requiere conexión). El backend solo añade la capa compartida
multiusuario; **no** debe romper el modo offline.

### Qué falta / próximos pasos (dirección: la red de centros)

- ✅ **Supabase configurado** (jul-2026): proyecto `xzwifkckkakldnzkdeby`, bucket
  público `centros-fotos` (5MB, RLS de subida). `VITE_SUPABASE_*` en `.env` local
  **y** en el build de producción (Dokploy app `refugio-ali-primera`). Ver sección
  "Foto vía Supabase".
- ✅ **Backend `centros` en prod** (jul-2026): tabla creada, sync operativo. El
  compose `refugio-backend` tiene webhook GitHub con `watchPaths: ["server/**"]`.
- ⚠️ **Dev vs prod — bases distintas:** en desarrollo, Vite proxya `/api` a
  `localhost:3001` (PGlite). Ediciones en localhost **no** llegan solas a producción;
  hay que guardar en `https://m0n1t0r-d3-3v3nt0s.net` (o empujar datos manualmente).
  Las fotos sí van a Supabase compartido; la `foto_url` viaja con el sync del centro.
- 📊 **Dashboard de la red**: hoy `/dashboard` es del parque; falta una vista de
  sala de control **agregada de todos los centros** (población total en la red,
  centros saturados, cupo total disponible, mapa de calor por parroquia).
- 🔁 **Traslados**: hoy el tablero es comparativo (decides tú). Falta (si se pide)
  registrar/rastrear **movimientos de refugiados entre centros** y, opcionalmente,
  un motor de sugerencias de reubicación.
- 🧩 **Legado del parque** (`/`): pendientes menores heredados — bitácora completa
  (Fase 2c), overlay de la ilustración del parque y export PDF de reportes.

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

**Atajo (recomendado):** `./reiniciar.sh` levanta backend (:3001) y frontend
(:5173) en segundo plano de una sola vez. Subcomandos: `update` (git pull ff-only
+ reinicia), `stop`, `logs`. Reinstala dependencias solo si cambió
`package-lock.json` (p. ej. tras un `git pull`), así no hay que acordarse de correr
`npm install`. ⚠️ Es **solo desarrollo** (PGlite + Vite); **no** toca producción.

## Stack

**Frontend:** React 19 + Vite 7 + TypeScript + Tailwind v4 (plugin `@tailwindcss/vite`,
sin config) · **MapLibre GL** (mapa) + **Terra Draw** (dibujo) · **Dexie**
(IndexedDB) · **vite-plugin-pwa** · **react-router-dom** (rutas `/`, `/centros` y
`/dashboard`) · **Supabase JS** (solo para subir fotos de centros).
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
├─ domain/     tipos.ts (modelo + catálogos), estandares.ts (Esfera + ventanas de comida),
│              brechas.ts (cobertura GLOBAL del parque + alertas), limpieza.ts (cronómetro),
│              poblacion.ts (serie diaria de población desde snapshots),
│              distribucion.ts (resumen de comida/hidratación por jornada),
│              salubridad.ts (resumen de limpieza de baños/duchas/basura por día),
│              centrosTransitorios.ts (modelo del centro + normalizar),
│              capacidadCentros.ts (cupo real / cuello de botella según Esfera)
├─ data/       db.ts (Dexie, versión 10 con migraciones), repos.ts (guardar/eliminar),
│              centrosTransitorios.ts (catálogo estático de los 50 centros),
│              supabase.ts (subida de foto de centro), seed.ts (ejemplo),
│              preferencias.ts (vista guardada en localStorage)
├─ map/        MapView.tsx (MapLibre + Terra Draw + marcadores HTML), estiloMapa.ts (bases)
├─ features/   sectores/SectorForm · puntos/PuntoForm · tablero/Tablero ·
│              distribucion/PanelDistribucion (registro de comida) ·
│              salubridad/PanelSalubridad (limpieza de baños/duchas/basura) ·
│              dashboard/DashboardView (sala de control /dashboard) ·
│              censo/DesgloseDemografico, DesglosePersonal, PersonalResumen ·
│              centros/ (FOCO: CentrosView, CentrosMap, MarcadorCentro, InfoCentro,
│                        DetalleCentro, TableroCentros, CentroForm, LevantamientoCentro)
├─ components/ Navbar, PanelFlotante, … · ui/ (componentes shadcn: card, chart, badge…)
├─ lib/        utils.ts (cn())
└─ ui/         (legacy) Modal, clases.ts (clases Tailwind reutilizables)
```

Rutas (react-router en `src/main.tsx` + `src/App.tsx`): `/` = app del mapa del
parque (`AppInterna`), **`/centros` = red de Centros Transitorios (`CentrosView`,
foco actual)**, `/dashboard` = sala de control a pantalla completa (`DashboardView`,
solo lectura). En prod Caddy hace fallback SPA a `index.html`; en la PWA se añadió
`navigateFallback` en `vite.config.ts` para deep-link offline a esas rutas.

Conceptos del dominio (ver `src/domain/tipos.ts`):
- **Sector**: polígono con `color`, `responsables[]` (nombre/telefono/categoria/funcion),
  censo, familias, vulnerables. El **desglose demográfico** (`Vulnerables` en
  `tipos.ts`) es por edad y sexo con grupos etarios excluyentes que suman la
  población: recién nacidos (0-2), niñez (3-11), adolescentes (12-17), adultos
  (18-59), adultos mayores (60+); más grupos transversales `embarazadas` y
  `discapacidad/patologías` (subconjuntos que pueden solaparse); y `mascotas`
  (conteo aparte que **no** suma como población). `normalizarVulnerables` tolera
  filas viejas sin los campos nuevos (default 0), así que añadir grupos no exige
  migración de Dexie.
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
> salubridad/aseo) y `centros` (red de Centros Transitorios). `/api/sync/purge`
> **no** borra `censos`, `distribuciones`, `limpiezas` ni `centros` (se conservan).
| WS | `/ws?token=<jwt>` | auth | Difunde `{type:"cambio", entidad, filas, serverTime}` |

**Entidades sincronizables** (mismo modelo blob+metadatos, last-write-wins):
`sectores`, `puntos`, `lineas`, `censos`, `distribuciones`, `limpiezas`, `centros`.
Para añadir una nueva hay que tocar, en cliente: `data/db.ts` (tabla + versión +
tipo `Entidad`/`OutboxItem`), `data/api.ts` (pull/push), `data/sync.ts`
(`aplicarLote`/`tablaDe`/pull/push/WS) y en servidor: `db/bootstrap.ts` (tabla),
`types.ts` (`Entidad`), `routes/sync.ts` (pull/push/difundir). `centros` (red de
Centros Transitorios) fue el último añadido siguiendo exactamente este patrón —
úsalo de referencia.

> 🚨 **PASO OBLIGATORIO AL AÑADIR/EDITAR UNA ENTIDAD: redesplegar producción.**
> Las tablas se crean con `CREATE TABLE IF NOT EXISTS` en `db/bootstrap.ts`, que
> **solo corre al (re)arrancar el servidor con el código nuevo**. Si tocas
> `bootstrap.ts` (o cualquier archivo del backend) tienes que: (1) **push a
> `main` en GitHub** y (2) **redeploy en Dokploy** (ver sección de despliegue).
> Sin eso, el servidor viejo **acepta el `POST /api/sync` y responde 200 pero
> descarta en silencio** el campo desconocido (zod ignora claves no declaradas);
> el cliente cree que se guardó, **vacía su `outbox`** y el dato queda **atrapado
> solo en ese dispositivo**. Síntoma clásico: los sectores sí se sincronizan pero
> la entidad nueva "no aparece en otros equipos". Esto fue exactamente el bug de
> `lineas` (jul-2026): producción llevaba meses en un commit anterior a que
> `lineas`/`censos`/`distribuciones`/`limpiezas` existieran, así que esas 4
> tablas ni siquiera existían en la BD de prod. **Verifica siempre tras deploy**
> que las tablas existan (comando abajo).

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
fechas"**, **gráfico de líneas "Comidas repartidas por fechas"** (una línea por
jornada: desayuno/almuerzo/cena/merienda/hidratación, para comparar si se reparten
más desayunos que cenas), **tarjeta "Alimentación de hoy"** (una casilla por jornada
con hora de llegada y barra de sectores servidos), **tarjeta "Cobertura de servicios"**
(global del parque), demografía por edad/sexo, alertas y limpieza. Reutiliza las
funciones de dominio existentes (`kpisGlobales`, `coberturaGlobal`, `generarAlertas`,
`sumarVulnerables`, `infoLimpieza`, `resumenDistribucion`, `serieComidasPorJornada`)
— no duplica lógica.

**Cobertura y alertas — GLOBALES del parque (no por sector):** los puntos (agua,
letrinas, duchas, salud, comida, basura) están en ubicaciones fijas del parque, no
dentro de los sectores. Por eso `brechas.ts` ya **no** calcula cobertura por sector
ni pinta semáforo de servicios en el sector; el sector solo lleva censo, demografía
y responsables. `coberturaGlobal(sectores, puntos)` cruza la población/familias
total del refugio contra los puntos operativos de cada tipo (estándar Esfera de
`estandares.ts`). `generarAlertas(sectores, puntos, distribuciones, ahora)` combina:
(1) cobertura global < 100%, (2) comidas que no llegaron en su ventana horaria
(`VENTANAS_COMIDA` en `estandares.ts`: desayuno 6-9, almuerzo 11:30-14:30, cena
17:30-20:30; usa la `hora_llegada` de las jornadas del día), y (3) aseo vencido
(letrinas/duchas/basura). Ejemplo: 5000 personas y 4 duchas → duchas al ~4% (rojo)
y alerta crítica.

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
`serieComidasPorJornada(registros, sectores, censos)` arma la **serie temporal de
comidas repartidas por fecha** (suma la población de los sectores servidos en cada
jornada; toma la población del censo más reciente ≤ ese día con carry-forward, y usa
la población actual como respaldo si el sector no tiene censos) → alimenta el gráfico
de líneas del dashboard; helpers `claveDiaLocal`, `formatoHora`, `horaAInput`/
`horaDesdeInput` (para el `<input type="time">` de ajuste manual de la hora de llegada).

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

## ✅ Red de Centros Transitorios (`/centros`, Fase 4) — FOCO ACTUAL DEL PROYECTO

El Parque "Alí Primera" se está desalojando y su gente se distribuye en una **red
de ~50 centros transitorios** de Caracas. **Gestionar esta red es la dirección
actual del producto** (ver "Qué es"). La ruta `/centros` (`src/features/centros/`)
permite **registrar el estado de cada centro** y decidir a dónde reubicar refugiados
con criterio. Aquí es donde debería concentrarse el trabajo nuevo.

**Datos:** 7.ª entidad sincronizable `centros`. Los 50 centros vienen de un
**catálogo estático** (`src/data/centrosTransitorios.ts`: nombre, cuerpo de
seguridad, parroquia, dirección, coordenadas) que se **siembra** en Dexie en la
migración v10 (id determinista `centro-01`…`centro-50`, `updated_at` bajo para que
cualquier edición gane) y también vía `sembrarCentrosSiVacio()` en instalaciones
nuevas. Solo las **ediciones** se sincronizan; el catálogo base viaja en el bundle.
El tipo `CentroTransitorio` (en `src/domain/centrosTransitorios.ts`) suma a los
campos base los mutables (opcionales, con `normalizarCentro()`): levantamiento de
campo (secciones I–VI: identificación, coordinación, seguridad, servicios sí/no,
población, novedades), `requerimientos[]`, `capacidad` (`CapacidadCentro`: camas/
duchas/pocetas/lavaderos/contenedores **instaladas vs operativas** + agua tanque/
operativa/litros), `ocupacion` (`Vulnerables`, mismo desglose por edad/sexo que
los sectores), **`personal`** (`PersonalCentro`: funcionarios, médicos, psicólogos,
justicia TJS/MP/Defensoría), `familias_ocupadas`, `responsables`, `foto_url`,
`estado` y `notas`. Helpers: `poblacionCentro()` (refugiados), `totalPersonalOperativo()`,
`personasLogistica()` (refugiados + personal → demanda de agua/comida/baños).

**Lógica de cuello de botella** (`src/domain/capacidadCentros.ts`, pura, análoga a
`brechas.ts`): `analisisCentro(centro)` usa **`personasLogistica`** (no solo
refugiados) para calcular requerimientos Esfera (pocetas 1/20, duchas 1/50, agua
15 l/persona/día; camas 1:1), toma la **capacidad efectiva = mínimo** entre los
recursos medidos, y de ahí **`cupoReal`** y **`cuelloDeBotella`**. Semáforo
verde/amarillo/rojo por % de ocupación. El análisis expone `refugiados`, `personal`
y `personasLogistica` por separado.

**UI:** `CentrosView` (conmutador **Mapa / Tablero**). En el mapa, `MarcadorCentro`
es una **píldora horizontal**: logo del cuerpo + **`refugiados / funcionarios`**
(ej. `200 / 25`) + punto de semáforo. Al seleccionar un centro, `DetalleCentro`
prioriza lo operativo a simple vista: KPIs grandes de **refugiados** y **familias**,
**personal total** (mini-totales por categoría), tarjeta de **logística** (agua,
comida, baños); los desgloses demográfico y de personal van en **secciones
desplegables**. Ya no muestra "Salud y apoyo" (sí/no) en detalle — eso queda en el
formulario pestaña IV; los conteos numéricos viven en `personal`. También: foto,
Maps, coordinación, seguridad, requerimientos, capacidad vs ocupación, responsables.
`TableroCentros` compara centros por cupo real. `CentroForm` por pestañas I–VI +
Requerimientos, Capacidad, Contactos; **personal operativo** se edita en **V ·
Población** (`DesglosePersonal.tsx`). Permisos: admin/coordinador/campo editan;
**visor solo lectura**.

**Foto vía Supabase Storage:** la foto se sube a un bucket **público**
`centros-fotos` de Supabase (`src/data/supabase.ts`: comprime a JPEG ~1280px antes
de subir) y se guarda solo la **URL** dentro del dato del centro. Requiere
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`); sin ellas la
app funciona igual pero el botón de foto queda desactivado. Es el **único** dato
que usa Supabase: todo lo demás vive en el backend/sync propio.

> ⚠️ **Gotcha RLS (si recreas el proyecto Supabase):** un bucket "público" solo
> hace públicas las **lecturas**; para **subir** con la anon key (la app NO usa
> Supabase Auth → todo va como rol `anon`) hay que crear políticas en
> `storage.objects`. Las que ya están puestas: `insert`/`update`/`select` para
> `anon, authenticated` con `bucket_id = 'centros-fotos'` (sin `delete`). Se
> aplicaron con el MCP de Supabase (`apply_migration`). El proyecto ya está
> configurado (bucket público 5MB, solo imágenes) y verificado (subida anon 200,
> lectura pública 200). El **MCP de Supabase** está en `.cursor/mcp.json`
> (gitignored) — transporte hosted/OAuth, scopeado a este proyecto.

> 🚨 Al ser entidad nueva: **push a `main` + redeploy en Dokploy** y verificar que
> la tabla `centros` exista en Postgres (ver checklist de despliegue).

## 🟢 Producción REAL — corre en Dokploy (no con el `docker-compose.yml` a mano)

> ⚠️ **Lee esto antes de tocar producción.** La app ya está **desplegada y viva**
> en el VPS **vía Dokploy** (un panel que gestiona los contenedores). El
> `docker-compose.yml`/`Dockerfile.web`/`Caddyfile` de la raíz son la receta
> genérica/alternativa manual (sección siguiente), **pero NO es lo que corre**.

**Cómo está montado en Dokploy** (proyecto `refugio-ali-primera`):
- **Dominio de producción:** `https://m0n1t0r-d3-3v3nt0s.net`.
- **`refugio-backend`** — servicio *Compose* (`composeId: ACKYOsSdQcksY0vu31loO`).
  Contiene **Postgres** (`db`, volumen `dbdata`) + **API Node** (`server`). El
  `server` se **construye desde GitHub**: `build.context =
  https://github.com/diazpolanco13/refugio-ali-primera.git#main:server`. Es decir,
  hornea la carpeta `server/` de la rama **`main`** con `server/Dockerfile`.
  `autoDeploy: true`, `triggerType: push`, `githubId` conectado y
  `watchPaths: ["server/**"]` → un push a `main` que toque `server/` **debería**
  redesplegarlo solo (verifica siempre en el panel).
- **`refugio-ali-primera`** — la **PWA/frontend** (aplicación aparte en Dokploy).
- El **enrutado/HTTPS** lo hace **Traefik** (de Dokploy), no el `Caddyfile` de la
  raíz. Los dominios `…/api` y `…/ws` apuntan al servicio `server:3001`.
- Los **secretos** (DB_PASSWORD, JWT_SECRET, ADMIN_USER/PASSWORD, CORS_ORIGIN) se
  editan en el panel de Dokploy (env del compose), **no** en un `.env` del repo.

### Desplegar / actualizar producción (Dokploy)
1. **Sube el código a GitHub `main`** (`git push origin main`). ⚠️ Producción se
   construye desde `main` en GitHub; si tus commits no llegaron al remoto, el
   redeploy horneará **código viejo** (esto pasó: el server llevaba meses en un
   commit anterior a `lineas`). Confirma con `git ls-remote origin main`.
2. **Redespliega** el compose `refugio-backend` (y la app del frontend si tocaste
   el cliente). Opciones:
   - Panel de Dokploy → botón **Redeploy/Rebuild**.
   - Vía **MCP de Dokploy** (herramienta `compose-redeploy` con el `composeId`
     de arriba). Este proyecto tiene ese MCP disponible.
3. **Verifica** que el server nuevo arrancó y creó las tablas (⬇️).

### Verificar producción tras un deploy
```bash
# Nombre de los contenedores del compose (prefijo autogenerado por Dokploy):
docker ps --format '{{.Names}}' | grep refugio    # o busca "…-server-1 / …-db-1"

# 1) Tablas presentes en Postgres (deben estar las 9: sectores, puntos, lineas,
#    censos, distribuciones, limpiezas, centros, usuarios, historial):
docker exec <compose>-db-1 psql -U refugio -d refugio -c "\dt"

# 2) La API responde y el pull trae TODAS las entidades:
curl -s https://m0n1t0r-d3-3v3nt0s.net/api/health         # {"ok":true,"db":"postgres",…}
TOKEN=$(curl -s https://m0n1t0r-d3-3v3nt0s.net/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}' | jq -r .token)
curl -s "https://m0n1t0r-d3-3v3nt0s.net/api/sync?since=0" -H "Authorization: Bearer $TOKEN" \
  | jq 'keys'   # debe incluir lineas, censos, distribuciones, limpiezas
```
Si falta una tabla → el server corre código viejo: revisa que `main` en GitHub la
tenga (`git ls-remote`), y vuelve a redesplegar.

> **Recuperar datos "atrapados":** si una entidad estuvo rota en prod, los datos
> que los usuarios creyeron guardar quedaron **solo en su dispositivo** (su
> `outbox` se vació con el 200 falso). No se recuperan solos: hay que **volver a
> editarlos/guardarlos** en el equipo donde están para re-encolarlos (p. ej. abrir
> la línea y moverle un vértice). Los datos nuevos ya sincronizan normal.

## 🚀 Alternativa manual: desplegar en el VPS con Docker Compose

> Referencia por si algún día se despliega sin Dokploy (o para entender la receta).
> **Lo que corre hoy es Dokploy** (sección anterior).

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
- **Migración Dexie:** `db.ts` está en **versión 10** (v2 `coordinador`→`responsables`,
 v4 desglose por edad/sexo, v5 líneas, v6 carpas, v7 tabla `censos` + foto inicial
 por sector, v8 tabla `distribuciones`, v9 tabla `limpiezas`, v10 tabla `centros` +
 siembra del catálogo estático de los 50 centros). Si cambias el esquema local, sube
 la versión y añade `upgrade`.
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
