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
> actual se centra en `/centros`, `/dashboard` e `/incidencias`.

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
- ✅ **Esquema Supabase:** 12 tablas (7 sync blob+jsonb + `ocupaciones_centros`
  + `reportes_centros` + `incidencias_centros` + `perfiles` + `historial`),
  RLS por rol + centros asignados, Edge Functions `create-user`/`delete-user`/
  `update-user-password`. Ver sección "Supabase — esquema y RLS".
- ✅ **Datos migrados:** los centros del Excel en la tabla `centros` (hoy **61 activos**) (los 49
  del Excel `DATA CENTRAL 03JUL26.xlsx`; la UEN Gran Colombia se divide en 3
  edificios → `centro-03/51/52`) + snapshot inicial 2026-07-03 para los 51 en
  `ocupaciones_centros`; usuarios migrados a `auth.users` + `perfiles` (admin +
  xavier, login verificado). La fuente Excel y el JSON/MD generados viven en
  `scripts/`.
- ✅ **Frontend:** nueva capa `src/data/` (supabaseClient, authSupabase,
  useSupabaseQuery, reposSupabase, useOcupacionesCentros, desenvolver). Todos
  los componentes migrados a Supabase (login, centros, dashboard, usuarios).
- ✅ **Histórico de ocupación:** tabla `ocupaciones_centros`, gráfico individual
  en `DetalleCentro` y agregado de la red en `DashboardView` (Fase 6).
- ✅ **Cutover de producción (Fase 7):** `server/` eliminado, `docker-compose`/
 `Dockerfile.web`/`Caddyfile` actualizados, `refugio-backend` detenido en
 Dokploy, frontend redeployado. (Ver "Producción REAL".)
- ✅ **CRUD completo de centros:** además de editar, la app permite **crear
 centros nuevos** (botón en `PanelCentros` → `CentroForm` con `esNuevo`),
 **eliminarlos** (borrado suave, con confirmación `AlertDialog` en el footer
 del form) y **editar la identificación y las coordenadas** (lat/lng manual o
 GPS, pestaña I del form). El guardado usa el RPC **`upsert_centro`**
 (SECURITY INVOKER, aplicado en Supabase; referencia en
 `supabase/functions.sql`) que actualiza blob `data` + columna PostGIS `geom`
 en una sola llamada. Con esto quedó cerrado el GAP de `geom` documentado en
 la Fase 3.
- ✅ **Reporte diario e incidencias por centro:** tablas `reportes_centros`
 (comidas por jornada + atenciones médicas, una fila por centro/día) e
 `incidencias_centros` (novedades con etiqueta/categorías/estado
 abierta-resuelta), formulario "Reporte del día" en la ficha del centro
 (reutiliza el parte numérico existente → `ocupaciones_centros` sigue
 alimentándose), secciones de reporte e incidencias en `DetalleCentro`/
 `FichaCentroView`, vista global `/incidencias` (filtros + calendario con
 severidad) y 2 KPIs nuevos en `/dashboard`. Ver sección "Reporte diario e
 incidencias por centro".
- ✅ **Sistema de usuarios con 5 roles y permisos por centro** (migración
 `sistema_usuarios_5_roles`, ver `docs/sistema-usuarios.md` y
 `supabase/sistema_usuarios.sql`): roles `admin` / `analista_sae` /
 `autoridad` / `supervisor` / `operador`; `perfiles.centros_asignados text[]`
 (reemplaza a `sector_asignado`); RLS por rol **y** centro asignado (helpers
 `mi_rol()`/`mis_centros()`/`mi_username()`/`mi_hash_id()`); `incidencias_centros.creada_por`
 (el operador solo resuelve las suyas); Edge Functions `create-user` v2
 (genera `hash_id` en el servidor), `delete-user` y `update-user-password`
 (gestión de usuarios COMPLETA desde `/usuarios`); vista `/logs` (bitácora
 `historial` con Realtime, solo admin y autoridad) y `registrarHistorial()`
 en los repos. Usuarios actuales: `admin` (admin) y `xavier` (analista_sae).

- ✅ **Red renombrada a "campamentos" y ampliada a 61 activos** (ids `centro-NN`;
 el campo `nro` del blob se rellenó desde el número del id — 08-jul). El mapa
 agrupa por **unidad interna SEBIN** (`supervision.unidad_sebin`, catálogo en
 `src/domain/unidadesSebin.ts`).
- ✅ **Reporte diario de 5 fases** (Parte numérico · Control · Trabajos ·
 Requerimientos · Novedades) en `/centros/reportes/:centroId?vista=reporte`:
 tablas nuevas `reportes_control_dia`, `reparaciones_centros` (trabajos),
 `requerimientos_seguimiento`, `casos_salud_centros` (con `titulo`, migración
 `casos_salud_titulo`) y `eventos_reportes`. El control **hereda las
 respuestas del día anterior**; los casos de salud llevan estatus segmentado
 (activo/en proceso/resuelto) y antigüedad en días (`BadgeAntiguedad`, siempre
 vs el día real). **Editar reportes de fechas pasadas**: solo admin/analista
 (`puedeEditarReportesPasados`); el parte de un día pasado escribe SOLO el
 snapshot (`soloSnapshot`), nunca el estado vigente del centro.
- ✅ **Portal público de terreno `/terreno`** (bootstrap ligero compartido con
 `/censo`, `src/features/terreno/`): dos botones (Reporte diario / Censo),
 pantallas de instrucciones una-vez con toggle de reset
 (`src/lib/instruccionesCampo.ts`). Desde el 09-jul el acceso público va por
 **token de terreno** `?t=<token>` (ver siguiente punto); `?centro=<id>` solo
 sigue funcionando con sesión autenticada.
- ✅ **Tokens de terreno por campamento (09-jul, Fase 1 del plan de acceso de
 campo):** tabla `tokens_centros` (token secreto revocable por centro, tipos
 `personal`/`publico`, RLS solo admin/analista) + helpers `centro_de_token()`
 y `acceso_censo_centro()` + RPC pública `terreno_centro(p_token)`. Las RPC
 del censo (`censo_registrar/actualizar/eliminar/listado/completar/cierre`)
 ganaron `p_token default null`: con sesión autenticada nada cambia; sin
 sesión exigen token `personal` vigente y limitan todo al centro del token.
 Se **cerró la fuga anon**: `censo_listado_red*`, `censo_resumen_red`,
 `censo_centros`, `censo_error_cedula_duplicada` y `censo_normalizar_jefe_doc`
 quedaron solo para `authenticated`, y los buckets `centros-fotos`/
 `infraestructura-fotos`/`reparaciones-fotos` ya no aceptan escritura anon.
 ⚠️ Al recrear cualquiera de esas funciones, Postgres re-otorga EXECUTE a
 PUBLIC: repetir los revoke (ver `supabase/tokens_terreno.sql`). Frontend:
 `src/lib/tokenTerreno.ts` (lee `?t=` con respaldo en localStorage),
 `reposCenso` adjunta `p_token` automáticamente, `/terreno` y `/censo`
 resuelven el campamento vía `obtenerCentroTerreno()`. Hay 61 tokens
 `personal` + 61 `publico` activos (los `publico` los usará el canal de
 denuncias de la Fase 3). **Ficha del campamento:** sección "Acceso de
 terreno" en la pestaña Resumen (`AccesoTerrenoCentro.tsx`, solo la ven
 admin/analista por RLS) con el enlace `?t=`, QR generado en el navegador
 (lib `qrcode`), copiar y descargar PNG; los enlaces usan
 `URL_PORTAL_TERRENO` (dominio de producción, nunca el dev server). Un
 **trigger** (`centros_generar_tokens`, migración `tokens_centro_auto`) crea
 los tokens automáticamente al registrar un campamento nuevo. Pendientes: Fase 2 (login de terreno con operador
 por campamento vía token), Fase 3 (denuncias QR), Fase 4 (subdominio +
 cerrar :5173 del VPS).
- ✅ **Partes en formato Telegram** (negritas `**…**`, pie `REF: <centro_id> |
 <dia>` parseable por un bot futuro): botón "Copiar parte" por campamento
 (`src/domain/reporteTelegramCentro.ts`) y menú **Compartir** en
 `/centros/reportes` con diálogo de vista previa + copiar
 (`src/domain/reporteTelegramRed.ts`) y descarga del PDF.
- ✅ **PDF ejecutivo de 3 secciones** (`@react-pdf/renderer`,
 `src/features/centros/reporte-ejecutivo/` + dominio
 `reporteEjecutivoCampamentos.ts`): portada (KPIs, demografía H/M por grupo,
 censo SEBIN, control con donuts, unidades SEBIN), detalle del día en 3
 columnas (trabajos/salud/novedades con días abiertos) y tabla de la red
 ordenada por N°.
- ⚠️ **Datos piloto de simulación** sembrados el 08-jul en todos los
 campamentos (partes, controles, trabajos, requerimientos, casos, novedades)
 con `updated_by = 'simulacion'` / `creada_por = 'simulacion'`. Limpieza:
 `delete from <tabla> where updated_by = 'simulacion'` en las 7 tablas.

### Qué falta / próximos pasos
- 🤖 **Bot de Telegram (emisor):** publicar el parte por campamento y el parte
  general de la red al grupo de enlaces desde un contenedor en Dokploy
  (formateadores ya listos en `src/domain/reporteTelegram*.ts`; el `REF:` del
  pie permite casar mensajes con la BD sin matching difuso).
- 🔁 **Traslados entre centros:** hoy el tablero es comparativo (decides tú).
  Falta (si se pide) registrar/rastrear **movimientos de refugiados entre
  centros** y, opcionalmente, un motor de sugerencias de reubicación.
- 🗑️ **Limpieza menor:** restos del módulo del parque que se pueden borrar sin
  riesgo: `src/data/centrosTransitorios.ts` (catálogo estático de los 51
  centros, fallback; la fuente de verdad es la tabla `centros`), `src/ui/`
  (Modal, clases.ts, useEsMovil — sin consumidores), las carpetas vacías
  `src/features/{distribucion,lineas,puntos,salubridad,sectores}/` y las
  dependencias `terra-draw`/`terra-draw-maplibre-gl-adapter` de `package.json`
  (ya no se importan).
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
`@tailwindcss/vite`, sin config) · **MapLibre GL** (mapa; Terra Draw quedó como
dependencia en `package.json` pero **ya no se usa** desde que se retiró el
módulo del parque) · **@supabase/supabase-js** (Postgres, Auth, Realtime, Storage) ·
**vite-plugin-pwa** (service worker para caché de assets) · **react-router-dom**
(rutas `/`, `/dashboard`, `/incidencias`, `/usuarios`, `/logs`) · **recharts** (gráficos,
vía componente `chart` de shadcn) · **react-day-picker** + **date-fns** (los
requiere el componente `calendar` de shadcn, usado en incidencias). UI con
**shadcn/ui** (Radix + cva + `cn()` en `src/lib/utils.ts`, componentes en
`src/components/ui/`, estilo `radix-nova` en `components.json`).

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
│  reporteDiario.ts (tipos y helpers del reporte diario: comidas por jornada,
│    atenciones médicas, racionesDelDia, reporteDelDia…),
│  incidencias.ts (tipo Incidencia + catálogos de etiquetas/categorías +
│    helpers de severidad y agrupado por día),
│  permisos.ts (5 roles: INFO_ROLES + helpers puedeEscribir,
│    puedeGestionarUsuarios, puedeVerLogs, puedeCrearCentros,
│    puedeEditarCentro, puedeResolverIncidencia)
├─ data/ supabaseClient.ts (cliente supabase-js con VITE_SUPABASE_*),
│  authSupabase.ts (login/signOut/onAuthStateChange + perfil desde `perfiles`),
│  useSupabaseQuery.ts (hook select + Realtime, reemplaza a useLiveQuery),
│  useSupabaseConectado.ts (estado de conexión a Realtime para la UI),
│  useOcupacionesCentros.ts (snapshots de `ocupaciones_centros` con Realtime),
│  useReportesCentros.ts / useIncidencias.ts (reportes diarios e incidencias
│    con Realtime, mismo patrón que useOcupacionesCentros),
│  reposReportes.ts (guardarReporteDiario, crearIncidencia,
│    actualizarIncidencia, resolverIncidencia),
│  edgeFunctions.ts (invocarEdgeFunction: helper para llamar Edge Functions),
│  historial.ts (registrarHistorial fire-and-forget + useHistorial con
│    Realtime para /logs),
│  reposSupabase.ts (upserts/deletes; centros vía RPC `upsert_centro` +
│    `eliminarCentro` + snapshot de ocupación al guardar centro),
│  desenvolver.ts (aplana filas blob+jsonb `{id,updated_at,deleted,data}` → T),
│  normalizarGeom.ts (hex EWKB/WKT/GeoJSON de PostgREST → GeoJSON Point),
│  supabase.ts (subida de foto de centro al bucket `centros-fotos`),
│  centrosTransitorios.ts (catálogo estático de los 51 centros, fallback),
│  preferenciasMapa.ts (vista guardada en localStorage)
├─ map/ estiloMapa.ts (estilos base del mapa; MapView.tsx se retiró con el parque)
├─ features/ centros/ (FOCO: CentrosView, FichaCentroView (/centro/:id),
│  CentrosMap, MarcadorCentro, InfoCentro,
│  DetalleCentro (panel + secciones Seccion*Centro reutilizables),
│  TableroCentros, CentroForm, LevantamientoCentro,
│  RequerimientosCentro, PanelCentros, ControlesMapaCentros, IconosAlerta,
│  GraficoOcupacionCentro, ReporteDiarioForm, ReporteDiarioCentro,
│  IncidenciasCentro) ·
│  incidencias/ (IncidenciasView (/incidencias), CalendarioIncidencias,
│  ListaIncidencias) ·
│  dashboard/ (DashboardView, GraficoOcupacionRed) ·
│  censo/ (DesgloseDemografico, DesglosePersonal, PersonalResumen) ·
│  tablero/ (DemografiaResumen) ·
│  auth/Login · usuarios/GestionUsuarios · logs/ (LogsView (/logs)) ·
│  (distribucion/, lineas/, puntos/, salubridad/, sectores/ quedaron VACÍAS
│   tras retirar el módulo del parque; se pueden borrar)
├─ components/ Navbar, PanelFlotante, MarcaAgua, BadgeRol, PantallaCarga,
│  AccionesContacto · ui/ (componentes shadcn: card, chart, badge, alert-dialog,
│  command, select, calendar, tabs…)
├─ lib/ utils.ts (cn())
└─ ui/ (legacy, SIN consumidores: Modal, clases.ts, useEsMovil — se puede borrar)
```

Rutas (react-router en `src/main.tsx` + `src/App.tsx`): `/` = `CentrosView`
(red de Centros Transitorios, **foco actual**), `/centro/:id` =
`FichaCentroView` (ficha completa de un centro a pantalla completa:
multicolumna en escritorio lg+, una columna en móvil; se abre desde el tablero
y, en móvil, desde el botón "detalles" del mapa), `/dashboard` = `DashboardView`
(sala de control a pantalla completa, solo lectura), `/incidencias` =
`IncidenciasView` (tablero global de incidencias de la red, solo lectura/
análisis, todos los roles; link "Incidencias" con icono Siren en la Navbar),
`/usuarios` = `GestionUsuarios` (admin), `/logs` = `LogsView` (bitácora,
admin y autoridad). En prod Traefik (Dokploy) hace fallback SPA a
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

Proyecto `xzwifkckkakldnzkdeby`. 12 tablas en el schema `public`:

**7 tablas sincronizables (blob + jsonb, idénticas al backend Fastify viejo):**
`sectores`, `puntos`, `lineas`, `censos`, `distribuciones`, `limpiezas`,
`centros`. Esquema: `id text PK, updated_at bigint, updated_by text, deleted
bool, data jsonb`. `centros` además tiene `geom geography(Point, 4326)` (PostGIS)
aparte del blob. Upsert **last-write-wins** (`updated_at`); borrado **suave**
(`deleted: true`). El frontend usa `desenvolver()` para aplanar `data` + metadatos
al tipo de dominio (y `normalizarGeom()` para convertir el hex EWKB que
devuelve PostgREST en GeoJSON Point).

**RPC `upsert_centro(p_id, p_data, p_lng, p_lat)`** (aplicada, migración
`upsert_centro_rpc`; SQL de referencia en `supabase/functions.sql`): upsert del
blob `data` + recálculo de `geom` en una sola llamada (supabase-js no puede
escribir geography directamente). `SECURITY INVOKER` → la RLS de `centros`
sigue aplicando; `EXECUTE` solo para `authenticated`. Es la vía por la que
`guardarCentro()` crea/edita centros (incl. coordenadas).

**`ocupaciones_centros`** (tipada, el histórico): `id uuid PK default
gen_random_uuid()`, `centro_id text not null references centros(id) on delete
cascade`, `dia date not null`, `ts bigint`, `total_afectados int`, `familias
int`, `personal_total int`, `ocupacion jsonb`, `updated_at bigint`,
`updated_by text`, **`unique(centro_id, dia)`** (una fila por centro por día; la
última edición del día gana), índices en `(dia)` y `(centro_id, dia)`.

**`reportes_centros`** (tipada, reporte diario; SQL de referencia en
`supabase/reportes_incidencias.sql`): `id uuid PK default gen_random_uuid()`,
`centro_id text not null references centros(id) on delete cascade`, `dia date
not null`, `comidas jsonb` (`{desayuno, almuerzo, cena}` → `{raciones,
hora_llegada, proveedor, observacion}`), `atenciones_medicas int`,
`observaciones text`, `updated_at bigint`, `updated_by text`,
**`unique(centro_id, dia)`** (una fila por centro por día; la última edición
gana), índices en `(dia)` y `(centro_id, dia)`.

**`incidencias_centros`** (tipada, novedades con seguimiento; mismo SQL de
referencia): `id uuid PK`, `centro_id text not null references centros(id) on
delete cascade`, `dia date not null`, `ts bigint`, `descripcion text`,
`etiqueta text check in (urgente, importante, cotidiana)`, `categorias text[]`
(catálogo: seguridad, salud, agua, alimentacion, infraestructura, servicios,
convivencia, otro), `estado text default 'abierta' check in (abierta,
resuelta)`, `resuelta_ts bigint`, `resuelta_por text`, **`creada_por text`**
(quién la abrió; estable, a diferencia de `updated_by` que se pisa al editar),
`updated_at bigint`, `updated_by text`, índices en `(dia)`, `(centro_id, dia)`
y `(estado)`. **Append** por incidencia (no una fila por día). Ambas tablas
están en la publicación Realtime.

**`perfiles`**: `user_id uuid references auth.users`, `username text unique`,
`nombre`, `rol check in (admin, analista_sae, autoridad, supervisor,
operador)` (default `operador`), **`centros_asignados text[] not null default
'{}'`** (reemplaza al viejo `sector_asignado`), `jerarquia`, `cedula`,
`responsabilidad`, `whatsapp`, `telegram`, `brazalete`, `hash_id unique`,
`marca_agua bool default true`, `created_at timestamptz default now()`.
Vinculada a `auth.users` por `user_id`. Los usuarios de campo no tienen email
real → se usa el sintético `<username>@refugio.app` en `auth.users`.

**`historial`**: `id uuid, ts bigint, usuario text, accion, entidad,
entidad_id, detalle jsonb`. Bitácora con UI en `/logs` (solo admin y
autoridad); en la publicación Realtime. El frontend inserta vía
`registrarHistorial()` (`src/data/historial.ts`, fire-and-forget) desde
`guardarCentro`/`eliminarCentro`/`crearIncidencia`/`resolverIncidencia`/
`guardarReporteDiario`; las Edge Functions insertan las acciones de usuarios.

**RLS por rol + centro** (migración `sistema_usuarios_5_roles`, SQL de
referencia en `supabase/sistema_usuarios.sql`). Helpers `SECURITY DEFINER`
estables: `mi_rol()`, `mis_centros()`, `mi_username()`, `mi_hash_id()` (leen
`perfiles` por `auth.uid()` sin recursión; el último evita un subselect directo
sobre `perfiles` dentro de `perfiles_update`, que dispara "infinite recursion
detected in policy"). Se usan como `(select mi_rol())` → initplan.
Matriz:

- `centros` / `ocupaciones_centros` / `reportes_centros`: **select** —
  `admin/analista_sae/autoridad` todo; `supervisor/operador` solo
  `id/centro_id = any(mis_centros())`. **insert/update** — `admin/analista_sae`
  todo; `supervisor/operador` solo sus centros (insert de `centros` solo
  admin/analista). **delete** — solo `admin/analista_sae`.
- `incidencias_centros`: igual, pero el **update** del `operador` exige además
  `creada_por = mi_username()` (solo resuelve las suyas).
- `perfiles`: select/insert/update/delete — `admin` todo; cada usuario lee y
  edita su propia fila **sin poder cambiar** `rol`, `centros_asignados` ni
  `hash_id`. (El `hash_id` dejó de ser legible por todos; nadie más necesita
  leer perfiles ajenos porque `updated_by` guarda el username en texto.)
- `historial`: select — solo `admin` y `autoridad`; insert — los 4 roles que
  escriben; sin update; delete solo admin.
- Las 6 tablas blob del módulo retirado del parque (sectores, puntos, lineas,
  censos, distribuciones, limpiezas) conservan las policies viejas con los
  roles `coordinador`/`campo` (ya inexistentes) → en la práctica solo admin
  escribe. No se tocaron (módulo retirado).

**Edge Functions** (desplegadas vía MCP `deploy_edge_function`, `verify_jwt:
true` + check interno de rol admin; referencia versionada en
`supabase/functions/<nombre>/index.ts`; entrypoint `Deno.serve(...)` — ojo: con
`export default` la request se queda colgada hasta el idle timeout):

- **`create-user` v2**: valida los 5 roles y que los `centros_asignados`
  existan; **genera el `hash_id` en el servidor** (`XXXX-XXXX` hex, único);
  crea `auth.users` + `perfiles` (con rollback del auth.user si falla el
  perfil) y registra `crear_usuario` en `historial`.
- **`delete-user`**: rechaza el auto-borrado; `auth.admin.deleteUser` (el
  `ON DELETE CASCADE` arrastra el perfil); registra `eliminar_usuario`.
- **`update-user-password`**: `auth.admin.updateUserById(user_id, {password})`;
  registra `cambiar_password` (sin la contraseña).

El frontend las invoca con `invocarEdgeFunction()` (`src/data/edgeFunctions.ts`,
usa `supabase.functions.invoke` con el token de la sesión). **CORS:** las tres
funciones deben permitir en `Access-Control-Allow-Headers` los headers que
adjunta supabase-js: `authorization`, `x-client-info`, `apikey`, `content-type`
(sin `x-client-info`/`apikey` el preflight desde el navegador falla aunque
`curl` funcione).

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
  los 51 centros, con desglose por grupo (Área Metropolitana vs Gran Caracas).
- **Snapshot inicial 2026-07-03** cargado para los 51 centros en la Fase 2 (el
  "día 1" de la red). Los gráficos arrancan desde ahí.

Usa el componente `chart` de shadcn (`ChartContainer`/`ChartTooltip`) con
`var(--chart-N)` como colores (siguiendo la regla del workspace de usar el MCP
de shadcn para cualquier diseño de UI).

## Reporte diario e incidencias por centro

Flujo: los supervisores de cada centro reportan **cada día** desde la ficha del
centro. El **parte numérico** (ocupación demográfica + personal) reutiliza el
flujo existente (`guardarCentro()`), así el snapshot histórico de
`ocupaciones_centros` sigue funcionando sin cambios; las **comidas** y las
**atenciones médicas** van a `reportes_centros` (una fila por centro/día); las
**incidencias** se registran en `incidencias_centros` con etiqueta de severidad
(**urgente** rojo / **importante** ámbar / **cotidiana** gris), categorías y
estado abierta/resuelta. Tablas + RLS en "Supabase — esquema y RLS"; SQL de
referencia en `supabase/reportes_incidencias.sql`.

- **Dominio** (`src/domain/`): `reporteDiario.ts` (tipos `ReporteDiario`,
  `ComidaJornada`, `ComidasDia`, `JornadaReporte`
  desayuno|almuerzo|cena; catálogo `CATALOGO_JORNADAS_REPORTE`; helpers
  `jornadaReportada`, `jornadasReportadas`, `reporteCompleto`,
  `racionesDelDia`, `reporteDelDia`) e `incidencias.ts` (tipo `Incidencia`;
  catálogos `ETIQUETAS_INCIDENCIA` con orden de severidad y
  `CATEGORIAS_INCIDENCIA`; helpers `compararSeveridad`,
  `agruparIncidenciasPorDia`, `severidadMaxima`, `severidadMaximaPorDia` —para
  los puntos de color de los calendarios— e `incidenciasAbiertas`).
- **Capa de datos** (`src/data/`): hooks `useReportesCentros({centroId?, dia?,
  desde?})` y `useIncidencias({centroId?, desde?, estado?})` (select inicial +
  Realtime, mismo patrón que `useOcupacionesCentros`) y `reposReportes.ts`
  (`guardarReporteDiario()` con upsert `onConflict centro_id,dia`,
  `crearIncidencia()`, `actualizarIncidencia()`, `resolverIncidencia()` que
  marca resuelta + `resuelta_ts`/`resuelta_por`).
- **Ficha del centro** (`src/features/centros/`): `ReporteDiarioForm` (dialog
  con pestañas: **Parte numérico** —reutiliza `DesgloseDemografico`/
  `DesglosePersonal` y guarda vía `guardarCentro()`—, **Comidas** por jornada
  con raciones/hora de llegada/proveedor y **Atención médica** con número +
  observaciones; se abre con el botón "Reporte del día" en la cabecera de
  `FichaCentroView` y desde la sección en `DetalleCentro`),
  `ReporteDiarioCentro` (`SeccionReporteDiarioCentro`: estado del reporte de
  HOY con chips por jornada reportada/pendiente, raciones totales, atenciones,
  badge "Pendiente") e `IncidenciasCentro` (`SeccionIncidenciasCentro`: alta
  rápida con descripción + etiqueta + categorías, lista de abiertas con
  "Resolver" con confirmación, resueltas recientes colapsables y calendario
  mensual del centro con punto del color de la severidad máxima por día; clic
  en un día muestra sus incidencias). Ambas secciones integradas en
  `DetalleCentro` y `FichaCentroView` (columna 2 el reporte, columna 3 las
  incidencias en escritorio; también en el orden móvil). Permisos:
  `puedeEditarCentro(usuario, centroId)` (autoridad solo lee; supervisor/
  operador solo en sus centros) y el botón "Resolver" usa
  `puedeResolverIncidencia` (el operador solo resuelve las que abrió él;
  `creada_por`).
- **Vista global `/incidencias`** (`src/features/incidencias/`, todos los
  roles, solo lectura/análisis): `IncidenciasView` (filtros por etiqueta/
  categoría/centro/estado, contadores por categoría clicables, layout
  responsivo), `CalendarioIncidencias` (calendario shadcn con puntos de
  severidad y leyenda; clic filtra por día) y `ListaIncidencias` (ordenada por
  severidad y fecha desc, enlaza a `/centro/:id`).
- **Dashboard**: 2 KPIs nuevos con Realtime (ver "Sala de control").
- **shadcn**: componentes nuevos `calendar`, `tabs`, `select` en
  `src/components/ui/` (`calendar` trajo las dependencias `react-day-picker` y
  `date-fns`).

## Auth y usuarios

- **Login** (`src/features/auth/Login.tsx` + `src/data/authSupabase.ts`): el
  usuario escribe su `username` y password; la capa lo mapea a
  `<username>@refugio.app` y llama a `supabase.auth.signInWithPassword`.
  `onAuthStateChange` mantiene la sesión. Tras login se carga el `perfil` desde
  `perfiles` (donde están `rol`, `centros_asignados`, `hash_id`, `marca_agua`,
  etc.) y se arma el `Usuario` de la app. Rol desconocido o perfil ausente →
  fallback a `autoridad` (solo lectura, seguro).
- **Sesión** (`useSesion()`): `useSyncExternalStore` sobre el estado interno
  que publica `onAuthStateChange`. Mantiene la misma interfaz pública que la
  capa legacy (`getSesion`, `getToken`, `cerrarSesion`, `setSesion`) para no
  romper consumidores.
- **Gestión de usuarios** (`/usuarios`, `GestionUsuarios.tsx`, solo admin):
  lista agrupada por rol con filtro y conteos, tarjetas con `BadgeRol`,
  `hash_id` en mono, chips de centros asignados y marca ON/OFF. El formulario
  tiene **multi-select de centros** (Popover + Command, con atajo **"Todos
  los centros"** que selecciona/deselecciona la red entera y colapsa a un chip
  "Toda la red"; deshabilitado para roles de alcance total), selector de rol
  shadcn `Select` con descripción, **cambio de contraseña funcional** (Edge
  Function `update-user-password`) y **eliminación completa** (`delete-user`).
  Ya no quedan gaps de gestión.
- **Roles** (5, ver `docs/sistema-usuarios.md`): `admin` (todo + usuarios +
  logs) · `analista_sae` (opera toda la red, sin usuarios ni logs) ·
  `autoridad` (solo lectura + logs) · `supervisor` (lee/escribe SOLO sus
  `centros_asignados`) · `operador` (ídem supervisor, pero solo resuelve las
  incidencias que él abrió). Los chequeos de UI viven en
  `src/domain/permisos.ts` (`INFO_ROLES`, `puedeEscribir`,
  `puedeGestionarUsuarios`, `puedeVerLogs`, `puedeCrearCentros`,
  `puedeEditarCentro(usuario, centroId)`, `puedeResolverIncidencia(usuario,
  incidencia)`); la RLS aplica la misma matriz en el servidor.
- **Bitácora `/logs`** (`src/features/logs/LogsView.tsx`, solo admin y
  autoridad): lista cronológica de `historial` con Realtime y filtros por
  rango de fechas, entidad y usuario. Link "Bitácora de acciones" en el menú
  del avatar de la Navbar.
- **Marca de agua** anti-foto: `MarcaAgua` muestra la identidad del usuario y
  la fecha si `perfil.marca_agua !== false`.

## Red de Centros Transitorios (`/centros`, foco actual)

La ruta `/centros` (`src/features/centros/`) permite **registrar el estado de
cada centro** y decidir a dónde reubicar refugiados con criterio.

**UI:** `CentrosView` (conmutador **Mapa / Centros** en la Navbar; la vista
"Centros" es el `TableroCentros`, que compara centros por cupo real y cuyo
clic en una tarjeta navega a la ficha completa `/centro/:id`). En el
mapa, `MarcadorCentro` es una **píldora horizontal**: logo del cuerpo +
**`refugiados / funcionarios`** (ej. `200 / 25`) + punto de semáforo. Al
seleccionar un centro, el botón "detalles" de la nube abre el `PanelFlotante`
con `DetalleCentro` en escritorio y navega a `/centro/:id` en móvil (<768px,
`window.matchMedia`). `DetalleCentro` prioriza lo operativo a simple vista:
KPIs grandes de **refugiados** y **familias**, **personal total** (mini-totales
por categoría), tarjeta de **logística** (agua, comida, baños), **gráfico de
ocupación** (desplegable), los desgloses demográfico y de personal en
**secciones desplegables**, foto, Maps, coordinación, seguridad,
requerimientos, capacidad vs ocupación, responsables. Está descompuesto en
**secciones exportables** (`Seccion*Centro` + `BadgesEstadoCentro`) que
reutiliza `FichaCentroView` (`/centro/:id`): cabecera propia con "Volver",
3 columnas en escritorio (identidad/contactos · personas/necesidades ·
capacidad e histórico con el gráfico abierto por defecto) y una columna en
móvil, con el mismo `CentroForm` para editar.
`CentroForm` por pestañas I–VI + Requerimientos, Capacidad, Contactos; el
**personal operativo** se edita en **V · Población** (`DesglosePersonal.tsx`).
La pestaña **I · Identificación** es editable: nombre, grupo, cuerpo asignado,
parroquia, dirección, enlace de Maps y **coordenadas** (lat/lng decimales o
botón GPS). **Crear centro:** botón "Registrar centro nuevo" en `PanelCentros`
(y "+" con el panel plegado) → `CentroForm` en modo `esNuevo` con el siguiente
N.° libre. **Eliminar centro:** botón en el footer del form con confirmación
(`AlertDialog`); borrado suave. Permisos: **crear/eliminar centros** solo
`admin`/`analista_sae`; editar también `supervisor`/`operador` pero únicamente
sus centros asignados (la RLS además les oculta el resto de la red);
**autoridad solo lectura**.

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

Contenido: reloj en vivo, KPIs grandes en rejilla `xl:grid-cols-4` (8
tarjetas: refugiados, familias, personal operativo, centros con datos, cupo
disponible, centros críticos, más 2 nuevas con Realtime: **"Incidencias
abiertas"** con subtexto de urgentes en rojo y **"Raciones hoy"** —suma de
`racionesDelDia` de los reportes del día vs población total—), **gráfico
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
- **Marcadores** de centros son **HTML markers** (no capa de círculos) para
  mostrar logo+cifras+semáforo sin depender de fuentes del mapa
  (`CentrosMap.tsx` + `MarcadorCentro.tsx`).
- **PWA / service worker:** `vite-plugin-pwa` con `autoUpdate`. Ya no hay
  offline-first con cola/outbox; el SW queda para caché de assets estáticos y
  deep-link offline (`navigateFallback: index.html`). `runtimeCaching` cachea
  tiles de mapa ya visitados.
- **shadcn CLI:** al añadir componentes (`npx shadcn add …`) revisa que los
  imports queden con alias `@/...` (a veces el CLI escribe `src/lib/utils` o
  `src/components/ui/button` y rompe Vite; pasó con `cn` y con el import de
  `button` dentro de `calendar.tsx`).
- **`@/data/supabase.ts`** (Storage) **vs `@/data/supabaseClient.ts`** (cliente
  general): el primero es el helper legacy de subida de fotos (solo Storage);
  el segundo es el cliente supabase-js que usa toda la nueva capa. No
  confundirlos.
- **Edge Functions desde el navegador:** `invocarEdgeFunction` usa
  `supabase.functions.invoke`, que envía `x-client-info` y `apikey`. Si al
  crear/editar/eliminar usuarios ves "Failed to send a request to the Edge
  Function" con CORS en consola, revisa que la función incluya esos headers en
  `Access-Control-Allow-Headers` (ver sección Edge Functions).
- **RLS `perfiles`:** no hagas subselects directos sobre `perfiles` dentro de
  sus propias policies; usa helpers `SECURITY DEFINER` (`mi_hash_id()` para el
  chequeo de `hash_id` inmutable en updates).
- **`crypto.randomUUID` no existe en contextos http** (acceso por IP al dev
  server): `nuevoId()` (reposSupabase) genera un UUID v4 con `getRandomValues`
  como fallback — varias tablas tienen `id uuid` y rechazan otros formatos.
- **Copiar al portapapeles en http:** no hay Clipboard API; se usa
  `src/lib/portapapeles.ts` (execCommand) y, en la vista de red, un diálogo
  con textarea visible (copiar "a ciegas" desde un menú Radix falla porque el
  cierre roba el foco).
- Un warning de React "changed size between renders" que aparece **solo en el
  entorno de preview del asistente** NO proviene de esta app (se comprobó); no
  aparece en un navegador normal.

## Verificación rápida

- Frontend: `npm run typecheck` y `npm run build` (deben pasar limpios). Probar
  en navegador: login con `admin`, listar los 51 centros, editar ocupación de
  un centro y ver el snapshot en `ocupaciones_centros` (Supabase Studio),
  crear un centro de prueba con coordenadas y verlo en el mapa (y eliminarlo),
  abrir el gráfico individual y el de red, editar en un dispositivo y ver
  refresco en otro (Realtime), subir foto, llenar el "Reporte del día" de un
  centro (parte numérico + comidas + atención médica), registrar y resolver una
  incidencia y verla en `/incidencias` y en los KPIs del dashboard.
- Usuarios y permisos: desde `/usuarios` crear un `operador` con 2 centros
  asignados, loguearse con él y comprobar que solo ve/edita esos centros, que
  solo resuelve las incidencias que abrió él, cambiarle la contraseña desde
  `/usuarios` (relogin) y eliminarlo (desaparece de `auth.users` y
  `perfiles`); revisar la bitácora en `/logs` con el admin.
- Supabase: `list_tables` (verbose) y `get_advisors` (security) vía MCP para
  confirmar esquema y RLS.
