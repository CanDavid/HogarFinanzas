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

## Fase 2 — Cuentas, categorías y núcleo financiero

Estado: **completada — 2026-08-15**.

### Alcance cerrado

- Cuentas corriente, ahorro, inversión y efectivo con saldo inicial, inclusión en patrimonio/liquidez, archivado no destructivo y reactivación.
- Categorías separadas para ingresos y gastos, con catálogo inicial, creación/edición, archivado no destructivo y reactivación.
- Movimientos vinculados a cuenta/categoría; transferencia como un único registro con origen y destino; ajuste como variación firmada de una cuenta.
- Motor puro y probado para saldo por cuenta, patrimonio y liquidez. Transferencias y ajustes no alteran ingresos/gastos.
- Persistencia offline y sincronización incremental/idempotente de cuentas, categorías y movimientos, incluida migración compatible de IndexedDB y Sheets.
- UI mínima de gestión y registro necesaria para validar el núcleo. La navegación definitiva, búsqueda, filtros y detalle avanzado quedan en Fase 3.

### Criterio de salida

- Lint, typecheck, tests, build y CI verdes.
- Apps Script actualizado y migración idempotente ejecutada.
- En ambos iPhone: crear/editar/archivar/reactivar cuentas y categorías, registrar ingreso/gasto/transferencia/ajuste offline y online, y comprobar convergencia, saldos y patrimonio sin doble contabilización.

### Validación automatizada

- `npm run lint`: verde, sin warnings.
- `npm run typecheck`: verde.
- `npm test`: 9 archivos y 43 tests verdes, incluida reactivación local sin pérdida de histórico.
- `npm run build`: verde; app shell y service worker generados con 7 recursos precacheados.
- `PWA CI #7` y `Deploy GitHub Pages #7` sobre `6f0634c`: verdes. El bundle HTTPS publicado responde 200 y contiene las áreas de cuentas, categorías y transferencias.
- El usuario confirmó el despliegue/migración y toda la matriz original de Fase 2 como satisfactorios.
- Antes del cierre solicitó reactivar cuentas/categorías archivadas; no estaba asignado a fases futuras y se incorporó como hotfix de esta fase.
- `PWA CI #8` y `Deploy GitHub Pages #8` sobre `c780b56`: verdes. La página y el bundle publicados responden 200 y el bundle contiene la acción `Desarchivar`. Solo queda validar esta ampliación en ambos iPhone.

### Cierre

El usuario autorizó expresamente cerrar el checkpoint y avanzar a Fase 3 el 2026-08-15 tras el hotfix publicado de reactivación.

## Fase 3 — Movimientos completos y navegación

Estado: **hotfix de borrado implementado y desplegado; pendiente de aceptación en ambos iPhone — 2026-08-15**.

### Alcance cerrado

- Barra inferior accesible con Inicio, Movimientos, Plan, Objetivos y Análisis; las tres áreas de fases futuras muestran estados informativos sin datos ficticios.
- Inicio con patrimonio, liquidez, resultado del mes, acceso rápido a movimientos, cuentas y categorías.
- Alta, edición y eliminación lógica de gasto, ingreso y transferencia; nota opcional sincronizable. Ajustes de saldo iniciados desde una cuenta operativa.
- Lista agrupada por día con concepto, contexto de cuenta/categoría, miembro, nota e importe financieramente correcto.
- Búsqueda local por concepto, nota, cuenta y categoría; filtros por periodo, rango personalizado, tipo, cuenta, categoría y miembro.
- Apps Script `3.0.1-phase3` y migración idempotente que añade `note` sin modificar el resto de datos e incluye el hotfix de borrado compartido.

### Deliberadamente fuera

- Recurrencias y su filtro, reservados para Fase 4.
- Presupuestos/proyecciones, objetivos y análisis funcionales, reservados para Fases 5, 6 y 8.
- Reglas de meses cerrados, que se incorporan con cierres en Fase 7.

### Criterio de salida

- Lint, typecheck, tests, build y CI/Pages verdes.
- `migratePhase3` ejecutada y Web App `3.0.1-phase3` desplegado con la misma URL.
- En ambos iPhone: navegación, Inicio, CRUD y notas compartidas, agrupación, búsqueda/filtros, ajuste desde cuenta y convergencia offline sin duplicados.

### Validación automatizada local

- `npm run lint`: verde, sin warnings.
- `npm run typecheck`: verde.
- `npm test`: 11 archivos y 57 tests verdes, incluidas la migración idempotente, el borrado de movimientos históricos y la recuperación de tombstones rechazados.
- `npm run build`: verde; app shell y service worker generados con 7 recursos precacheados.
- `PWA CI #9` y `Deploy GitHub Pages #9` sobre `cb43d4a`: verdes. La página y el bundle responden 200 y contienen la navegación de cinco áreas, búsqueda y estados de fases futuras.
- Hotfix `a0a5a11`: `PWA CI #10` y `Deploy GitHub Pages #10` verdes. La página y el bundle publicados responden 200 y el artefacto contiene la recuperación automática de eliminaciones previamente rechazadas.
- `migratePhase3` ejecutada correctamente y Web App promovido mediante `clasp` a la versión inmutable 4, descripción `version3.0.1-phase3`, conservando la misma URL. El health check público responde HTTP 200 y `3.0.1-phase3`.
- `clasp` queda autorizado localmente y configurado con archivos rastreados explícitos y un comando reproducible de despliegue. La credencial OAuth permanece fuera de Git.
- `clasp 3.3.0` se ejecuta bajo demanda con `npx`, sin entrar en las dependencias ni el bundle; su árbol temporal emite un aviso upstream por `uuid@9`, mientras `npm audit` del proyecto permanece en 0 vulnerabilidades.
- Queda pendiente repetir la convergencia de los borrados y completar la matriz `IPHONE_PHASE3.md` en ambos iPhone.

### Incidente de borrado compartido — 2026-08-15

- Observación real: David y Esther ocultaban localmente movimientos eliminados, pero el otro iPhone seguía viéndolos.
- Causa: Apps Script validaba el payload completo del tombstone como un alta/edición. Los movimientos históricos sin cuenta/categoría —o con referencias archivadas— eran rechazados permanentemente antes de llegar a Sheets.
- Hotfix `3.0.1-phase3`: los deletes validan solo su envoltorio, usan el registro canónico del servidor y respetan idempotencia antes de revalidar el payload. La PWA recupera automáticamente deletes que ya quedaron marcados como permanentes.
- Publicación: commit `a0a5a11`, `PWA CI #10` y `Deploy GitHub Pages #10` verdes; bundle HTTPS verificado con la recuperación incluida.
- Backend: `migratePhase3` completada; implementación pública actualizada a versión 4 y health check `3.0.1-phase3` verificado.
- Pendiente: sincronizar ambos iPhone sin borrar los datos locales de Safari para enviar los tombstones recuperados.

### Incidente de ajustes negativos en iPhone — 2026-08-15

- Observación real: el teclado decimal de iOS no ofrece el carácter `-`, por lo que no se podía reducir el saldo desde el formulario de ajuste.
- Hotfix PWA `3.0.2`: selector explícito `+ Sumar saldo` / `− Restar saldo`; el campo conserva teclado decimal y el signo se aplica en la frontera de UI antes de persistir céntimos enteros.
- Validación local: lint y typecheck verdes, 11 archivos y 58 tests verdes, y build PWA con 7 recursos precacheados.
- Pendiente: CI/Pages y comprobación en ambos iPhone de un ajuste positivo y otro negativo.

## Fases siguientes — no iniciadas

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

Se usa POST simple `text/plain`. JSONP y `no-cors` quedan prohibidos. Windows y Safari en ambos iPhone confirmaron que el navegador puede leer la respuesta redirigida de ContentService.
