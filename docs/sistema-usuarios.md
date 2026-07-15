# Sistema de Usuarios y Permisos por Rol

## Qué es el proyecto

Herramienta de **gestión humanitaria (CCCM)** para la emergencia de Caracas / La Guaira tras la tragedia del 24-jun-2026. El producto es la **red de ~50 Centros Transitorios** repartidos por el Área Metropolitana y Gran Caracas: registrar el estado, la capacidad y la ocupación de cada centro, decidir a dónde reubicar gente y seguir la evolución diaria de toda la red.

Stack: **React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui** en el frontend, **Supabase** (Postgres + Auth + Realtime + Storage) como capa de datos. Idioma: **español**. No hay backend propio: el frontend habla directo con Supabase.

## Qué ya existe implementado (contexto para no reinventar)

- **Tabla `perfiles`** vinculada a `auth.users` por `user_id`. Campos actuales: `user_id`, `username` (único), `nombre`, `rol` (hoy limitado a `admin`, `coordinador`, `campo`, `visor`), `sector_asignado` (text, **un solo centro**), `jerarquia`, `cedula`, `responsabilidad`, `whatsapp`, `telegram`, `brazalete`, `hash_id` (único, inmutable), `marca_agua` (bool), `created_at`.
- **Login** por `username` + password, mapeado a email sintético `<username>@refugio.app` contra Supabase Auth.
- **Edge Function `create-user`** desplegada (crea `auth.users` + `perfiles`; solo admin puede invocarla). Faltan **eliminar usuario** y **cambiar la password de otro usuario**, que hoy solo se hacen desde Supabase Studio.
- **Pantalla `/usuarios`** (`GestionUsuarios.tsx`): lista de usuarios, edición de perfil y creación. Solo accede `admin`.
- **Catálogo de roles y permisos** en `src/domain/permisos.ts` (`ROLES`, `INFO_ROLES`, helpers de permiso) y `src/components/BadgeRol.tsx` (badge de color por rol).
- **Control de acceso (RLS)** hoy: cualquier usuario autenticado lee todo; los roles `admin`, `coordinador` y `campo` escriben en todas las tablas operacionales; `visor` solo lee. **No hay filtro por centro asignado**: un `coordinador` o `campo` puede editar cualquier centro de la red.
- **Tablas operacionales** afectadas por los permisos: `centros` (con `geom` PostGIS), `ocupaciones_centros` (histórico diario), `reportes_centros` (parte diario de comidas y atenciones médicas), `incidencias_centros` (incidencias con severidad urgente/importante/cotidiana, categorías y estado abierta/resuelta), `historial` (bitácora de acciones, **existe en BD pero sin UI**).
- **Módulo de incidencias** ya implementado: `src/features/incidencias/` (`IncidenciasView`, `ListaIncidencias`, `CalendarioIncidencias`), dominio en `src/domain/incidencias.ts`, hook `useIncidencias.ts`.
- **Usuarios ya migrados**: `admin` y `xavier` (login verificado en producción).

## Objetivo de este requerimiento

Crear el **sistema de usuarios con 5 roles y privilegios diferenciados** para operar la red de centros, con asignación de **uno o varios centros** por usuario, control de acceso que restrinja por centro asignado (salvo los roles de alcance total), gestión completa de usuarios (crear, editar, eliminar, cambiar password), y visualización de usuarios por categorías.

## Modelo de roles (5)

Migración de los roles actuales: `coordinador → supervisor`, `campo → operador`, `visor → autoridad`; `admin` se mantiene; y se agrega `analista_sae` como rol nuevo.

### `admin` — Administrador
Control total del sistema. Crea y edita usuarios, ve y edita toda la red de centros, gestionas incidencias y reportes en cualquier centro, y es el único rol que ve los **logs / historial**.

### `analista_sae` — Analista
> La clave interna sigue siendo `analista_sae` (BD, RLS, Edge Functions); solo
> cambió el nombre visible a **"Analista"** (15-jul-2026) para que el rol sirva
> a cualquier institución (SEBIN, PNB, …), no solo a la SAE.

**Homólogo operativo del admin.** Puede hacer casi todo en lo operativo: ve y edita toda la red de centros, abre y resuelve incidencias en cualquier centro, gestiona reportes diarios y ocupaciones en toda la red. La diferencia con `admin` es que **no gestiona usuarios** y **no puede ver los logs / historial** (ni los propios ni los de otros). Tiene **centros asignados** que definen su ámbito de monitoreo y responsabilidad de reporte de eventos, pero su acceso operativo es de alcance total, igual que el admin.

### `autoridad` — Autoridad
Alto funcionario con **solo lectura total**. Ve todos los centros, incidencias, reportes, ocupaciones y logs, pero no puede crear, modificar ni eliminar nada.

### `supervisor` — Supervisor
Alto funcionario con **responsabilidad operativa integral** sobre sus centros asignados (uno o varios): seguridad, logística, salud, alimentación, reparaciones e incidencias. Solo ve y edita los centros que tiene asignados. Dentro de sus centros abre y resuelve incidencias y gestiona el parte diario.

### `operador` — Operador
Funcionario que hace vida en el(los) centro(s) asignado(s). Encargado de **reportar todo diariamente** en todas las áreas: ocupación, reporte diario, incidencias. Solo ve y edita sus centros asignados. Puede **abrir** incidencias en sus centros y **resolver solo las que él creó**.

### Matriz de permisos

| Rol | Crear/editar usuarios | Ver centros | Escribir centros | Reporte diario | Incidencias | Logs / historial |
|-----|------------------------|--------------|------------------|----------------|-------------|-------------------|
| `admin` | Sí | Todos | Todos | Todos | Abrir y resolver en todos | Sí (lee todo) |
| `analista_sae` | No | Todos | Todos | Todos | Abrir y resolver en todos | **No** |
| `autoridad` | No | Todos | No | No | No | Sí (solo lectura) |
| `supervisor` | No | Sus centros | Sus centros | Sus centros | Abrir y resolver en sus centros | No |
| `operador` | No | Sus centros | Sus centros | Sus centros | Abrir en sus centros; resolver solo las propias | No |

## Asignación de centros

Hoy `perfiles.sector_asignado` es un text que permite asignar **un solo centro**. El nuevo modelo necesita **uno o varios centros** por usuario, para `analista_sae`, `supervisor` y `operador`. El campo pasa a ser un **array de IDs de centros**.

- `admin` y `autoridad` no necesitan asignación (su alcance es la red completa).
- `analista_sae` tiene centros asignados como **ámbito de monitoreo** (dónde le toca vigilar y reportar eventos), pero su acceso operativo es total.
- `supervisor` y `operador` solo pueden operar dentro de sus centros asignados.
- Los IDs del array deben corresponder a centros existentes y no marcados como borrados.

## Control de acceso por rol y por centro

El control de acceso combina **rol** + **centros asignados**:

- `admin` y `analista_sae` escriben y leen en **cualquier centro** de la red.
- `supervisor` y `operador` solo leen y escriben en los **centros de su array**.
- `autoridad` es **solo lectura** en todas las tablas operacionales (centros, ocupaciones, reportes, incidencias); no puede crear, modificar ni eliminar nada.
- En `incidencias_centros`, el `operador` solo puede **resolver** las incidencias que él mismo abrió.
- `perfiles`: cada usuario lee su propio perfil; `admin` gestiona todos; los demás pueden leer campos básicos de otros (nombre, rol, centros asignados, jerarquía) para mostrar "quién marcó". El `hash_id` solo lo ve `admin` (y el propio usuario en su perfil).
- `historial`: `admin` y `autoridad` leen; los roles operativos (`analista_sae`, `supervisor`, `operador`) insertan registros cuando actúan, pero no los leen.

## Gestión de usuarios

El admin debe poder **crear, editar, eliminar y cambiar la password** de cualquier usuario desde la pantalla `/usuarios`. Hoy solo crear y editar el perfil funcionan; eliminar y cambiar password de otros requieren completar las Edge Functions correspondientes (hoy se hacen desde Supabase Studio).

- Al crear un usuario se definen: identidad (nombre, cédula, brazalete), cargo (jerarquía, responsabilidad), rol, **centros asignados (multi-select)**, contacto (WhatsApp, Telegram), marca de agua y password inicial.
- Al editar se pueden cambiar todos los campos anteriores, incluida la password.
- Al eliminar se borra tanto el perfil como el registro de autenticación, con confirmación.
- El `hash_id` se genera al crear y es **inmutable**; no se edita.

## Interfaz de usuario

- **Vista por categorías**: la lista de usuarios en `/usuarios` se agrupa o filtra por rol, con el conteo de cada categoría y badges de color diferenciados por rol.
- **Tarjeta de usuario**: nombre, `@username`, badge de rol, chips con los centros asignados (N.° y nombre), `hash_id` en mono, datos de contacto y badge de marca de agua ON/OFF.
- **Formulario**: multi-select de centros asignados (reemplaza el selector único actual), selector de rol con descripción de cada uno, edición de password y eliminación con confirmación.
- **Badges de rol**: 5 estilos diferenciados y coherentes con la paleta de la app.
- **Visibilidad de rutas**: `/usuarios` solo para `admin`; la vista de logs solo para `admin` y `autoridad`.

## Hash y marca de agua

- **`hash_id`**: identificador único e inmutable de cada usuario, generado al crear. Se usa en la **marca de agua anti-foto** para disuadir y trazar capturas de pantalla.
- **`marca_agua`**: booleano por usuario que activa o desactiva la marca de agua en su propia pantalla. Lo controla el admin desde la ficha del usuario.

## Logs / historial

La tabla `historial` ya existe en la base de datos pero no tiene interfaz. Este requerimiento la **revive**:

- Vista de logs accesible solo para `admin` (lectura completa) y `autoridad` (solo lectura).
- Lista cronológica filtrable por entidad, usuario y rango de fechas.
- Registra acciones críticas: crear/editar/eliminar usuario, crear/editar/eliminar centro, abrir/resolver incidencia, crear/actualizar reporte diario.
- El `analista_sae` **no ve** esta vista (es la única excepción a su rol de homólogo operativo del admin).

## Reportes de eventos del analista SAE

El **"reporte de eventos"** del analista SAE **no es una entidad nueva**: reutiliza la tabla `incidencias_centros` y el módulo de incidencias ya implementado. El analista SAE crea incidencias con severidad y categorías, igual que el operador o el supervisor. La diferencia es de **alcance** (toda la red, no solo sus centros asignados) y de **rol**, no de modelo de datos.

## Consideraciones generales

- El sistema debe respetar el idioma **español** en toda la UI y los comentarios.
- Toda la UI nueva o modificada debe usar **shadcn/ui** y los tokens de diseño ya definidos en el proyecto.
- Los usuarios ya migrados (`admin`, `xavier`) deben seguir funcionando tras la migración; `xavier` se reasigna al rol equivalente que se decida (`supervisor` u `operador`).
- El login existente por username + password no debe romperse.
- El sistema debe mantener el refresco en vivo (Realtime) de la lista de usuarios, centros e incidencias.
- La verificación de seguridad de Supabase tras los cambios no debe reportar nuevas advertencias críticas.
