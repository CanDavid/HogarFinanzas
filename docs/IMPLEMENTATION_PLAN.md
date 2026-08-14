# Plan de implementación incremental — Hogar Finanzas

Este documento es vivo. Codex debe actualizar estado, decisiones y hallazgos a medida que trabaja.

Regla principal: **una fase cada vez**. No implementar funcionalidades de fases futuras “aprovechando” cambios salvo infraestructura estrictamente necesaria.

Cada fase termina con:

- build funcional;
- tests relevantes verdes;
- demo observable;
- lista de pruebas manuales;
- actualización de este documento.

---

# Fase 0 — Bootstrap del proyecto

## Objetivo

Tener una app vacía pero bien estructurada, compilable y testeable.

## Entregables

- Proyecto Xcode iOS 18+.
- SwiftUI App lifecycle.
- Estructura de carpetas base.
- `AppEnvironment`.
- TabView provisional con las cinco pestañas.
- Test target con Swift Testing.
- UI test target.
- `Logger` base.
- Fixtures/previews mínimos.

## No hacer todavía

- Core Data completo.
- CloudKit Sharing.
- lógica financiera real.

## Tests

- smoke unit test.
- app launches UI test.

## Prueba manual

Abrir app en simulador y cambiar entre las cinco pestañas.

## Criterio de salida

Build y tests verdes sin warnings relevantes.

Estado: [ ] Pendiente

## Estado de ejecución — 2026-08-14

- Bootstrap, targets, pruebas y workflow macOS preparados desde Windows.
- Pendiente conectar el repositorio privado de GitHub y obtener un build/test verde en Actions.
- La prueba manual de esta fase se sustituye, por acuerdo, por el UI test en simulador; no se ha probado todavía en iPhone físico.
- La fase no se marcará como completada hasta recibir el resultado verde del workflow.

---

# Fase 1 — Spike de persistencia + CloudKit Sharing

## Objetivo

Eliminar pronto el mayor riesgo técnico: demostrar que un hogar creado por Apple ID A puede compartirse con Apple ID B y que ambos pueden modificar datos.

## Alcance mínimo

Entidades temporales/primeras versiones:

- Household
- Member
- Transaction mínima

Configurar:

- Core Data;
- `NSPersistentCloudKitContainer`;
- private/shared stores si corresponde;
- CloudKit container;
- `CKSharingSupported`;
- `HouseholdShareService`;
- aceptación de share en app lifecycle.

Crear UI técnica temporal:

- Crear hogar
- Compartir hogar
- Lista de “movimientos demo”
- Añadir movimiento demo
- Indicador de store/origen para debug solo Debug

## Validación obligatoria en dos dispositivos

1. A crea hogar.
2. A invita B.
3. B acepta.
4. B ve el hogar.
5. B crea movimiento.
6. A lo recibe.
7. A crea otro.
8. B lo recibe.

## Offline

Crear un registro sin red y verificar sincronización posterior.

## Decisión al final de fase

Documentar exactamente:

- configuración final de stores;
- cómo se identifica hogar activo;
- cómo se resuelven objetos private/shared;
- comportamiento observado de cambios remotos;
- limitaciones reales encontradas.

## Criterio de salida

No avanzar si sharing bidireccional no funciona de forma reproducible.

Estado: [ ] Pendiente

---

# Fase 2 — Modelo financiero base + cuentas + categorías

## Objetivo

Construir el núcleo de datos definitivo sobre la arquitectura validada.

## Entregables

Entidades:

- Account
- Category
- Transaction completa

Seeds:

- categorías iniciales.

Servicios/repositorios:

- AccountRepository
- CategoryRepository
- TransactionRepository
- FinanceEngine

UI:

- Configuración > Cuentas
- Configuración > Categorías
- Patrimonio simple

## Tests

FinanceEngine completo para:

- income;
- expense;
- transfer;
- adjustment;
- balance;
- net worth;
- liquidity.

Repository tests in-memory.

## Prueba manual

Crear:

- cuenta corriente 5.000 €;
- ahorro 10.000 €;
- gasto 100 €;
- ingreso 2.000 €;
- transferencia 1.000 € a ahorro.

Resultado esperado:

- transferencia no altera patrimonio;
- saldos cuadran exactamente.

Estado: [ ] Pendiente

---

# Fase 3 — Alta y consulta de movimientos

## Objetivo

Conseguir el primer flujo cotidiano completo.

## Entregables UI

### Añadir movimiento

- gasto;
- ingreso;
- transferencia;
- validaciones;
- defaults;
- selección de categoría/cuenta;
- usuario actual;
- fecha;
- notas.

### Movimientos

- lista por día;
- búsqueda;
- filtros básicos;
- detalle;
- editar;
- eliminar.

### Home v1

- patrimonio;
- ingresos del mes;
- gastos del mes;
- resultado real.

## UX objetivo

Registrar gasto típico en pocos segundos.

## Tests

UI tests:

- add expense;
- add income;
- add transfer;
- edit expense;
- delete expense.

## Prueba compartida

B crea un gasto; A lo ve reflejado en Home y Movimientos.

Estado: [ ] Pendiente

---

# Fase 4 — Recurrentes y ocurrencias previstas

## Objetivo

Permitir que la app conozca gastos/ingresos futuros previsibles.

## Entregables

Entidades:

- RecurringRule
- RecurringOccurrence

Motor:

- RecurrenceEngine

UI:

- crear recurrente desde movimiento;
- pantalla Ajustes > Recurrentes;
- lista de próximas ocurrencias;
- activar/desactivar;
- marcar ocurrencia como realizada;
- omitir ocurrencia.

## Casos especiales

- mensual día 31;
- trimestral;
- anual;
- finalización;
- regla desactivada;
- evitar duplicados al abrir app varias veces.

## Tests

Cobertura exhaustiva de RecurrenceEngine.

## Criterio de salida

Generar el mismo mes repetidas veces produce exactamente una ocurrencia por regla/periodo.

Estado: [ ] Pendiente

---

# Fase 5 — Plan mensual y proyección

## Objetivo

Responder a “¿cómo vamos este mes y cuánto nos quedará?”.

## Entregables

Entidades:

- MonthlyPlan
- CategoryBudget
- AllocationItem

Motor:

- ProjectionEngine

UI Plan:

- selector mes;
- ingresos previstos;
- gastos fijos previstos;
- presupuesto variable;
- realizado vs pendiente;
- superávit inicial;
- superávit proyectado;
- distribución prevista.

Home v2:

- gastos pendientes;
- disponible estimado;
- distribución.

## Tests obligatorios

- sin movimientos;
- mitad de mes;
- previsto convertido en real;
- variable por debajo/encima del presupuesto;
- ingreso pendiente;
- allocations.

## Prueba manual

Crear un mes con números conocidos y verificar cálculo a mano.

Estado: [ ] Pendiente

---

# Fase 6 — Objetivos

## Objetivo

Permitir reservar virtualmente dinero para metas sin alterar el patrimonio.

## Entregables

Entidades:

- Goal
- GoalContribution

UI:

- lista objetivos;
- crear;
- detalle;
- aportar;
- retirar;
- completar;
- archivar.

Integración Plan:

- allocation tipo goal.

Integración Transferencia:

- opcionalmente vincular transferencia a aportación.

## Tests

- progreso;
- retirada;
- 100 % completado;
- no cambia patrimonio;
- no duplicación al vincular transferencia.

Estado: [ ] Pendiente

---

# Fase 7 — Cierre mensual + snapshots

## Objetivo

Crear histórico fiable y proteger meses ya revisados.

## Entregables

Entidades:

- MonthSnapshot
- CategorySnapshot si se confirma necesidad.

UI:

- resumen previo al cierre;
- gestión de pendientes;
- cerrar;
- estado cerrado;
- reabrir;
- recerrar.

Reglas:

- un movimiento de mes cerrado no se edita directamente;
- snapshots no se duplican;
- recierre actualiza de forma consistente.

Home:

- variación desde cierre anterior.

## Tests

- snapshot;
- lock;
- reopen;
- recierre;
- cambio de nombre de categoría no rompe histórico.

Estado: [ ] Pendiente

---

# Fase 8 — Análisis

## Objetivo

Convertir histórico en información útil.

## Entregables

AnalyticsEngine.

UI:

- gasto mensual;
- gasto por categoría;
- presupuesto vs real;
- evolución patrimonio;
- ahorro acumulado;
- insights por reglas.

Swift Charts.

## Reglas

- no sobrecargar con gráficos;
- cada gráfico tiene resumen textual accesible;
- datos largos se basan preferentemente en snapshots.

## Tests

- agregaciones;
- variaciones;
- porcentajes con divisor cero;
- periodos sin datos.

Estado: [ ] Pendiente

---

# Fase 9 — Pulido del onboarding y experiencia compartida

## Objetivo

Convertir el spike técnico en onboarding final para usuarios reales.

## Entregables

- primera apertura;
- crear hogar;
- crear perfil;
- cuentas iniciales;
- invitar pareja;
- aceptar invitación;
- estados iCloud;
- gestión de miembros;
- gestión de sharing desde Settings;
- empty states.

Eliminar UI/debug del spike.

## Pruebas

- usuario nuevo propietario;
- usuario nuevo invitado;
- invitación cancelada;
- share revocado;
- iCloud no disponible;
- reinstall razonable sin corrupción.

Estado: [ ] Pendiente

---

# Fase 10 — Robustez, accesibilidad y offline

## Objetivo

Asegurar uso cotidiano fiable.

## Áreas

- sincronización tras periodos offline;
- cambios simultáneos;
- errores recuperables;
- loading/empty/error states;
- Dynamic Type;
- VoiceOver;
- modo oscuro;
- rendimiento con años de datos;
- logs;
- eliminación de warnings.

## Dataset de carga

Generar fixture de test con al menos:

- 5 años;
- 10.000 movimientos;
- múltiples recurrentes;
- snapshots mensuales.

Validar que Inicio, Movimientos y Análisis siguen siendo fluidos.

Estado: [ ] Pendiente

---

# Fase 11 — Preparación TestFlight

## Objetivo

Instalar una build real en los dos iPhone y usarla en casa.

## Checklist

- icono provisional/final;
- nombre de app;
- bundle ID definitivo;
- signing;
- CloudKit container definitivo;
- schema de producción desplegado;
- textos de privacidad;
- Release sin fixtures/debug;
- crash-free smoke test;
- TestFlight build;
- instalar en ambos dispositivos;
- repetir sharing desde cero en entorno previsto.

## Periodo de validación doméstica

Durante el uso real registrar issues en cuatro grupos:

1. fricción para registrar movimientos;
2. números que no resultan intuitivos;
3. información que se echa de menos;
4. funciones que sobran.

No iniciar integraciones bancarias/IA/widgets hasta haber validado este uso real.

Estado: [ ] Pendiente

---

# Backlog posterior al MVP

Prioridad a decidir tras uso real:

- App Intents / Siri.
- Widget.
- Face ID/app lock.
- Exportación CSV/PDF.
- Importación CSV.
- Adjuntar foto de ticket.
- OCR.
- Valores de inversión automáticos.
- Integración bancaria/Open Banking.
- iPad.
- Mac.
- Apple Watch.
- Notificaciones inteligentes.
- Insights con IA.
- Multi-hogar.
- Multi-divisa.

---

# Registro de decisiones

Codex debe añadir entradas con fecha cuando una decisión técnica cambie el plan.

Formato:

```text
YYYY-MM-DD — Decisión
Contexto:
Decisión:
Consecuencias:
```

## Decisiones iniciales

### 2026-08-14 — Persistencia compartida

Contexto: el producto exige dos Apple ID diferentes.

Decisión: SwiftUI + Core Data + NSPersistentCloudKitContainer + CloudKit Sharing; no usar SwiftData como mecanismo principal del MVP compartido.

Consecuencias: algo más de infraestructura inicial, pero sharing y almacenamiento offline quedan alineados con el requisito principal.

### 2026-08-14 — Dinero en céntimos

Decisión: todos los importes persistidos usan Int64 en céntimos.

Consecuencias: cálculos exactos y deterministas; formateo decimal solo en bordes de UI.

### 2026-08-14 — Transferencia como un objeto

Decisión: una transferencia es un único Transaction con sourceAccount y destinationAccount.

Consecuencias: evita duplicar movimientos y reduce riesgo de inconsistencias de sincronización.

### 2026-08-14 — Objetivos virtuales

Decisión: aportaciones a objetivos no modifican patrimonio salvo que exista además una transferencia real.

Consecuencias: no se duplica dinero contablemente.

### 2026-08-14 — Desarrollo desde Windows

Contexto: el equipo de trabajo actual no dispone localmente de Xcode ni del SDK de iOS.

Decisión: mantener un proyecto Xcode versionado con grupos sincronizados y usar GitHub Actions sobre macOS 15, Xcode 16.4 y simulador iOS 18.5 como autoridad de build y tests.

Consecuencias: el código puede prepararse desde Windows, pero ninguna fase se cerrará sin validación real en macOS; la Fase 0 usa el UI test de CI en lugar de prueba manual.

### 2026-08-14 — Identidad inicial de la app

Contexto: CloudKit de la Fase 1 necesita una identidad estable.

Decisión: usar `com.david.HogarFinanzas` como bundle identifier definitivo y iOS 18.0 como deployment target mínimo.

Consecuencias: se evita renombrar la aplicación al configurar capacidades, pero la disponibilidad del identificador deberá verificarse al contratar Apple Developer Program.

### 2026-08-14 — Distribución y CloudKit pendientes de membresía

Contexto: todavía no hay una membresía activa de Apple Developer Program.

Decisión: la Fase 0 se valida sin firma en simulador y no se inicia la Fase 1 hasta disponer de la membresía y poder configurar iCloud.

Consecuencias: la ausencia de membresía no bloquea el bootstrap, pero sí el spike obligatorio de CloudKit Sharing y la instalación mediante TestFlight.
