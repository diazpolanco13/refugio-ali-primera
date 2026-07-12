# Sala Situacional — Red de Centros Transitorios

Herramienta de gestión humanitaria (CCCM) para la emergencia de Caracas/La
Guaira tras la tragedia del 24-jun-2026. Tras el desalojo del Parque del Oeste
"Alí Primera", la app gestiona la **red de ~50 Centros Transitorios** del Área
Metropolitana y Gran Caracas: estado, capacidad y ocupación de cada centro,
cuello de botella según estándares Esfera, decision de reubicación y evolución
diaria de la ocupación de la red.

## Stack

- **Frontend:** React 19 + Vite 7 + TypeScript + Tailwind v4 · MapLibre GL +
  Terra Draw · recharts (gráficos) · shadcn/ui · vite-plugin-pwa.
- **Capa de datos:** **Supabase** (Postgres + Auth + Realtime + Storage),
  accedida vía `@supabase/supabase-js` desde el frontend. No hay backend propio.
- **Fotos de centros:** Supabase Storage (bucket público `centros-fotos`).

## Ejecutar

```bash
npm install
npm run dev        # desarrollo → http://localhost:5180
npm run build      # build de producción (dist/)
npm run typecheck
```

Requiere `.env` local (no se commitea) con:

```
VITE_SUPABASE_URL=https://xzwifkckkakldnzkdeby.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_MAPTILER_KEY=           # opcional, bases "HD"
```

Atajo: `./reiniciar.sh` levanta el frontend en segundo plano.

## Producción

- Dominio: `https://m0n1t0r-d3-3v3nt0s.net`
- Desplegada en **Dokploy** (app `refugio-ali-primera`), construida desde
  `github.com/diazpolanco13/refugio-ali-primera#main` con `autoDeploy: true`.
- El backend Fastify anterior fue retirado (Fase 7 de la migración a Supabase);
  el compose `refugio-backend` quedó detenido en Dokploy.

## Documentación

Toda la guía de arquitectura, esquema Supabase, RLS, Edge Function
`create-user`, histórico de ocupación y procedimientos de despliegue está en
[`CLAUDE.md`](CLAUDE.md).
