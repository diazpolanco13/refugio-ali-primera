# CURSOR.md — Caveman + Cursor en este repo

> Respuestas concisas por defecto. Caveman ON desde el primer mensaje.
> Código/comentarios del producto siguen en **español**.

## Qué es

[Caveman](https://github.com/JuliusBrussee/caveman) — skill que recorta ~65% de
tokens de **salida** (filler, rodeos). No reduce capacidad técnica. Código,
comandos y errores quedan byte-a-byte.

## Default en este proyecto

| Pieza | Rol |
|-------|-----|
| `.agents/skills/caveman/` (+ siblings) | Skill oficial |
| `.cursor/rules/caveman.mdc` | Always-on (`alwaysApply: true`), nivel **full** |
| `.cursor/hooks/tarea-rapida-start.sh` | sessionStart: flag `full` + estado grafo (sin repetir rules) |
| `docs/traspaso.md` | Traspaso largo (bajo demanda) |
| `CLAUDE.md` | Índice corto always-on |
| `AGENTS.md` | Punteros + Hermes (sin duplicar caveman/grafo) |

Nivel default: **full**. Español comprimido (no inglés forzado).

## Comandos de sesión

| Qué | Cómo |
|-----|------|
| Encender / nivel | `/caveman` · `/caveman lite\|full\|ultra` · "modo caveman" |
| Apagar | "stop caveman" · "normal mode" · "modo normal" |
| Stats | `/caveman-stats` (skill `caveman-stats`) |
| Commits cortos | skill `caveman-commit` |
| Review 1 línea | skill `caveman-review` |

## Verificar

```bash
# Skills en el repo
ls .agents/skills/caveman/SKILL.md

# Regla Cursor always-on
test -f .cursor/rules/caveman.mdc && head -5 .cursor/rules/caveman.mdc

# Flag de sesión (lo escribe el hook sessionStart)
cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/.caveman-active"   # esperado: full

# Plugin Claude Code
claude plugin list | grep -i caveman
```

Chat nuevo en Cursor: respuesta corta estilo caveman, en español, sin relleno.
Si llega prosa larga → di "caveman mode" o revisa que `caveman.mdc` siga con
`alwaysApply: true`.

## Reinstall / update

```bash
npx skills add JuliusBrussee/caveman -a cursor -y
npx -y github:JuliusBrussee/caveman -- --only cursor --only claude --with-init --force --non-interactive
```

No hace falta `caveman-compress` sobre `docs/traspaso.md` (traspaso largo a
propósito; no va en always-on).
