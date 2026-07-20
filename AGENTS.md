# AGENTS.md

Reglas always-on viven **solo** en `.cursor/rules/` (grafo, caveman, UI).
No duplicar aquí tablas MCP ni instrucciones caveman.

| Doc | Rol |
|-----|-----|
| `CLAUDE.md` | Índice corto (always-on) |
| `docs/traspaso.md` | Traspaso completo — leer bajo demanda |
| `GRAPH_REPORT.md` | Guía del grafo |
| `CURSOR.md` | Caveman en Cursor |

## IA local (Hermes gateway)

Gateway OpenAI-compatible en `http://127.0.0.1:8642/v1` (Hermes + Gemma 4
12B vía Tailscale). **Antes de integrar IA en la app:** `docs/hermes-gateway.md`
(arquitectura, API key en Dokploy, gotchas que no tocar).
