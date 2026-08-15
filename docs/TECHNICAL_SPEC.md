# Especificación técnica — Hogar Finanzas PWA

## 1. Objetivo y restricciones

PWA mobile-first para un único hogar formado por David y Esther. Debe funcionar primero contra almacenamiento local, sincronizar cuando exista red y mantener un coste obligatorio de operación de 0 €.

- Desarrollo desde Windows con React, TypeScript y Vite.
- IndexedDB local; Google Apps Script Web App y Google Sheets compartidos.
- GitHub Pages y GitHub Actions solo sobre Linux.
- Sin Swift, Xcode, Core Data, CloudKit, macOS runners ni Apple Developer.
- Sin datos financieros ni secretos en Git, logs o parámetros URL.

La decisión se desarrolla en `ADR-001-ZERO-COST-PWA.md`.

## 2. Capas

```text
React UI
   ├── Domain (tipos, dinero y cálculos puros)
   ├── LocalFinanceRepository ── IndexedDB
   └── SyncEngine ── AppsScriptClient
                         └── Apps Script + LockService ── Sheets
```

La UI siempre lee IndexedDB y escribe localmente antes de intentar red. El dominio no importa React, IndexedDB ni Google. Repositorio y transporte son sustituibles en tests.

## 3. Modelo hasta Fase 5

```ts
type UserId = 'david' | 'esther'
type TransactionKind = 'income' | 'expense' | 'transfer' | 'adjustment'

interface Transaction {
  id: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: UserId
  version: number
  changeSequence: number
  kind: TransactionKind
  amountCents: number
  concept: string
  note: string
  date: string
  accountId: string | null
  categoryId: string | null
  sourceAccountId: string | null
  destinationAccountId: string | null
  recurringRuleId: string | null
  recurringOccurrenceDate: string | null
  plannedItemId: string | null
}

interface RecurringRule {
  // metadatos SyncableRecord
  kind: 'income' | 'expense'
  amountCents: number
  concept: string
  note: string
  accountId: string
  categoryId: string
  frequency: 'monthly' | 'quarterly' | 'annual'
  startDate: string
  endDate: string | null
  active: boolean
}

interface Account {
  // metadatos SyncableRecord
  name: string
  type: 'checking' | 'savings' | 'investment' | 'cash'
  initialBalanceCents: number
  includeInNetWorth: boolean
  includeInLiquidity: boolean
  archivedAt: string | null
}

interface Category {
  // metadatos SyncableRecord
  name: string
  kind: 'income' | 'expense'
  icon: string
  archivedAt: string | null
}

interface Budget {
  // metadatos SyncableRecord
  month: string // YYYY-MM
  categoryId: string
  amountCents: number
}

interface PlannedItem {
  // metadatos SyncableRecord
  source: 'manual' | 'recurring'
  recurringRuleId: string | null
  kind: 'income' | 'expense'
  amountCents: number
  concept: string
  note: string
  date: string
  accountId: string
  categoryId: string
  status: 'pending' | 'omitted'
}

interface MonthlyPlan {
  // metadatos SyncableRecord
  month: string
  savingsAllocationCents: number
  investmentAllocationCents: number
}
```

- UUID en cliente; timestamps ISO-8601 UTC; `date` es `YYYY-MM-DD`.
- Dinero como entero seguro positivo en céntimos, validado con `Number.isSafeInteger`.
- `transfer` es un único movimiento con origen/destino; `adjustment` aplica una variación firmada a una cuenta. Ninguno cuenta como ingreso o gasto.
- La eliminación asigna `deletedAt`; no borra la fila compartida.
- Cuentas y categorías con histórico se archivan mediante `archivedAt`; no se eliminan. Reactivar asigna `archivedAt = null` como una actualización sincronizable normal.
- `note` es texto opcional de hasta 500 caracteres. Los movimientos anteriores al esquema 3 se normalizan con nota vacía.
- Una ocurrencia materializada enlaza regla y fecha. Su UUID se deriva determinísticamente de ambas para que dos clientes creen el mismo registro y no dos duplicados.
- Las reglas pausadas conservan su historial y pueden reactivarse. El calendario mensual conserva el día ancla y lo limita al último día válido del mes.
- Un previsto se considera realizado por la existencia de su movimiento enlazado, no por un estado mutable duplicado. Los previstos omitidos no entran en la proyección.
- El presupuesto variable pertenece a un mes y categoría de gasto. La distribución mensual entre ahorro, inversión y sin asignar es una intención y no mueve dinero.

## 4. IndexedDB

Base `hogar-finanzas`, versión 4:

- `transactions`, clave `id`, incluidos tombstones recibidos;
- `accounts` y `categories`, clave `id`, incluidos registros archivados;
- `recurringRules`, clave `id`, incluidas reglas pausadas y tombstones recibidos;
- `budgets`, `plannedItems` y `monthlyPlans`, clave `id`, incluidos tombstones recibidos;
- `outbox`, clave `operationId`, operaciones pendientes y errores;
- `meta`, clave `key`, para cursor, sesión y URL pública.

Movimiento y operación se guardan en una única transacción IndexedDB. Recargar o cerrar la PWA no pierde datos ni cola.

## 5. Sincronización

Cada `SyncOperation` contiene UUID propio, `entityType`, tipo create/update/delete, record ID, snapshot, versión base, intentos y error. La API ofrece:

- `GET`: salud y versión, sin información privada.
- `POST login`: usuario + clave doméstica; devuelve token y expiración.
- `POST bootstrap`: snapshot inicial autenticado.
- `POST sync`: token, cursor y hasta 100 operaciones; devuelve resultados, cambios y cursor.
- Envelope: `{ ok, data?, error? }`.

El POST usa `text/plain;charset=utf-8`, sigue la redirección de ContentService y nunca usa JSONP, `no-cors` ni datos privados en URL.

### Idempotencia y conflictos

- `SyncOperations` conserva cada `operationId` y resultado; un reintento devuelve lo mismo.
- Las ocurrencias recurrentes añaden idempotencia semántica: una segunda alta con el mismo UUID de regla/fecha devuelve el registro canónico ya aceptado.
- Presupuestos por mes/categoría, distribuciones por mes y excepciones recurrentes usan UUID deterministas. Altas simultáneas de ambos iPhone convergen en una sola fila y gana la última aceptada.
- `LockService.getScriptLock()` serializa el lote y contador global.
- Cada mutación aceptada incrementa `version` y `changeSequence`.
- En edición concurrente gana el último cambio aceptado por orden del lock.
- Un tombstone no puede resucitar mediante update; un delete desconocido crea tombstone.
- Error de red conserva la cola. Error permanente deja `lastError` y no se reintenta automáticamente.
- Excepción de recuperación: un borrado previamente rechazado se reactiva antes de sincronizar. El servidor no revalida como alta el contenido de un tombstone y conserva como base el registro canónico compartido.

### Pull incremental

`Meta.changeSequence` es global. Se devuelven filas con secuencia mayor que el cursor. El recorrido lineal de Sheets se acepta para dos usuarios y volumen doméstico; solo se optimizará con evidencia.

Sheets puede convertir tanto `YYYY-MM-DD` como `YYYY-MM` en celdas de fecha. Apps Script normaliza ambos formatos antes de responder y el repositorio local repara registros y operaciones antiguas antes de mostrarlos o reenviarlos.

## 6. Google Sheets y Apps Script

El inicializador idempotente crea todas las hojas. En Fase 5 son funcionales `Meta`, `Users`, `Accounts`, `Categories`, `Transactions`, `RecurringRules`, `Budgets`, `PlannedItems`, `MonthlyPlans` y `SyncOperations`; objetivos y cierres continúan reservados. `migratePhase5` añade el vínculo a previstos y activa las tres hojas del plan sin modificar filas existentes.

Apps Script revalida identidad, UUIDs, fechas, concepto e importe. Las operaciones están protegidas por Script Lock.

## 7. Autenticación y privacidad

- Web App ejecutado como propietario y accesible anónimamente en la capa HTTP.
- Aplicación limitada a `david` y `esther` y clave de mínimo 10 caracteres.
- `initializeProject` genera sal y secreto HMAC; guarda solo el hash de clave.
- Sal, hash, ID de hoja y secreto se guardan en Script Properties.
- Token HMAC con usuario y expiración de 30 días, guardado en IndexedDB.
- La clave solo vive en memoria durante login y viaja por HTTPS.
- Código, esquema y URL son públicos; claves, tokens y datos nunca lo son.

## 8. PWA y UX

- Base/scope/start URL `/HogarFinanzas/`, standalone y orientación vertical.
- Workbox precachea el app shell y proporciona fallback de navegación.
- Actualización avisada antes de recargar; sin dependencia de Background Sync.
- Mobile-first, safe areas, modo oscuro, zoom/tipos dinámicos, etiquetas y mensajes accesibles.
- La barra inferior mantiene cinco áreas. Plan ya es funcional; Objetivos y Análisis siguen como destinos informativos hasta sus fases.
- La búsqueda y los filtros se calculan localmente sobre IndexedDB; no generan consultas remotas. Incluyen periodo, tipo, cuenta, categoría, miembro y carácter recurrente.
- Ajustes → Recurrentes permite crear, editar, pausar/reactivar y materializar próximas ocurrencias.
- Plan permite navegar por mes, gestionar previstos manuales y recurrentes, presupuestos variables y distribución entre ahorro, inversión y remanente. La proyección aplica: ingresos reales + ingresos pendientes − gastos reales − gastos fijos pendientes − presupuesto variable restante. No duplica movimientos ya realizados. La tarjeta principal muestra la ecuación con sus cinco importes y el resumen distingue ingresos pendientes, gastos reales totales y presupuesto variable pendiente de gastar.

## 9. Build y CI

Autoridad local/CI:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

`ci.yml` usa `ubuntu-latest`. `pages.yml` construye y despliega `dist` desde `main` o manualmente. `VITE_APPS_SCRIPT_URL` es una URL pública, no un secreto, y también puede configurarse en la UI.

## 10. Pruebas y aceptación

Automatización: céntimos; saldos, patrimonio, liquidez, transferencias y ajustes; archivado/reactivación; búsqueda, filtros y agrupación; notas; calendarios recurrentes; proyección mensual, presupuestos, omisiones y materialización de previstos; UUID e idempotencia local/remota; navegación accesible; tombstones; persistencia y cola por entidad; cursor y sesión; router Apps Script; manifest/service worker.

Aceptación real obligatoria:

1. GET y login desde Windows contra el Web App.
2. Pages en Safari e instalación en ambos iPhone.
3. CRUD bidireccional David/Esther.
4. Cambios offline, cierre/reapertura y reconexión sin duplicados.
5. Edición concurrente y tombstone sin resurrección.

Si Chromium o Safari no pueden leer la respuesta redirigida por política CORS, Fase 1 queda bloqueada. HTMLService exige una decisión nueva.

## 11. Fases futuras

1. Fase 6: objetivos y patrimonio.
2. Fase 7: cierres mensuales.
3. Fase 8: análisis.
4. Fase 9: robustez, accesibilidad, exportación y copias.

No se anticipan capacidades futuras.
