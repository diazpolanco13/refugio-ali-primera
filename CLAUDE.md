# CLAUDE.md — Guía para continuar el proyecto

> Documento de traspaso. Si eres una IA/desarrollador retomando este proyecto
> (por ejemplo desde el VPS), **lee esto primero**. Explica qué es, qué está
> hecho, cómo ejecutarlo y **exactamente qué falta** (Fase 2b) con un plan
> concreto. El proyecto y sus comentarios están en **español**; mantén ese idioma.

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
  al marcar limpio y en ediciones clave; mostrar en el tablero), gestión de
  usuarios desde la UI (admin), y desplegar en el VPS. **Siguiente trabajo.**
- ⏳ **Fase 3:** vista sala de control (pantalla grande), overlay de la
  ilustración del parque, export PDF de reportes.

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
(IndexedDB) · **vite-plugin-pwa**. Sin librería de componentes (todo propio).

**Backend (`server/`):** **Fastify 5** + **PostgreSQL** (geom como `jsonb`, sin
PostGIS por ahora) · **@fastify/jwt v10** (JWT) · **@node-rs/argon2** (hash) ·
**@fastify/websocket** · **zod**. En dev usa **PGlite** (Postgres en proceso, WASM)
si no hay `DATABASE_URL`; en prod usa Postgres real.

## Arquitectura del frontend

```
src/
├─ domain/     tipos.ts (modelo + catálogos), estandares.ts (Esfera),
│              brechas.ts (cobertura/alertas/point-in-polygon), limpieza.ts (cronómetro)
├─ data/       db.ts (Dexie, versión 2 con migración), repos.ts (guardar/eliminar),
│              seed.ts (ejemplo), preferencias.ts (vista guardada en localStorage)
├─ map/        MapView.tsx (MapLibre + Terra Draw + marcadores HTML), estiloMapa.ts (bases)
├─ features/   sectores/SectorForm · puntos/PuntoForm · tablero/Tablero
└─ ui/         Modal, clases.ts (clases Tailwind reutilizables)
```

Conceptos del dominio (ver `src/domain/tipos.ts`):
- **Sector**: polígono con `color`, `responsables[]` (nombre/telefono/categoria/funcion),
  censo, familias, vulnerables.
- **PuntoServicio**: 11 tipos (`hidratacion, comida, salud, sanitarios, duchas,
  residuos, carpa, recreacion, seguridad, energia, acceso`). Campos opcionales por
  tipo: seguridad → `organismo`+`movilidad`; baños/duchas → `genero`+`condicion`
  (improvisada no cuenta para el estándar); baños/duchas/basura → cronómetro
  `frecuenciaLimpiezaHoras`+`ultimaLimpieza`.
- Todo lleva `id`, `updated_at`, `updated_by` (hoy siempre `"local"`).

## Backend — contrato de la API (`server/`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/health` | — | Estado |
| POST | `/api/auth/login` | — | `{username,password}` → `{token, user}` |
| GET | `/api/auth/me` | auth | Payload del token |
| GET | `/api/usuarios` · POST | admin | Listar / crear usuarios |
| GET | `/api/sync?since=<ts>` | auth | `{sectores, puntos, serverTime}` con filas cambiadas (incluye `deleted:true`) |
| POST | `/api/sync` | admin/coordinador/campo | Body `{sectores:[fila], puntos:[fila]}` → upsert **last-write-wins** |
| GET/POST | `/api/historial` | auth / (no visor) | Bitácora |
| WS | `/ws?token=<jwt>` | auth | Difunde `{type:"cambio", entidad, filas, serverTime}` |

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

## Despliegue en el VPS (ya preparado)

Docker Compose con Postgres + API + **Caddy** (HTTPS automático). El usuario tiene
dominio y un VPS (6 vCPU / 12 GB). Ver `docker-compose.yml`, `Caddyfile`,
`server/Dockerfile`, `.env.deploy.example`.

```bash
git clone https://github.com/diazpolanco13/refugio-ali-primera.git
cd refugio-ali-primera
cp .env.deploy.example .env     # DOMAIN, JWT_SECRET, DB_PASSWORD, ADMIN_PASSWORD reales
npm install && npm run build    # genera dist/ (Caddy la sirve)
docker compose up -d --build
```
`.env` está en `.gitignore` — **nunca** commitear secretos.

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
- **Migración Dexie:** `db.ts` está en versión 2 (migró `coordinador`→`responsables`).
  Si cambias el esquema local, sube la versión y añade `upgrade`.
- Un warning de React "changed size between renders" que aparece **solo en el
  entorno de preview del asistente** NO proviene de esta app (se comprobó); no
  aparece en un navegador normal.

## Verificación rápida

- Frontend: `npm run build` (typecheck + build). Probar en navegador: dibujar
  sector, colocar punto, marcar limpio, recargar offline (DevTools) y ver que
  persiste.
- Backend: `npm run typecheck --prefix server`; arrancar y probar
  `POST /api/auth/login` (admin/admin1234), `POST /api/sync` y `GET /api/sync?since=0`.
