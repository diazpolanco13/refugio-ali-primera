# Hermes Gateway — IA local para el sistema (16-jul-2026)

> Infraestructura de IA disponible para integrar en la app (bots, resúmenes de
> partes, clasificación de denuncias, etc.). Corre FUERA de este repo pero en
> el mismo VPS; este doc es la referencia para cualquier IA/desarrollador que
> vaya a consumirla.

## Qué hay

Un **Hermes Agent** (Nous Research) en modo gateway, desplegado en Dokploy
como proyecto independiente `hermes-agent` (compose `hermes-gateway`,
contenedor `hermes-agent`). Su inteligencia viene 100% de un **LLM local** en
una DGX Spark (`spark-30ed`) vía **Tailscale** — cero nubes de terceros,
coherente con la soberanía de datos del proyecto.

```
App / scripts (VPS) → http://127.0.0.1:8642/v1  (Hermes gateway, OpenAI-compatible)
                          └─ Tailscale → http://100.93.106.34:8007/v1  (vLLM, Gemma 4 12B IT, 65536 ctx)
```

## Cómo consumirlo (API OpenAI-compatible)

- **Base URL:** `http://127.0.0.1:8642/v1` — SOLO accesible desde el propio
  VPS (loopback + UFW). Un contenedor Docker en bridge NO llega a 127.0.0.1
  del host: usar `network_mode: host` o gateway IP con puerto abierto (hoy no).
- **Auth:** `Authorization: Bearer <API_SERVER_KEY>`. La key NO está en el
  repo (repo público): vive en las env del compose `hermes-gateway` en
  Dokploy y en el entorno del contenedor.
- **Modelo a pedir:** `"model": "hermes"` (el gateway expone `hermes-agent`
  como único modelo; él enruta a Gemma internamente).
- Es un **agente**, no un LLM pelado: tiene herramientas (terminal, archivos,
  memoria persistente en `/etc/dokploy/hermes-data/`). Una "chat completion"
  puede ejecutar herramientas antes de responder. Para completions crudas sin
  agente, llamar directo a la DGX: `http://100.93.106.34:8007/v1` (modelo
  `google/gemma-4-12B-it`, api key dummy `local-dgx`) — también solo desde el
  VPS (Tailscale del host).

```bash
curl http://127.0.0.1:8642/v1/chat/completions \
  -H "Authorization: Bearer $HERMES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"hermes","messages":[{"role":"user","content":"hola"}],"max_tokens":300}'
```

## Configuración clave (y por qué — no romper)

Config en `/etc/dokploy/hermes-data/config.yaml` (host VPS, fuera del repo):

- `model.provider: custom`, `base_url: http://100.93.106.34:8007/v1`,
  `default: google/gemma-4-12B-it`, `api_key: local-dgx` (vLLM no autentica;
  Hermes exige key no vacía).
- `model.context_length: 65536` y `auxiliary.compression.context_length:
  65536`: Hermes exige ≥64K de contexto.
- `model.max_tokens: 8192`: **obligatorio**. Sin él Hermes pide
  `max_tokens=<context_length>` y vLLM devuelve 400, que Hermes malinterpreta
  como "Context length exceeded… Cannot compress further".
- El system prompt de Hermes consume ~16–31K tokens por llamada — presupuesto
  real de conversación ≈ 30–45K tokens.

## Lado DGX (no gestionado desde este VPS)

- vLLM sirve Gemma 4 12B IT en `:8007` con `--max-model-len 65536`
  (persistente en el preset `gemma412b` de `~/scripts/dgx_vllm_menu.py` en la
  DGX). En `:8008` corre DiffusionGemma — **NO usarlo para agentes**: rompe
  tool-calling multi-turno.
- El `:8007` jamás se publica a Internet; solo Tailscale.

## Operación

- Logs: `docker logs hermes-agent` (o panel Dokploy, proyecto `hermes-agent`).
- Dashboard web: `127.0.0.1:9119` → túnel `ssh -L 9119:127.0.0.1:9119 root@vps`.
- Datos persistentes (config, sesiones, memorias, skills):
  `/etc/dokploy/hermes-data/`. El contenedor usa `network_mode: host` (único
  modo simple de alcanzar la tailnet del host); UFW (22/80/443) blinda 8642/9119.
- Tras editar `config.yaml`: `docker restart hermes-agent`.
