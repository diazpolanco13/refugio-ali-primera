---
name: frontend-orchestrator
description: >-
  Orquestador multi-agente de frontend para Campamentos Transitorios.
  Usar cuando el usuario pida descomponer tareas de UI, lanzar agentes en
  paralelo con Composer/worktrees, planificar features frontend, o invocar
  el flujo de orquestación (análisis → grafo → Task Cards → merge → review).
---

# Frontend Orchestrator — Campamentos Transitorios

## Cuándo activar

Activa este skill cuando el usuario:
- Pida planificar o descomponer una tarea de frontend de alto nivel
- Quiera correr Composer / agentes en paralelo con worktrees
- Mencione el Orquestador, Task Cards, grafo de dependencias o merge plan
- Pida skeletons, mapas, estado, design system o integración Supabase a escala

## Cerebro vs ejecutores

| Rol | Modelo recomendado | Función |
|-----|-------------------|---------|
| **Orquestador** | Grok 4.5 (o el más capaz disponible) | Análisis, descomposición, prompts, integración, review arquitectónica |
| **Ejecutores** | Cursor Composer | Implementación acotada en worktrees paralelos |
| **Review** | Grok 4.5 o Composer fuerte | Code review final post-merge |

## Lectura obligatoria antes de orquestar

1. `prompts/orchestrator.md` — System prompt del Orquestador
2. `PROJECT_ARCHITECTURE_MEMORY.md` — Memoria del proyecto (actualizar si cambió)
3. `WORKFLOW.md` — Fases F0–F6
4. El specialist relevante en `prompts/specialists/`

## Salida mínima obligatoria

Toda respuesta del Orquestador debe incluir:

1. **Análisis** (alcance, riesgos, archivos tocados)
2. **Dependency Graph** (mermaid)
3. **Task Cards** (una por subtarea)
4. **Prompts Composer** listos para pegar
5. **Plan de worktrees + merge order**
6. **Criterios de aceptación globales**
7. **Actualización propuesta** a Architecture Memory (si aplica)

## Reglas duras

- Máximo **2–3** agentes escribiendo en paralelo
- Un agente = un worktree = un conjunto de archivos **disjuntos**
- Prohibido “quick & dirty” que rompa patrones existentes
- UI nueva: preferir shadcn (`user-shadcn` MCP) y tokens del design system
- No ejecutar commits ni comandos de consola por el usuario; entregar instrucciones
- Responder siempre en **español**

## Especialistas disponibles

| ID | Archivo | Usar para |
|----|---------|-----------|
| `ui-architect` | `prompts/specialists/ui-component-architect.md` | Componentes, composición, props |
| `styling` | `prompts/specialists/styling-design-system.md` | Tailwind, dark mode, tokens |
| `state-data` | `prompts/specialists/state-data-layer.md` | Hooks de datos, Supabase client, caching |
| `map-geo` | `prompts/specialists/map-geospatial.md` | MapLibre, markers, clustering |
| `loading-perf` | `prompts/specialists/loading-performance.md` | Skeletons, Suspense, perceived perf |
| `integration` | `prompts/specialists/integration-api.md` | Edge functions, realtime, errores |
| `review` | `prompts/specialists/review-quality.md` | Review TS, a11y, perf |

## Ejemplo de referencia

Ver `examples/skeleton-loading-sidebar.md` para un run completo del Orquestador.
