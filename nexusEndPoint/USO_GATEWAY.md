# Gateway Nexus — referencia rápida

Ver la documentación completa en **[README.md](./README.md)**.

## URLs

| Uso | URL |
|---|---|
| Health | `https://nexus.m0n1t0r-d3-3v3nt0s.net/health` (`foto_minio`) |
| Censo (slim) | `POST …/v1/person/search/external/full/{V\|E}/{cedula}/censo` |
| Upstream crudo | `POST …/v1/person/search/external/full/{V\|E}/{cedula}` |
| Foto SAIME | `GET …/foto/<foto_nombre>` → `image/jpeg` |

## Auth

1. `Authorization: Bearer <JWT sesión Supabase>` (app / QR terreno) —
   validación cacheada 5 min por token, o  
2. `X-Gateway-Secret` (solo servidor).

`/health` y `/health/nexus` son públicos. `/foto` exige auth.

## UI

`/censo` → pestaña **Por cédula** → verificar → crear hogar → familiares.  
Destino: tablas nominales (`refugiados`, `familias_centro`, `alojamientos_refugiados`).

## Foto SAIME

1. Slim trae `foto_nombre` (no el binario).
2. Gateway: `GET /foto/<foto_nombre>` con **cache-aside** (activo 22-jul-2026):
   primero MinIO **propio** (`minio-cache`, bucket `saime-fotos`, red interna
   Docker); miss → MinIO institucional `alfa-images` (VPN) + copia al cache.
3. Hit ~0.06 s; las fotos cacheadas se sirven aunque la VPN esté caída.
   Logs: `docker logs nexus-gateway | grep "foto "` → `cache=hit|miss`.
4. UI: `cargarFotoSaime()` → blob URL; avatares del hogar priorizan SAIME
   sobre `foto_url` de Storage (foto de campo antigua).

**No** guardar en Supabase Storage. Detalle del cache: README §6.

```bash
# Ejemplo (ops)
curl -sS -o /tmp/saime.jpg -D- \
  -H "X-Gateway-Secret: $PROXY_SECRET" \
  "https://nexus.m0n1t0r-d3-3v3nt0s.net/foto/V-17089732-186c1dea.jpg"
```
