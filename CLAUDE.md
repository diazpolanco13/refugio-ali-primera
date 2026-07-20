# CLAUDE.md — índice (always-on corto)

> Contexto mínimo para cada chat. **Detalle de negocio:** `docs/traspaso.md`
> (léelo bajo demanda; no lo copies aquí). **Reglas operativas:** solo en
> `.cursor/rules/` — no reescribir grafo/caveman/UI en este archivo.

## Qué es

CCCM / red de ~61 **campamentos transitorios** (Caracas/La Guaira, post
24-jun-2026). Foco: estado, capacidad, ocupación, reubicación, reportes
diarios, censo nominal, terreno por QR. Datos soberanos en Supabase
(`xzwifkckkakldnzkdeby`). PWA: `https://m0n1t0r-d3-3v3nt0s.net`.

Módulo del parque Alí Primera **retirado**. Rutas clave: `/centros`,
`/dashboard`, `/incidencias`, `/censo`, `/terreno`.

## Stack / cómo correr

React 19 + Vite 7 + TS + Tailwind 4 + MapLibre + Supabase-js + shadcn.
Sin backend propio.

```bash
npm install && npm run dev   # :5173
./reiniciar.sh               # atajo dev (no toca prod)
```

Env local: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).

## Dónde leer qué

| Necesitas… | Archivo |
|------------|---------|
| Traspaso completo (schema, RLS, censo Nexus, prod, pendientes) | `docs/traspaso.md` |
| Grafo MCP antes de grep | `.cursor/rules/code-review-graph.mdc` · `GRAPH_REPORT.md` |
| Respuestas concisas (caveman) | `.cursor/rules/caveman.mdc` · `CURSOR.md` |
| Botones/Selects con relieve | `.cursor/rules/ui-controles-visibles.mdc` |
| Hermes / IA local | `docs/hermes-gateway.md` |
| Identidad terreno | `docs/plan-identidad-terreno.md` |
| Migración operadores a contraseña | `docs/plan-migracion-operadores-password.md` |
| Usuarios/roles | `docs/sistema-usuarios.md` |

## Gotchas críticos (releer detalle en traspaso)

1. **`CREATE OR REPLACE FUNCTION` resetea `EXECUTE` a PUBLIC** — tras tocar
   RPC `SECURITY DEFINER`, re-verificar grants (`anon` vs `authenticated`).
2. Secretos solo en `.env` / Dokploy — repo público.
3. No “arreglar” `.git/hooks/pre-commit` (no-op a propósito; grafo = post-commit).
4. Código/comentarios en **español**.

## Pendientes (resumen)

Foto SAIME (credenciales Nexus), bot Telegram emisor de partes, limpieza
resto módulo parque, Fase C Hermes. Detalle: `docs/traspaso.md` § «Qué falta».
