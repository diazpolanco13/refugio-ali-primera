# Backend — Sala Situacional

API de sincronización y autenticación para la Fase 2 (colaboración multiusuario).
**Fastify + PostgreSQL**, con modelo de datos JSON-blob + metadatos para sync
offline-first (last-write-wins por `updated_at`, borrados suaves).

## Desarrollo local (sin instalar nada)

Sin `DATABASE_URL`, el servidor usa **PGlite** (Postgres en proceso):

```bash
cd server
npm install
npm run dev        # http://localhost:3001  (o npm run start)
```

Crea automáticamente el usuario **admin / admin1234** la primera vez (cámbialo con
`ADMIN_PASSWORD`). Datos en `server/.data/pglite`.

## Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/health` | — | Estado del servidor |
| POST | `/api/auth/login` | — | `{username,password}` → `{token,user}` |
| GET | `/api/auth/me` | auth | Datos del token |
| GET | `/api/usuarios` | admin | Listar usuarios |
| POST | `/api/usuarios` | admin | Crear usuario |
| GET | `/api/sync?since=<ts>` | auth | Cambios desde un timestamp |
| POST | `/api/sync` | admin/coordinador/campo | Subir cambios (last-write-wins) |
| GET | `/api/historial` | auth | Bitácora |
| POST | `/api/historial` | admin/coordinador/campo | Registrar acción |
| WS | `/ws?token=<jwt>` | auth | Cambios en tiempo real |

Roles: **admin** (todo), **coordinador**/**campo** (leer + escribir), **visor** (solo leer).

## Producción (Docker, en el VPS)

Ver `../docker-compose.yml`. Con `DATABASE_URL` presente usa PostgreSQL real.
Variables: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, `CORS_ORIGIN`.
