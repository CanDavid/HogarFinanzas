# Especificación técnica — Hogar Finanzas

## 1. Objetivo técnico

Construir una app iOS nativa, offline-first y compartida entre dos Apple ID distintos, sin backend propio, con lógica financiera determinista y fácilmente testeable.

La arquitectura debe favorecer:

- rapidez de desarrollo;
- baja dependencia de terceros;
- sincronización segura vía iCloud;
- funcionamiento offline;
- pruebas unitarias de toda la lógica financiera;
- posibilidad de evolucionar el producto sin reescribir el núcleo.

## 2. Stack

### Plataforma

- iOS 18.0 o superior.
- iPhone como dispositivo objetivo del MVP.
- Orientación vertical prioritaria; no bloquear orientación si el sistema no lo requiere.

### Lenguaje y UI

- Swift.
- SwiftUI.
- Observation (`@Observable`) para estado de presentación cuando resulte apropiado.
- Swift Charts para gráficos.
- Foundation `FormatStyle` para moneda/fechas.

### Persistencia y sincronización

- Core Data como almacenamiento local persistente.
- `NSPersistentCloudKitContainer` para sincronización con CloudKit.
- Un store privado y un store compartido cuando la configuración de sharing lo requiera.
- CloudKit Sharing para compartir el hogar entre dos cuentas de iCloud.
- El objeto raíz compartido es `Household`.

### Testing

- Swift Testing para lógica unitaria e integración local.
- XCTest/XCUITest para pruebas de interfaz.
- Pruebas manuales de CloudKit Sharing con dos dispositivos físicos y dos Apple ID distintos antes de considerar terminada la sincronización.

### Dependencias

MVP: solo frameworks Apple salvo justificación explícita aprobada.

No añadir paquetes externos para:

- navegación;
- DI;
- persistencia;
- gráficos;
- fechas;
- networking.

## 3. Razón de la arquitectura de datos

La sincronización automática de SwiftData es adecuada para sincronizar datos entre dispositivos de una misma persona, pero el requisito principal del proyecto es colaborar entre dos usuarios de iCloud diferentes. Para ese caso se utilizará CloudKit Sharing apoyado por Core Data/`NSPersistentCloudKitContainer`.

La interfaz seguirá siendo 100 % SwiftUI. Core Data queda encapsulado detrás de repositorios/servicios para que la UI no dependa de detalles de persistencia.

## 4. Arquitectura lógica

Estructura recomendada:

```text
HogarFinanzas/
├── App/
│   ├── HogarFinanzasApp.swift
│   ├── AppEnvironment.swift
│   └── AppRouter.swift
├── Domain/
│   ├── Models/
│   ├── Finance/
│   │   ├── FinanceEngine.swift
│   │   ├── ProjectionEngine.swift
│   │   ├── RecurrenceEngine.swift
│   │   └── AnalyticsEngine.swift
│   └── Repositories/
├── Data/
│   ├── Persistence/
│   │   ├── PersistenceController.swift
│   │   ├── CoreDataModel/
│   │   └── Mappers/
│   ├── Repositories/
│   └── CloudKit/
│       ├── HouseholdShareService.swift
│       ├── CloudAccountService.swift
│       └── SyncStatusService.swift
├── Features/
│   ├── Onboarding/
│   ├── Home/
│   ├── Transactions/
│   ├── MonthlyPlan/
│   ├── NetWorth/
│   ├── Goals/
│   ├── Analytics/
│   └── Settings/
├── DesignSystem/
│   ├── Components/
│   ├── Formatting/
│   └── Accessibility/
└── Resources/
```

Tests:

```text
HogarFinanzasTests/
├── FinanceEngineTests.swift
├── ProjectionEngineTests.swift
├── RecurrenceEngineTests.swift
├── AnalyticsEngineTests.swift
├── RepositoryTests.swift
└── Fixtures/

HogarFinanzasUITests/
├── OnboardingUITests.swift
├── AddTransactionUITests.swift
├── MonthlyPlanUITests.swift
└── GoalsUITests.swift
```

## 5. Patrón de capas

### Domain

Contiene reglas puras y modelos de dominio no ligados a SwiftUI/Core Data.

No debe importar SwiftUI ni CloudKit.

### Data

Responsable de:

- Core Data;
- CloudKit;
- sharing;
- mapeo entre entidades persistentes y dominio;
- consultas y guardado.

### Features

Cada funcionalidad contiene:

- View;
- ViewModel/Model de presentación;
- componentes específicos;
- navegación local.

Los ViewModels dependen de protocolos de repositorio/servicio, no de `NSManagedObjectContext` directamente.

### App

Configura dependencias y navegación global.

## 6. Concurrencia

- UI y estado observable: `@MainActor`.
- Lecturas/escrituras pesadas de Core Data: contextos apropiados en background.
- Servicios CloudKit: `async/await` cuando la API lo permita.
- Evitar bloquear el hilo principal durante sincronizaciones.
- Las operaciones de cálculo de métricas pueden ejecutarse fuera de main si el volumen lo justifica, devolviendo modelos inmutables a UI.

## 7. Modelo monetario

### Regla obligatoria

Nunca usar `Double` para almacenar dinero.

Usar:

```swift
typealias MoneyCents = Int64
```

Todos los importes persistidos son enteros en céntimos.

Ejemplo:

- 12,34 € → `1234`
- 1.000,00 € → `100000`

El formateo a EUR se realiza en UI.

Conversión desde texto decimal debe usar `Decimal`/`NumberFormatter` o `FormatStyle`, redondeando explícitamente a 2 decimales antes de convertir a céntimos.

## 8. Modelo de dominio

Todas las entidades principales tienen:

- `id: UUID`
- `createdAt: Date`
- `updatedAt: Date`

No depender de IDs autoincrementales.

### 8.1 Household

Campos:

- id
- name
- currencyCode (`EUR` v1)
- localeIdentifier (`es_ES` por defecto)
- createdAt
- updatedAt

Relaciones:

- members
- accounts
- categories
- transactions
- recurringRules
- recurringOccurrences
- monthlyPlans
- goals
- monthSnapshots

Es el root object del share.

### 8.2 Member

Campos:

- id
- displayName
- role: `owner | member`
- joinedAt
- isActive

Relación: household.

La asociación entre instalación/dispositivo y `Member.id` se guarda localmente para saber qué usuario está registrando movimientos.

### 8.3 Account

Campos:

- id
- name
- type: `checking | savings | investment | cash`
- openingBalanceCents: Int64
- includeInNetWorth: Bool
- includeInLiquidity: Bool
- sortOrder: Int16
- isArchived: Bool
- createdAt
- updatedAt

Relación: household.

El saldo no se persiste como verdad principal; se calcula a partir de saldo inicial + movimientos + ajustes.

### 8.4 Category

Campos:

- id
- name
- kind: `expense | income`
- systemImageName
- sortOrder
- isArchived
- isSystemSeed
- createdAt
- updatedAt

Relación: household.

No borrar categorías con histórico.

### 8.5 Transaction

Campos:

- id
- kind: `expense | income | transfer | balanceAdjustment`
- amountCents: Int64, siempre positivo
- date
- concept
- note opcional
- createdAt
- updatedAt

Relaciones:

- household
- category opcional
- createdByMember
- sourceAccount opcional
- destinationAccount opcional
- recurringOccurrence opcional
- goalContributions opcionales

Reglas:

#### Expense

- sourceAccount requerido
- category expense requerida
- destinationAccount nil

#### Income

- destinationAccount requerido
- category income requerida
- sourceAccount nil

#### Transfer

- sourceAccount y destinationAccount requeridos
- category nil
- source != destination

#### BalanceAdjustment

Representa diferencia firmada mediante un campo adicional:

- `adjustmentDirection: increase | decrease`

Alternativa permitida: almacenar `signedAmountCents` solo para este tipo. Elegir una estrategia y cubrirla con tests; no mezclar convenciones.

### 8.6 RecurringRule

Campos:

- id
- kind: `expense | income`
- concept
- amountCents
- frequency: `monthly | quarterly | yearly`
- interval: Int16 (por defecto 1)
- startDate
- endDate opcional
- nextGenerationAnchor / day component necesario para calcular ocurrencias
- isActive
- createdAt
- updatedAt

Relaciones:

- household
- category
- account

### 8.7 RecurringOccurrence

Campos:

- id
- scheduledDate
- expectedAmountCents
- status: `planned | completed | skipped`
- createdAt
- updatedAt

Relaciones:

- household
- rule
- actualTransaction opcional

Restricción lógica:

Una combinación rule + scheduled period no debe producir dos ocurrencias.

La idempotencia se consigue generando un UUID estable o una clave lógica determinista a nivel de servicio, no confiando en constraints de base de datos que puedan complicar CloudKit.

### 8.8 MonthlyPlan

Campos:

- id
- year: Int16
- month: Int16
- status: `open | closed`
- createdAt
- updatedAt
- closedAt opcional

Relaciones:

- household
- categoryBudgets
- allocationItems

No guardar totales derivados que puedan recalcularse salvo snapshot de cierre.

### 8.9 CategoryBudget

Campos:

- id
- amountCents

Relaciones:

- monthlyPlan
- category expense

Solo debe aplicarse a gasto variable planificado.

### 8.10 AllocationItem

Representa intención de distribuir superávit.

Campos:

- id
- kind: `savings | investment | goal | unallocated`
- amountCents

Relaciones:

- monthlyPlan
- goal opcional

No afecta a saldos.

### 8.11 Goal

Campos:

- id
- name
- targetAmountCents
- targetDate opcional
- systemImageName
- note opcional
- status: `active | completed | archived`
- createdAt
- updatedAt

Relación: household.

### 8.12 GoalContribution

Campos:

- id
- amountCents con signo lógico mediante direction `add | remove`
- date
- note opcional
- createdAt

Relaciones:

- goal
- sourceTransaction opcional
- createdByMember

No modifica patrimonio.

### 8.13 MonthSnapshot

Se crea al cerrar el mes.

Campos:

- id
- year
- month
- realIncomeCents
- realExpenseCents
- resultCents
- netWorthCents
- liquidBalanceCents
- projectedSurplusAtCloseCents opcional
- savingsRateBasisPoints opcional
- closedAt

Puede incluir un JSON/Data con desglose por categoría si se quiere preservar exactamente el estado histórico; preferencia v1: entidad relacionada `CategorySnapshot` si se necesita consultar fácilmente.

### 8.14 CategorySnapshot opcional recomendado

- categoryID lógico
- categoryNameAtClose
- expenseCents
- budgetCents opcional

Relación: MonthSnapshot.

Esto mantiene histórico incluso si una categoría cambia de nombre después.

## 9. Repositorios

Definir protocolos de dominio:

```swift
protocol TransactionRepository { ... }
protocol AccountRepository { ... }
protocol CategoryRepository { ... }
protocol MonthlyPlanRepository { ... }
protocol RecurrenceRepository { ... }
protocol GoalRepository { ... }
protocol HouseholdRepository { ... }
```

Operaciones mínimas:

### TransactionRepository

- fetch(period/filter)
- create
- update
- delete
- totalsByCategory

### AccountRepository

- fetchActive
- fetchAll
- create/update/archive
- calculateBalance

### MonthlyPlanRepository

- fetchOrCreate(year, month)
- saveBudgets
- saveAllocations
- close
- reopen

La implementación Core Data vive en `Data/Repositories`.

## 10. Motores de negocio puros

## 10.1 FinanceEngine

Funciones:

- signed effect of transaction on account;
- account balance;
- net worth;
- liquidity;
- real monthly income;
- real monthly expense;
- monthly result;
- savings rate.

Debe ser 100 % testeable sin Core Data.

## 10.2 RecurrenceEngine

Responsabilidades:

- calcular fechas de ocurrencia;
- generar ocurrencias para un rango;
- evitar duplicados;
- soportar mensual/trimestral/anual;
- resolver meses cortos.

Regla para día 29/30/31:

Si la recurrencia cae en un día inexistente del mes, usar el último día válido de ese mes.

Ejemplo: recurrencia día 31 → 28/29 de febrero.

## 10.3 ProjectionEngine

Inputs:

- movimientos reales del mes;
- ocurrencias previstas pendientes;
- ingresos previstos pendientes;
- presupuestos variables;
- allocations.

Outputs:

```swift
struct MonthlyProjection {
    let realIncomeCents: Int64
    let pendingIncomeCents: Int64
    let realExpenseCents: Int64
    let pendingFixedExpenseCents: Int64
    let remainingVariableBudgetCents: Int64
    let projectedSurplusCents: Int64
    let plannedAllocationsCents: Int64
    let projectedUnallocatedCents: Int64
}
```

Fórmula principal:

`projectedSurplus = realIncome + pendingIncome - realExpense - pendingFixed - remainingVariableBudget`

`projectedUnallocated = projectedSurplus - plannedAllocations`

No duplicar ocurrencias ya completadas.

## 10.4 AnalyticsEngine

Funciones:

- series mensual de gasto;
- series de patrimonio desde snapshots;
- gasto por categoría;
- presupuesto vs real;
- variación absoluta y porcentual;
- insights basados en reglas.

No usar IA en v1.

## 11. Persistencia Core Data + CloudKit

## 11.1 Stores

`PersistenceController` debe configurar `NSPersistentCloudKitContainer`.

La solución debe contemplar:

- store privado del usuario propietario;
- store compartido para objetos aceptados mediante CloudKit Sharing;
- `automaticallyMergesChangesFromParent = true` donde corresponda;
- persistent history tracking si es necesario para detectar cambios remotos y actualizar UI;
- remote change notifications.

No exponer `NSManagedObject` fuera de Data si puede evitarse.

## 11.2 Compartición del Household

Flujo propietario:

1. Crear `Household` y datos hijos en el store privado.
2. Crear un share con `Household` como root.
3. Permitir read/write al participante.
4. Presentar interfaz estándar de sharing.

Flujo participante:

1. Recibir invitación.
2. App acepta el share.
3. Persistir contenido en shared store.
4. Resolver `Household` activo.
5. Crear/asociar `Member` si procede.

Configurar `CKSharingSupported = YES` en Info.plist.

## 11.3 Relación de objetos compartidos

Los objetos del hogar deben quedar asociados al mismo árbol/zona de compartición para que el miembro invitado vea:

- cuentas;
- categorías;
- movimientos;
- recurrentes;
- planes;
- objetivos;
- snapshots.

Antes de desarrollar todas las entidades se exige un spike técnico con `Household` + `Transaction` para demostrar que alta, invitación, escritura del invitado y sincronización bidireccional funcionan.

## 11.4 Offline-first

La UI siempre lee primero del store local.

Al guardar:

1. validar dominio;
2. persistir localmente;
3. dejar que CloudKit sincronice;
4. reflejar estado de sincronización sin bloquear el flujo.

Si CloudKit falla temporalmente:

- no perder el dato local;
- mostrar estado discreto;
- reintentar mediante mecanismos del stack y/o servicio de sync;
- evitar mensajes alarmistas por retrasos normales.

## 11.5 Estado de iCloud

Servicio:

```swift
protocol CloudAccountService {
    func accountStatus() async -> CloudAccountStatus
}
```

Estados de UI:

- disponible;
- sin sesión;
- restringido;
- temporalmente no disponible;
- desconocido.

## 11.6 Conflictos

Reglas:

- UUID en cliente para identidad estable.
- `updatedAt` en entidades editables.
- Evitar operaciones que generen duplicados mediante funciones idempotentes.
- Transferencia = un único objeto `Transaction`, nunca dos movimientos independientes; así no puede sincronizarse solo “una mitad”.
- Ocurrencia recurrente enlazada a un único movimiento real.

Para conflicto de edición sobre el mismo objeto:

- aceptar la semántica de merge de Core Data/CloudKit;
- definir merge policy explícita en contextos;
- registrar tests para que un cambio remoto no cree duplicados ni rompa relaciones.

No desarrollar un sistema de versionado manual en v1 salvo que el spike detecte necesidad real.

## 12. Sincronización y refresco de UI

La app debe reaccionar a cambios remotos y actualizar vistas sin necesitar relanzar.

Requisitos:

- observar cambios del store;
- refrescar ViewModels/queries afectadas;
- recalcular dashboard, plan y objetivos al recibir cambios;
- mostrar “Sincronizado”/“Pendiente” solo en Settings o en un indicador discreto si hay problema.

No mostrar spinner global durante sincronización normal.

## 13. Navegación SwiftUI

- `TabView` para 5 secciones principales.
- `NavigationStack` independiente por pestaña cuando sea necesario.
- Presentación modal/sheet para Add Transaction.
- `NavigationDestination` tipado o router ligero.

Evitar una mega-enumeración difícil de mantener. Cada feature puede definir destinos locales y el AppRouter manejar solo navegación transversal.

## 14. Estado de presentación

ViewModels `@MainActor` y `@Observable`.

Ejemplo conceptual:

```swift
@MainActor
@Observable
final class HomeViewModel {
    var state: HomeState = .loading
    ...
}
```

Estados explícitos:

- loading;
- content;
- empty;
- recoverableError.

No usar `fatalError` para estados de datos esperables.

## 15. Componentes de diseño reutilizables

Crear solo si se repiten realmente:

- `MetricCard`
- `MoneyText`
- `ProgressCard`
- `BudgetProgressRow`
- `EmptyStateView`
- `SyncStatusBadge`
- `TransactionRow`
- `SectionCard`

No crear un design system excesivamente abstracto al inicio.

## 16. Formato y localización

Código y nombres técnicos: inglés.

Textos de UI MVP: español.

Centralizar strings para permitir localización futura.

Moneda:

- `EUR`.
- locale del usuario para visualización.
- guardar moneda del household aunque sea única en v1.

Fechas:

- calendario gregoriano;
- el “mes financiero” v1 coincide con mes natural.

## 17. Accesibilidad

Obligatorio:

- Dynamic Type;
- labels accesibles en iconos;
- VoiceOver en gráficos con resumen textual;
- targets táctiles adecuados;
- no depender únicamente del color;
- contraste del sistema;
- contenido adaptable a tamaños grandes.

## 18. Privacidad y seguridad

- Sin backend propio.
- Sin SDK analítico de terceros en MVP.
- Sin publicidad.
- Sin guardar credenciales bancarias.
- CloudKit para datos compartidos.
- No registrar importes/conceptos sensibles en logs de producción.
- Usar `Logger` con privacy apropiada.

Face ID/App Lock se deja fuera del MVP inicial salvo que se añada como fase posterior.

## 19. Logging

Usar `os.Logger` por subsistemas:

- persistence
- cloudkit
- sharing
- finance
- ui

Nunca hacer `print` permanente en producción.

Logs deben registrar IDs técnicos cuando sea útil, no conceptos/importes completos salvo debugging local controlado.

## 20. Errores

Definir errores de dominio y presentables.

Ejemplos:

```swift
enum FinanceValidationError: Error {
    case amountMustBePositive
    case missingAccount
    case missingCategory
    case sameTransferAccount
    case monthClosed
}
```

CloudKit errors se traducen a mensajes comprensibles y acciones:

- Reintentar
- Revisar iCloud
- Gestionar compartición

## 21. Rendimiento

Volumen esperado doméstico bajo/moderado, pero diseñar para años de datos.

Pautas:

- fetch por periodo, no cargar todos los movimientos siempre;
- índices Core Data en fecha, household ID y campos de filtro relevantes cuando proceda;
- agregaciones en repositorio/motor;
- gráficos basados en snapshots mensuales para series largas;
- no recalcular todo el histórico en cada render.

## 22. Previews y fixtures

Cada pantalla principal debe tener SwiftUI Preview con datos ficticios.

Crear fixtures deterministas:

- household demo;
- 2 members;
- 4 accounts;
- categorías seed;
- movimientos de 3 meses;
- recurrentes;
- plan mensual;
- 2 objetivos.

Nunca mezclar fixtures con datos reales de producción.

## 23. Testing detallado

### 23.1 Swift Testing — obligatorio

FinanceEngine:

- ingreso aumenta cuenta destino;
- gasto reduce cuenta origen;
- transferencia reduce origen y aumenta destino sin cambiar patrimonio;
- ajuste aumenta/disminuye correctamente;
- patrimonio excluye cuentas marcadas;
- liquidez solo incluye cuentas marcadas.

ProjectionEngine:

- previsto sin movimientos;
- gasto fijo completado deja de contarse como pendiente;
- ingreso recibido deja de contarse como pendiente;
- categoría variable bajo presupuesto;
- categoría por encima de presupuesto → restante 0;
- allocations no cambian superávit, solo unallocated.

RecurrenceEngine:

- mensual normal;
- trimestral;
- anual;
- día 31 en febrero;
- año bisiesto;
- endDate;
- rule inactive;
- idempotencia de generación.

Monthly close:

- snapshot correcto;
- mes queda bloqueado;
- reabrir permite editar;
- cerrar otra vez reemplaza/actualiza snapshot de forma consistente.

Goals:

- aportación aumenta progreso;
- retirada reduce progreso;
- aportación no cambia patrimonio;
- vínculo con transferencia no duplica importe.

### 23.2 Repository integration tests

Usar persistent store in-memory sin CloudKit para lógica de repositorio.

Comprobar:

- CRUD;
- filtros;
- archivado;
- relaciones;
- cascadas/nullify definidas;
- no borrar histórico accidentalmente.

### 23.3 UI tests

Flujos críticos:

1. crear gasto;
2. crear transferencia;
3. filtrar movimientos;
4. configurar presupuesto;
5. marcar recurrente como pagado;
6. crear objetivo y aportar;
7. cerrar mes.

### 23.4 CloudKit manual/integration acceptance

Matriz mínima:

**Dispositivo A / Apple ID A**

- crea hogar;
- invita B.

**Dispositivo B / Apple ID B**

- acepta;
- ve datos existentes;
- crea gasto.

A debe recibir el gasto.

A crea transferencia.

B debe recibirla.

Prueba offline:

- A sin red crea gasto A1;
- B sin red crea gasto B1;
- restaurar red;
- ambos deben terminar viendo A1 + B1 sin duplicados.

Prueba edición simultánea:

- editar mismo concepto en ambos dispositivos;
- comprobar consistencia y ausencia de crash/corrupción.

Prueba invitación revocada:

- propietario deja de compartir;
- validar comportamiento del participante y mensajes de UI.

## 24. Build y calidad

Antes de cerrar cada fase Codex debe:

1. compilar target principal;
2. ejecutar tests unitarios relevantes;
3. ejecutar suite completa cuando sea razonable;
4. corregir warnings nuevos;
5. revisar diff;
6. actualizar `docs/IMPLEMENTATION_PLAN.md`;
7. describir qué probar manualmente.

No avanzar de fase con build roto.

## 25. Convenciones de código

- Tipos: PascalCase.
- Variables/funciones: camelCase.
- Un tipo principal por archivo cuando mejore claridad.
- Evitar archivos > ~400–500 líneas salvo razón clara.
- Preferir composición a herencia.
- Evitar singletons globales; dependencias inyectadas desde AppEnvironment.
- Protocolos solo cuando aporten testabilidad o sustitución real.
- No introducir abstracciones anticipadas.
- Comentarios explican “por qué”, no repiten “qué”.

## 26. Git

Ramas sugeridas:

- `main`: estable.
- `feature/phase-XX-name` si se trabaja con ramas.

Commits pequeños y descriptivos.

Ejemplos:

- `feat: add transaction domain model`
- `feat: implement monthly projection engine`
- `test: cover recurring day 31 behavior`
- `fix: prevent duplicate recurring occurrence`

## 27. Entornos CloudKit

Distinguir desarrollo y producción.

Antes de TestFlight:

- revisar schema CloudKit;
- desplegar schema a producción;
- probar build de distribución con entorno correcto;
- no asumir que schema de desarrollo aparece automáticamente en producción.

## 28. Definición técnica de “hecho” del MVP

El MVP está técnicamente hecho cuando:

- build sin errores;
- tests unitarios e integración local verdes;
- flujos UI críticos pasan;
- sharing bidireccional verificado con dos Apple ID;
- offline + resync verificado;
- no hay duplicados conocidos en recurrentes/transferencias;
- dashboard usa cálculos del dominio, no fórmulas duplicadas en views;
- meses cerrados quedan protegidos;
- accesibilidad básica revisada;
- datos de ejemplo eliminados del build Release;
- schema CloudKit de producción preparado;
- build instalable vía TestFlight.
