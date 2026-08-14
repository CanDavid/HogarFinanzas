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

## 3. Modelo de Fase 1

```ts
type UserId = 'david' | 'esther'
type TransactionKind = 'income' | 'expense' | 'transfer'

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
  date: string
}
```

- UUID en cliente; timestamps ISO-8601 UTC; `date` es `YYYY-MM-DD`.
- Dinero como entero seguro positivo en céntimos, validado con `Number.isSafeInteger`.
- `transfer` queda reservado y probado, pero no se crea en UI hasta existir cuentas.
- La eliminación asigna `deletedAt`; no borra la fila compartida.

## 4. IndexedDB

Base `hogar-finanzas`, versión 1:

- `transactions`, clave `id`, incluidos tombstones recibidos;
- `outbox`, clave `operationId`, operaciones pendientes y errores;
- `meta`, clave `key`, para cursor, sesión y URL pública.

Movimiento y operación se guardan en una única transacción IndexedDB. Recargar o cerrar la PWA no pierde datos ni cola.

## 5. Sincronización

Cada `SyncOperation` contiene UUID propio, tipo create/update/delete, record ID, snapshot, versión base, intentos y error. La API ofrece:

- `GET`: salud y versión, sin información privada.
- `POST login`: usuario + clave doméstica; devuelve token y expiración.
- `POST bootstrap`: snapshot inicial autenticado.
- `POST sync`: token, cursor y hasta 100 operaciones; devuelve resultados, cambios y cursor.
- Envelope: `{ ok, data?, error? }`.

El POST usa `text/plain;charset=utf-8`, sigue la redirección de ContentService y nunca usa JSONP, `no-cors` ni datos privados en URL.

### Idempotencia y conflictos

- `SyncOperations` conserva cada `operationId` y resultado; un reintento devuelve lo mismo.
- `LockService.getScriptLock()` serializa el lote y contador global.
- Cada mutación aceptada incrementa `version` y `changeSequence`.
- En edición concurrente gana el último cambio aceptado por orden del lock.
- Un tombstone no puede resucitar mediante update; un delete desconocido crea tombstone.
- Error de red conserva la cola. Error permanente deja `lastError` y no se reintenta automáticamente.

### Pull incremental

`Meta.changeSequence` es global. Se devuelven filas con secuencia mayor que el cursor. El recorrido lineal de Sheets se acepta para dos usuarios y volumen doméstico; solo se optimizará con evidencia.

## 6. Google Sheets y Apps Script

El inicializador idempotente crea `Meta`, `Users`, `Transactions` y `SyncOperations`, funcionales ahora, y reserva `Accounts`, `Categories`, `RecurringRules`, `Budgets`, `Goals`, `GoalAllocations` y `MonthlyClosures` sin implementar sus reglas.

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
- La Fase 1 muestra login, resumen, CRUD y sync. El resto de navegación es futuro.

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

Automatización: céntimos; transferencias; tombstones; persistencia y cola; resultados/fallos; cursor y sesión; formulario accesible; router Apps Script; manifest/service worker.

Aceptación real obligatoria:

1. GET y login desde Windows contra el Web App.
2. Pages en Safari e instalación en ambos iPhone.
3. CRUD bidireccional David/Esther.
4. Cambios offline, cierre/reapertura y reconexión sin duplicados.
5. Edición concurrente y tombstone sin resurrección.

Si Chromium o Safari no pueden leer la respuesta redirigida por política CORS, Fase 1 queda bloqueada. HTMLService exige una decisión nueva.

## 11. Fases futuras

1. Fase 2: cuentas, categorías y núcleo financiero.
2. Fase 3: movimientos completos, transferencias y navegación.
3. Fase 4: recurrencias.
4. Fase 5: presupuestos y plan.
5. Fase 6: objetivos y patrimonio.
6. Fase 7: cierres mensuales.
7. Fase 8: análisis.
8. Fase 9: robustez, accesibilidad, exportación y copias.

No se anticipan capacidades futuras.
