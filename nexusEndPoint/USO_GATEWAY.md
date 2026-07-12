# Gateway Nexus — referencia rápida

Ver la documentación completa en **[README.md](./README.md)**.

## URLs

| Uso | URL |
|---|---|
| Health | `https://nexus.m0n1t0r-d3-3v3nt0s.net/health` |
| Censo (slim) | `POST …/v1/person/search/external/full/{V\|E}/{cedula}/censo` |
| Upstream crudo | `POST …/v1/person/search/external/full/{V\|E}/{cedula}` |

## Auth

1. `Authorization: Bearer <JWT sesión Supabase>` (app / QR terreno), o  
2. `X-Gateway-Secret` (solo servidor).

## UI

`/censo` → pestaña **Por cédula** → verificar → crear hogar → familiares.  
Destino: tablas nominales (`refugiados`, `familias_centro`, `alojamientos_refugiados`).

## Foto SAIME

El full trae el *nombre* del archivo (`foto_nombre`), no la imagen. La imagen
vive en un MinIO (`alfa-images` en `10.51.12.85:9000`) y la institución la sirve
por `GET /api/cedula-photo/<filename>/`. Pendiente: URL base + credenciales del
admin, luego wire-up del gateway/avatar. Detalle en `README.md` §6.
