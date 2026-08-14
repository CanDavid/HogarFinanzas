# Plan de implementación incremental — Hogar Finanzas

Documento vivo. Se trabaja en una sola fase. Cada checkpoint exige lint, typecheck, tests, build, revisión del diff, instrucciones manuales y actualización del estado.

## Fase 0 — Bootstrap iOS histórico

Estado: **cancelada/sustituida arquitectónicamente — 2026-08-14**.

El scaffold Swift se compiló y probó correctamente, pero no contenía datos ni funcionalidad financiera. ADR-001 lo sustituye por completo; se eliminan sus fuentes, proyecto y workflow para evitar arquitecturas paralelas.

## Fase 1 — PWA compartida y offline

Estado: **completada — 2026-08-14**.

### Resultado esperado

- PWA React/TypeScript instalable desde GitHub Pages.
- CRUD de ingresos/gastos para David y Esther.
- IndexedDB como fuente local y cola durable.
- API Apps Script + Sheets con autenticación, idempotencia, pull incremental, tombstones y lock.
- CI Linux y coste obligatorio 0 €.

### Incluido

- `Transaction` mínimo y regla de transferencia no contable.
- UI española mobile-first para login, resumen, CRUD y estado de sync.
- Persistencia local, cola create/update/delete, sesión y cursor.
- Web App con `login`, `bootstrap`, `sync`, inicializador y esquema.
- Workflows Linux de CI y Pages.
- Tests de dominio, IndexedDB, UI, sincronización y Apps Script.
- Guías Google y iPhone.

### Deliberadamente fuera

- cuentas/categorías funcionales y creación de transferencias;
- recurrencias, presupuestos, objetivos, cierres y análisis;
- puente HTMLService si ContentService resulta incompatible;
- código nativo o servicios de pago.

### Validación externa completada

- Web App `1.0.1-phase1` desplegado y comprobado mediante health check HTTP 200.
- David y Esther instalaron la PWA en sus respectivos iPhone y accedieron con su identidad.
- Matriz completa de `IPHONE_INSTALL.md` confirmada satisfactoria por el usuario: CRUD bidireccional, offline con cierre/reapertura, reconexión sin duplicados, edición concurrente, tombstone, modo claro/oscuro y texto grande.
- El incidente de fecha detectado durante la primera prueba quedó corregido, desplegado y repetido satisfactoriamente.

### Validación automatizada local

- `npm run lint`: verde, sin warnings.
- `npm run typecheck`: verde.
- `npm test`: 7 archivos y 27 tests verdes.
- `npm run build`: verde; manifest y service worker generados, 7 recursos precacheados.
- Revisión visual local a 390 × 844 px en modo oscuro: corregido contraste de etiquetas y comprobada la pantalla de acceso.
- `npm install`: 0 vulnerabilidades notificadas.
- GitHub Actions `PWA CI #2` sobre `b8152fd`: verde en Linux (lint, typecheck, 27 tests y build), sin anotaciones.
- Repositorio público y Pages configurado con origen GitHub Actions.
- `PWA CI #3` y `Deploy GitHub Pages #3` sobre `9e930ae`: verdes.
- PWA accesible en `https://candavid.github.io/HogarFinanzas/`; HTML, manifest y service worker comprobados por HTTPS con respuesta 200.
- Las acciones oficiales usan sus releases Node 24; los avisos de runtime del primer run quedaron eliminados.
- Web App desplegado en Google Apps Script: el health check real respondió HTTP 200 con JSON de servicio y versión tras la redirección de ContentService.
- Spike de transporte superado en el navegador de Windows: la PWA publicó un POST `text/plain`, leyó la respuesta redirigida y mostró el error de credenciales esperado para una clave ficticia. No se usó ni almacenó la clave doméstica real.
- Variable pública de repositorio `VITE_APPS_SCRIPT_URL` configurada en GitHub Actions para incorporar el endpoint al build de Pages; no contiene secretos.
- `PWA CI #4` y `Deploy GitHub Pages #4` sobre `91e3d6e`: verdes. La comprobación HTTPS posterior confirmó que el bundle servido responde 200 e incluye el identificador del despliegue Apps Script configurado.
- Durante la aceptación en iPhone, el primer pull real reveló que Sheets puede convertir `date` en un objeto `Date`; su representación textual provocaba una excepción de formato y pantalla blanca. El hotfix `1.0.1-phase1` normaliza fechas/timestamps en Apps Script, repara fechas ya persistidas en IndexedDB, evita que una fecha inválida derribe la interfaz y activa correctamente las actualizaciones pendientes del service worker. Validación local del hotfix: lint, typecheck y build verdes; 8 archivos y 32 tests verdes. El despliegue y la repetición en los dispositivos fueron satisfactorios.
- `PWA CI #5/#6` y `Deploy GitHub Pages #5/#6`: verdes; el Web App desplegado responde `1.0.1-phase1` y la repetición completa en ambos iPhone fue satisfactoria.

### Criterio de salida

Cumplido el 2026-08-14 tras confirmación expresa de la matriz completa en ambos iPhone.

## Fases siguientes — no iniciadas

- **Fase 2:** cuentas, categorías y núcleo financiero; saldos, patrimonio, transferencias de un solo objeto y ajustes.
- **Fase 3:** movimientos completos, filtros, búsqueda y cinco áreas principales.
- **Fase 4:** reglas recurrentes y ocurrencias idempotentes.
- **Fase 5:** presupuestos y plan mensual.
- **Fase 6:** objetivos virtuales y patrimonio.
- **Fase 7:** cierres, snapshots, reapertura y recierre.
- **Fase 8:** análisis y tendencias accesibles.
- **Fase 9:** robustez, rendimiento, accesibilidad, exportación/importación y copias.

## Registro de decisiones

### 2026-08-14 — Dinero en céntimos

Todos los importes persistidos usan enteros seguros en céntimos. Los decimales solo aparecen en bordes de UI.

### 2026-08-14 — Transferencias y objetivos

Una transferencia será un único movimiento con origen y destino y no cuenta como ingreso/gasto. Las asignaciones a objetivos no modifican patrimonio por sí mismas.

### 2026-08-14 — Sustitución definitiva de arquitectura

Contexto: la arquitectura Apple exigía macOS y costes/credenciales fuera de las restricciones reales.

Decisión: React + TypeScript + Vite PWA, IndexedDB, Apps Script, Sheets, GitHub Pages y CI Linux. Se elimina el scaffold Swift.

Consecuencias: desarrollo desde Windows y coste 0 €, a cambio de motor de sincronización propio y validación temprana de ContentService. Véase ADR-001.

### 2026-08-14 — Repositorio público

Pages gratuito se alojará desde `CanDavid/HogarFinanzas` público. El historial se revisa antes de cambiar visibilidad y ningún secreto se versiona.

### 2026-08-14 — Conflictos y borrado

Las mutaciones se ordenan con Script Lock; gana la última aceptada. Tombstones tienen precedencia y no se resucitan mediante updates obsoletos.

### 2026-08-14 — Validación de transporte

Se usa POST simple `text/plain`. JSONP y `no-cors` quedan prohibidos. La prueba real en Windows confirmó que el navegador puede leer la respuesta redirigida de ContentService; queda pendiente repetir la validación y la matriz funcional completa en Safari sobre ambos iPhone.
