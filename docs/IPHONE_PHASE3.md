# Aceptación en iPhone — Fase 3

Prerrequisitos: `migratePhase3` ejecutada, Web App `3.0.1-phase3` desplegado y PWA actualizada en ambos iPhone. Sincroniza ambos antes de empezar.

| Caso | David | Esther | Resultado esperado |
|---|---:|---:|---|
| Navegar por las cinco pestañas | ☐ | ☐ | La barra inferior permanece accesible; Plan, Objetivos y Análisis indican honestamente su fase futura |
| Revisar Inicio | ☐ | ☐ | Patrimonio, liquidez e importes del mes coinciden en ambos |
| Abrir Cuentas/Categorías desde Inicio o Ajustes | ☐ | ☐ | La gestión existente sigue operativa |
| Crear gasto con nota | ☐ | ☐ | Aparece localmente y converge con la nota íntegra |
| Buscar por concepto, nota, cuenta y categoría | ☐ | ☐ | Cada búsqueda encuentra solo los movimientos correspondientes |
| Filtrar mes actual/anterior/rango | ☐ | ☐ | Las fechas límite se incluyen y el recuento es correcto |
| Filtrar tipo, cuenta, categoría y miembro | ☐ | ☐ | Los filtros se pueden combinar y restablecer |
| Filtrar una transferencia por origen/destino | ☐ | ☐ | Aparece al seleccionar cualquiera de sus dos cuentas |
| Editar y eliminar un movimiento | ☐ | ☐ | El otro iPhone recibe la edición y después el tombstone sin resurrección |
| Recuperar los borrados rechazados antes del hotfix | ☐ | ☐ | Al sincronizar ambos, los movimientos ya eliminados desaparecen también del otro iPhone |
| Ajustar saldo desde una cuenta | ☐ | ☐ | Se abre como ajuste, cambia esa cuenta y no cuenta como ingreso/gasto |
| Operar offline, cerrar y reabrir | ☐ | ☐ | Alta/edición/borrado y nota permanecen con su cola |
| Reconectar y sincronizar | ☐ | ☐ | Ambos convergen sin duplicados ni pantalla blanca |
| Texto grande y modo oscuro | ☐ | ☐ | Navegación, filtros, formularios e importes siguen siendo legibles |

Las recurrencias todavía no deben aparecer: pertenecen a Fase 4. No borres datos de Safari durante la prueba. Si falla algo, anota dispositivo/iOS, identidad, operación, red, mensaje y hora aproximada sin compartir claves, tokens ni datos financieros reales.
