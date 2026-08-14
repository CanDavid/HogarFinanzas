# Aceptación en iPhone — Fase 2

Prerrequisitos: PWA actualizada en ambos iPhone, migración `migratePhase2` ejecutada y Web App `2.0.0-phase2` desplegado.

| Caso | David | Esther | Resultado esperado |
|---|---:|---:|---|
| Recibe categorías iniciales | ☐ | ☐ | Catálogo sin duplicados |
| Crear cuenta corriente | ☐ | ☐ | Aparece en ambos tras sincronizar |
| Crear cuenta de ahorro | ☐ | ☐ | Configuración y saldo inicial convergen |
| Editar una cuenta | ☐ | ☐ | Ambos ven el último cambio aceptado |
| Archivar cuenta/categoría | ☐ | ☐ | Se conserva el histórico y deja de ofrecerse para movimientos nuevos |
| Crear gasto/ingreso con cuenta y categoría | ☐ | ☐ | Saldo, ingresos y gastos son correctos |
| Transferir entre cuentas | ☐ | ☐ | Baja origen, sube destino y no cambia patrimonio ni resultado mensual |
| Ajuste positivo y negativo | ☐ | ☐ | Solo cambia el saldo/patrimonio correspondiente |
| Operar sin conexión y reabrir | ☐ | ☐ | Datos y cola persisten |
| Reconectar | ☐ | ☐ | Convergencia sin duplicados |

Antes de probar datos nuevos, sincroniza ambos dispositivos. Para una transferencia usa dos cuentas distintas. No borres datos de Safari durante la prueba.

Si algo falla, anota dispositivo/iOS, identidad, operación, estado de red, mensaje y hora aproximada sin compartir claves, tokens ni datos financieros reales.
