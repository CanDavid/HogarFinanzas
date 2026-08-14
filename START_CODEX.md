# Inicio recomendado con Codex

Abre Codex en la raíz del repositorio, donde está `AGENTS.md`.

## Primera tarea

Usa esta instrucción:

> Lee por completo `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/TECHNICAL_SPEC.md`, `.agent/PLANS.md` y `docs/IMPLEMENTATION_PLAN.md`. No escribas todavía funcionalidades de fases posteriores. Empieza únicamente por la Fase 0. Antes de modificar código, inspecciona el repositorio y adapta el plan de la Fase 0 al estado real del proyecto. Implementa la Fase 0 completa, compila, ejecuta las pruebas correspondientes y revisa el diff. Actualiza el estado y los hallazgos en `docs/IMPLEMENTATION_PLAN.md`. Al terminar, detente y dame: resumen de lo implementado, pruebas ejecutadas y resultado, y pasos exactos que debo validar manualmente en el simulador. No continúes con la Fase 1 hasta que yo te lo indique.

## Después de validar una fase

Para continuar:

> La Fase N está validada. Revisa `AGENTS.md` y el plan actualizado y ejecuta únicamente la Fase N+1. Mantén la misma disciplina: implementación, tests, build, revisión del diff, actualización del plan y checkpoint antes de continuar.

## Fase 1 — requisito especial

La Fase 1 es un spike técnico de CloudKit Sharing. No debe darse por terminada solo porque compile. Debe verificarse con dos Apple ID diferentes y sincronización bidireccional real. Si el comportamiento real de Core Data/CloudKit contradice la especificación, documenta el hallazgo, propone el cambio mínimo de arquitectura y actualiza el registro de decisiones antes de ampliar el modelo.
