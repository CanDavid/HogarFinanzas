# Inicio de trabajo — Hogar Finanzas

Lee en orden `AGENTS.md`, `docs/PRODUCT_SPEC.md`, `docs/TECHNICAL_SPEC.md`, `docs/IMPLEMENTATION_PLAN.md` y `docs/ADR-001-ZERO-COST-PWA.md` antes de cambiar código.

Arquitectura definitiva: React + TypeScript + Vite PWA, IndexedDB, Google Apps Script, Google Sheets, GitHub Pages y GitHub Actions Linux. El coste obligatorio debe permanecer en 0 €.

Trabaja en una sola fase. No anticipes cuentas, presupuestos, objetivos u otras funciones futuras. La UI usa IndexedDB como fuente inmediata y la sincronización nunca debe bloquear una escritura local.

Antes de cerrar una fase ejecuta:

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Revisa el diff, los warnings y posibles secretos; actualiza `docs/IMPLEMENTATION_PLAN.md` y entrega pasos manuales. Una fase compartida no se completa hasta observarla en los dos iPhone.
