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

Estado: **completada y validada en ambos iPhone — 2026-08-15**.

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
- David y Esther completaron satisfactoriamente la matriz `IPHONE_PHASE3.md`, incluida la convergencia de borrados, el uso offline y la ausencia de duplicados.

### Incidente de borrado compartido — 2026-08-15

- Observación real: David y Esther ocultaban localmente movimientos eliminados, pero el otro iPhone seguía viéndolos.
- Causa: Apps Script validaba el payload completo del tombstone como un alta/edición. Los movimientos históricos sin cuenta/categoría —o con referencias archivadas— eran rechazados permanentemente antes de llegar a Sheets.
- Hotfix `3.0.1-phase3`: los deletes validan solo su envoltorio, usan el registro canónico del servidor y respetan idempotencia antes de revalidar el payload. La PWA recupera automáticamente deletes que ya quedaron marcados como permanentes.
- Publicación: commit `a0a5a11`, `PWA CI #10` y `Deploy GitHub Pages #10` verdes; bundle HTTPS verificado con la recuperación incluida.
- Backend: `migratePhase3` completada; implementación pública actualizada a versión 4 y health check `3.0.1-phase3` verificado.
- Validación real: ambos iPhone enviaron y recibieron correctamente los tombstones recuperados; no fue necesario borrar los datos locales de Safari.

### Incidente de ajustes negativos en iPhone — 2026-08-15

- Observación real: el teclado decimal de iOS no ofrece el carácter `-`, por lo que no se podía reducir el saldo desde el formulario de ajuste.
- Hotfix PWA `3.0.2`: selector explícito `+ Sumar saldo` / `− Restar saldo`; el campo conserva teclado decimal y el signo se aplica en la frontera de UI antes de persistir céntimos enteros.
- Validación local: lint y typecheck verdes, 11 archivos y 58 tests verdes, y build PWA con 7 recursos precacheados.
- Publicación: commit `171d4ca`, `PWA CI #13` y `Deploy GitHub Pages #13` verdes; página y bundle responden 200 y contienen ambos controles de signo.
- Validación real: el selector de suma/resta funcionó correctamente en ambos iPhone.

### Cierre

El usuario confirmó el 2026-08-15 que toda la aceptación de Fase 3, incluidos ambos hotfixes, fue satisfactoria y autorizó avanzar a Fase 4.

## Fase 4 — Reglas recurrentes y ocurrencias idempotentes

Estado: **completada y validada en ambos iPhone — 2026-08-15**.

### Alcance cerrado

- Alta de un movimiento real con la opción `Se repite`; crea de forma atómica el movimiento actual y su regla futura.
- Reglas de ingreso o gasto con importe fijo en céntimos, cuenta, categoría, frecuencia mensual/trimestral/anual, próxima fecha, fin opcional y nota.
- Gestión desde Ajustes → Recurrentes: crear, editar, pausar, reactivar, ver próximas ocurrencias y registrar una ocurrencia.
- Calendario determinista que conserva el día ancla cuando un mes es más corto y respeta la fecha final inclusiva.
- Cada ocurrencia usa un UUID determinista derivado de regla y fecha. Dos iPhone que registren la misma ocurrencia convergen sin crear dos movimientos.
- Los movimientos materializados conservan `recurringRuleId` y `recurringOccurrenceDate`, muestran indicador y admiten filtro recurrente/no recurrente.
- IndexedDB versión 3 con `recurringRules`; reglas, movimientos y cola siguen siendo la fuente local offline.
- Apps Script `4.0.0-phase4`, esquema 4 y `migratePhase4`, con pull incremental de reglas, validación de referencias y aceptación idempotente de ocurrencias repetidas.

### Deliberadamente fuera

- Presupuestos, agregados previstos y proyección de final de mes, reservados para Fase 5.
- Omitir o aplazar una ocurrencia concreta y editar en bloque movimientos ya realizados; requieren decisiones del plan mensual y no forman parte de esta fase.
- Objetivos, cierres y análisis funcionales, reservados para sus fases.

### Criterio de salida

- Lint, typecheck, tests, build y CI/Pages verdes; historial sin secretos.
- `migratePhase4` ejecutada y Web App `4.0.0-phase4` desplegada con la misma URL.
- En ambos iPhone: crear una recurrencia, verla en el otro dispositivo, pausar/reactivar, persistir offline y registrar simultáneamente la misma ocurrencia sin duplicados.
- La matriz reproducible está en `IPHONE_PHASE4.md`. La fase no se cerrará hasta recibir el resultado real del usuario.

### Validación automatizada y despliegue

- `npm run lint`, `npm run typecheck` y `npm run build`: verdes, sin warnings; app shell y service worker generados con 7 recursos precacheados.
- `npm test`: 13 archivos y 68 tests verdes. Incluyen fin de mes, fecha final, UUID determinista, persistencia IndexedDB, alta atómica regla/movimiento, materialización repetida, filtro recurrente, UI y adaptador Apps Script.
- Revisión renderizada a 394 × 852 px: carga correcta, sin desbordamiento y con controles accesibles.
- `migratePhase4` ejecutada correctamente desde el editor autorizado; conserva clave, sesiones y filas y deja `schemaVersion: 4`.
- Apps Script promovido a la versión inmutable 6, descripción `version4.0.0-phase4`, conservando la URL pública. Health check real: HTTP 200 y `4.0.0-phase4`.
- El lanzador `apps-script:deploy` se adaptó a Node 24 en Windows usando `ComSpec` y valida la descripción antes de invocar clasp.
- Commit `56f0b99`: `PWA CI #14` y `Deploy GitHub Pages #14` verdes. Página y bundle HTTPS responden 200 y el artefacto publicado contiene Recurrentes, `Se repite` y el filtro recurrente/no recurrente.
- David y Esther completaron satisfactoriamente toda la matriz `IPHONE_PHASE4.md`: reglas compartidas, edición, pausa/reactivación, ocurrencia simultánea sin duplicados, persistencia offline y calendario con fecha final.

### Cierre

El usuario confirmó el 2026-08-15 que toda la Fase 4 funciona correctamente y autorizó avanzar a Fase 5.

## Fase 5 — Presupuestos y plan mensual

Estado: **completada y validada en ambos iPhone — 2026-08-15**.

### Alcance cerrado

- Área Plan funcional con navegación mensual y resumen de ingresos previstos/reales, gastos fijos pendientes/reales, presupuesto variable restante y superávit inicial/proyectado.
- Previsto manual de ingreso o gasto: alta, edición, borrado lógico, omisión/reactivación y materialización idempotente como movimiento real.
- Las ocurrencias recurrentes del mes aparecen automáticamente como previstas; pueden omitirse/reactivarse por fecha o registrarse, sin duplicar lo ya realizado.
- Presupuesto variable por mes y categoría de gasto, con consumido, disponible y porcentaje. Un importe cero retira el presupuesto del cálculo sin eliminar historia compartida.
- Distribución prevista del resultado entre ahorro, inversión y sin asignar. Es informativa: no crea transferencias, no altera patrimonio y no anticipa objetivos.
- Fórmula pura: ingresos reales + ingresos pendientes − gastos reales − gastos fijos pendientes − presupuesto variable restante. Transferencias/ajustes no cuentan y un previsto realizado no se suma dos veces.
- IndexedDB versión 4 y sincronización incremental de `Budget`, `PlannedItem` y `MonthlyPlan`; UUID deterministas para presupuesto, plan mensual, excepción recurrente y movimiento materializado.
- Apps Script `5.0.0-phase5`, esquema 5 y `migratePhase5`; nuevas hojas `PlannedItems` y `MonthlyPlans`, activación de `Budgets` y vínculo `plannedItemId` en `Transactions`.

### Deliberadamente fuera

- Objetivos y sus asignaciones, reservados para Fase 6. La distribución solo distingue ahorro, inversión y remanente.
- Cierre/reapertura y bloqueo de meses, reservados para Fase 7; la interfaz identifica el mes como abierto.
- Análisis y tendencias, reservados para Fase 8.
- Aplazar automáticamente una ocurrencia o editar en bloque movimientos ya realizados.

### Criterio de salida

- Lint, typecheck, tests, build y CI/Pages verdes; historial sin secretos.
- `migratePhase5` ejecutada y Web App `5.0.0-phase5` desplegada conservando la URL.
- En ambos iPhone: previsto manual y recurrente, omisión/reactivación, materialización simultánea sin duplicados, presupuestos, distribución, persistencia offline y convergencia.
- La matriz reproducible está en `IPHONE_PHASE5.md`. La fase permanecerá pendiente hasta recibir el resultado real del usuario.

### Validación automatizada local

- `npm run lint`: verde, sin warnings.
- `npm run typecheck`: verde.
- `npm test`: 15 archivos y 78 tests verdes. Incluyen fórmula financiera, no doble contabilización, transferencias, presupuestos agotados, omisiones, persistencia IndexedDB, materialización idempotente, entidades remotas y UI de Plan.
- `npm run build`: verde; app shell y service worker generados con 7 recursos precacheados.
- `migratePhase5` ejecutada correctamente desde el editor autorizado: conserva datos y sesiones y deja `schemaVersion: 5`.
- Apps Script promovido a la versión inmutable 7, descripción `version5.0.0-phase5`, con la misma URL pública. Health check real: HTTP 200 y `5.0.0-phase5`.
- Commit `60f2d48`: `PWA CI #15` y `Deploy GitHub Pages #15` verdes. Página y bundle HTTPS responden 200; el artefacto publicado contiene Plan, presupuestos y distribución.
- Revisión del diff completa y escaneo del árbol e historial sin patrones de claves API, tokens de GitHub ni claves privadas.
- Pendiente exclusivamente de checkpoint: completar `IPHONE_PHASE5.md` en los dispositivos de David y Esther.

### Incidente de presupuestos y sincronización solapada — 2026-08-15

- Observación real: al sincronizar, el presupuesto recién guardado podía desaparecer en el iPhone creador; la primera sincronización posterior a una edición mostraba a veces un error.
- Causa: podían ejecutarse dos sincronizaciones a la vez. Si una edición conservaba la misma versión remota mientras seguía en la cola, una respuesta anterior podía sobrescribirla localmente; un presupuesto remoto con importe cero desaparecía entonces del plan.
- Hotfix PWA `5.0.1`: las solicitudes se serializan y una petición recibida durante otra provoca una última pasada; los registros con operaciones pendientes quedan protegidos frente a pulls antiguos y su payload local se restaura hasta recibir confirmación del servidor.
- Cobertura: prueba determinista de exclusión mutua y segunda pasada, más regresión IndexedDB que demuestra que un pull antiguo no puede borrar un presupuesto pendiente.
- Publicación: commit `fb57a2e`, `PWA CI #17` y `Deploy GitHub Pages #17` verdes. El bundle HTTPS publicado responde 200 e incluye la serialización y protección de la cola local.
- Pendiente: repetir el bloque 0 de `IPHONE_PHASE5.md` en ambos iPhone antes de continuar la matriz.

### Incidente de mes transformado por Google Sheets — 2026-08-15

- La repetición real demostró que el hotfix `5.0.1` no resolvía la desaparición principal: incluso un presupuesto nuevo desaparecía tras sincronizar y uno anterior no podía recrearse de forma visible.
- Causa definitiva: Google Sheets convertía el valor mensual `YYYY-MM` en una fecha. El pull devolvía una representación completa, que conservaba el ID pero ya no coincidía con el mes del Plan. Al editar ese registro oculto, el cliente podía reenviar el mes inválido y recibir un rechazo.
- Hotfix `5.0.2`: Apps Script normaliza celdas mensuales a `YYYY-MM`; IndexedDB repara presupuestos y distribuciones ya ocultos; `setBudget` restaura explícitamente mes/categoría; la cola repara y reactiva operaciones de plan rechazadas por este formato.
- Cobertura: prueba Apps Script con coerción realista a `Date` y regresión local de reparación de registro + operación permanente, sin perder el importe ni crear otro ID.
- No requiere migración de Sheets. Apps Script fue promovido a la versión inmutable 8 (`version5.0.2-phase5`); health check HTTP 200 y `5.0.2-phase5`.
- Validación local: lint, typecheck y build verdes; 16 archivos y 81 tests verdes.
- Publicación: commit `5d159c9`, `PWA CI #19` y `Deploy GitHub Pages #19` verdes.
- Validación real: el usuario confirmó que el error de creación/desaparición quedó solucionado tras actualizar ambos iPhone.

### Claridad al exceder un presupuesto — 2026-08-15

- La primera presentación mostraba `0 disponible · 121% consumido`, cálculo correcto pero sin cuantificar el exceso salvo mediante resta mental y color.
- Hotfix PWA `5.0.3`: muestra `Excedido en 210,00 € · 121% consumido`, mantiene la barra completa y aporta un nombre accesible equivalente al lector de pantalla.
- Validación local: lint, typecheck y build verdes; 16 archivos y 82 tests verdes, incluida la cifra excedida y su nombre accesible.
- Publicación: commit `14c38af`, `PWA CI #21` y `Deploy GitHub Pages #21` verdes. El bundle HTTPS contiene ambos mensajes.
- Pendiente: comprobar esta última presentación en iPhone y confirmar el resto de la matriz de Fase 5 antes de iniciar Fase 6.

### Claridad al editar y auditar la proyección — 2026-08-15

- Observación real: al editar un movimiento, el botón conservaba el importe anterior aunque el campo ya tuviera otro valor; en el resumen mensual faltaban el total de gastos reales y los importes exactos de la fórmula, por lo que un resultado correcto parecía una doble contabilización.
- Hotfix PWA `5.0.4`: el botón dice **Guardar cambios** y deja de presentar cifras desfasadas. La tarjeta de proyección muestra la ecuación completa y el resumen distingue ingresos pendientes, gastos reales totales, gastos fijos pendientes y presupuesto variable pendiente de gastar.
- Verificación determinista: el caso `125 + 0 − 4.360 − 0 − 1.833` produce `−6.068 €`; los `4.360 €` son `2.750 €` fijos pagados más `1.610 €` variables registrados, por lo que no existe doble contabilización.
- Validación local: lint, typecheck y build verdes; 16 archivos y 85 tests verdes, incluidos el cambio de un importe anterior de 1.999.999 € a 2.000 € y la operación completa de proyección. El build genera 7 recursos precacheados y no aparecen patrones de secretos en el árbol ni en el historial.
- Publicación: commit `bbb77aa`, `PWA CI #23` y `Deploy GitHub Pages #23` verdes. La página y el bundle responden HTTP 200 y el artefacto servido contiene **Guardar cambios**, **Gastos reales totales** y **Variable pendiente de gastar**. La comprobación manual específica se añadió a `IPHONE_PHASE5.md`.

### Cierre

El usuario confirmó el 2026-08-15 que la matriz de Fase 5 y los hotfixes de presupuesto, exceso, edición y claridad de la proyección funcionan correctamente en iPhone, y autorizó avanzar a Fase 6.

## Fase 6 — Objetivos virtuales y patrimonio

Estado: **completada y validada en ambos iPhone — 2026-08-16**.

### Alcance

- Objetivos compartidos con nombre, icono, importe objetivo, fecha opcional, nota y estados activo, completado o archivado.
- Aportaciones y retiradas virtuales con historial, fecha e identidad; nunca crean movimientos ni modifican saldos o patrimonio.
- Progreso, importe restante, exceso, ritmo mensual y estimación de cumplimiento cuando existan datos suficientes.
- Vista de patrimonio con total, liquidez, ahorro, inversión, desglose por cuenta y patrimonio no asignado a objetivos.
- IndexedDB y sincronización incremental/idempotente para `Goal` y `GoalAllocation`; migración Apps Script/Sheets a esquema 6.
- Resumen de objetivos en Inicio y área Objetivos plenamente funcional y accesible.

### Deliberadamente fuera

- Vincular una aportación a una transferencia real; se mantiene como opción futura porque no es necesaria para preservar la regla contable de esta fase.
- Cierre, snapshot y variación contra el último cierre, reservados para Fase 7.
- Gráficos y tendencias de patrimonio u objetivos, reservados para Fase 8.
- Cotizaciones, integración bancaria o eliminación física de histórico.

### Criterio de salida

- Lint, typecheck, tests, build, CI y Pages verdes; historial sin secretos.
- `migratePhase6` ejecutada y Web App `6.0.0-phase6` desplegado conservando la URL.
- En ambos iPhone: CRUD y estados de objetivos, aportación/retirada, patrimonio inalterado, sincronización concurrente, persistencia offline y convergencia sin duplicados.
- La fase permanecerá pendiente hasta recibir el resultado real de la matriz `IPHONE_PHASE6.md`.

### Validación automatizada y despliegue

- `npm run lint`, `npm run typecheck` y `npm run build`: verdes, sin warnings; PWA generada con 7 recursos precacheados.
- `npm test`: 19 archivos y 97 tests verdes. Cubren cálculos de objetivos y patrimonio, asignaciones firmadas, archivo/restauración, persistencia offline, rollback de una retirada concurrente rechazada, UI accesible y adaptador Apps Script/Sheets.
- Revisión local a 390 × 844 px: sin desbordamiento horizontal ni errores de consola en el arranque. Las vistas funcionales tienen además pruebas de renderizado a nivel de componente; la revisión real completa corresponde a la matriz de iPhone.
- `migratePhase6` ejecutada correctamente desde el editor autorizado: conserva datos, clave y sesiones y deja el esquema 6 con 14 columnas en `Goals` y 11 en `GoalAllocations`.
- Apps Script promovido a la versión inmutable 9, descripción `version6.0.0-phase6`, conservando la misma URL pública. Health check real: HTTP 200 y `6.0.0-phase6`.
- Commit `a84aac9`: `PWA CI #25` y `Deploy GitHub Pages #25` verdes. La página y el bundle responden HTTP 200 y el artefacto publicado contiene Objetivos, Patrimonio y la retirada explícita. La fase no se marcará completada hasta que David y Esther confirmen `IPHONE_PHASE6.md`.

### Texto obsoleto en la distribución mensual — 2026-08-16

- Observación real: Plan → Distribución todavía indicaba que la asignación a objetivos se añadiría en Fase 6, aunque Objetivos ya estaba operativo.
- Hotfix PWA `6.0.1`: el texto dirige a la pestaña Objetivos y aclara que la distribución mensual no crea aportaciones ni mueve dinero. No enlaza ambos modelos ni anticipa funcionalidad de Fase 7.
- Cobertura: prueba de interfaz que exige el nuevo mensaje y evita que vuelva a aparecer la referencia futura a Fase 6.

### Cierre

El usuario confirmó el 2026-08-16 que toda la matriz de `IPHONE_PHASE6.md`, incluido el texto corregido de Distribución, funciona correctamente y autorizó avanzar a Fase 7.

## Fase 7 — Cierres, snapshots, reapertura y recierre

Estado: **completada — 2026-08-16**.

### Alcance

- Checklist de cierre con movimientos, previstos pendientes, resultado real, patrimonio, ahorro, inversión y reserva virtual de objetivos.
- Opción de mantener los previstos pendientes o marcarlos como omitidos antes del cierre.
- Snapshot mensual sincronizable con UUID determinista, revisión, autor y fecha de cierre/reapertura, cifras de plan y patrimonio.
- Mes cerrado de solo lectura en Movimientos y las tres secciones de Plan; reapertura explícita y posterior recierre con una revisión nueva.
- Al cerrar, los presupuestos positivos y la distribución se copian al mes siguiente solo cuando este aún no tiene configuración. Las recurrencias siguen generándose desde sus reglas existentes.
- Inicio compara el patrimonio actual con el último snapshot cerrado anterior.
- IndexedDB versión 6 y Apps Script/Sheets esquema 7 con `MonthlyClosures` funcional.
- El servidor protege el bloqueo incluso ante clientes desactualizados. Una mutación optimista rechazada con `month_closed` se revierte al registro canónico —o se elimina si era un alta— para que ambos iPhone converjan sin cambios imposibles en cola.

### Deliberadamente fuera

- Gráficos, tendencias, comparativas históricas y análisis por categoría, reservados para Fase 8.
- Exportación/importación, copias y endurecimiento final, reservados para Fase 9.
- Modificar snapshots cerrados o eliminar cierres; solo se permite reabrir y volver a cerrar.

### Criterio de salida

- Lint, typecheck, tests, build, CI y Pages verdes; historial sin secretos.
- `migratePhase7` ejecutada y Web App `7.0.0-phase7` desplegada conservando la URL.
- En ambos iPhone: cierre con ambas decisiones sobre pendientes, bloqueo completo, reapertura/recierre, arrastre no destructivo al mes siguiente, persistencia offline, conflicto con un segundo móvil y convergencia.
- La fase permanecerá pendiente hasta recibir el resultado real de `IPHONE_PHASE7.md`.

### Validación automatizada local

- `npm run lint`, `npm run typecheck` y `npm run build`: verdes, sin warnings; app shell y service worker generados con 7 recursos precacheados.
- `npm test`: 20 archivos y 106 tests verdes. Incluyen snapshot firmado en céntimos, cierre/reapertura/recierre, bloqueo local/remoto, rollback de una mutación rechazada, UI de solo lectura, migración Sheets e incremental pull de cierres.
- `migratePhase7` ejecutada correctamente desde el editor autorizado: conserva datos, clave y sesiones y deja el esquema 7 con 26 columnas en `MonthlyClosures`.
- Apps Script promovido a la versión inmutable 12, descripción `version7.0.0-phase7`, conservando la misma URL pública. Health check real: HTTP 200 y `7.0.0-phase7`.
- Commit `d4cf67e`: `PWA CI #28` y `Deploy GitHub Pages #28` verdes. La página HTTPS publicada responde correctamente y arranca sin errores de consola.
- Revisión completa del diff y `git diff --check` sin incidencias. El árbol actual y todo el historial no contienen patrones de claves API, tokens de GitHub ni claves privadas.
- Validación externa completada: el usuario confirmó el 2026-08-16 que toda la matriz de `IPHONE_PHASE7.md` funciona correctamente en los dos iPhone y autorizó avanzar.

## Fase 8 — Análisis y tendencias accesibles

Estado: **completada — 2026-08-16**.

### Alcance

- Selector de 3, 6 y 12 meses, año actual o fechas personalizadas, con un máximo explícito de 120 meses.
- Resultado, ingresos y gastos reales del periodo, excluyendo transferencias y ajustes.
- Evolución mensual de gasto con barras e importes textuales; ranking por categoría con importe y porcentaje.
- Presupuesto variable frente a gasto variable real por mes y categoría, con disponible o exceso expresado en texto.
- Evolución del patrimonio basada exclusivamente en snapshots de meses cerrados, con línea e historial numérico.
- Ahorro neto mensual y del periodo, neto acumulado del año y tasa orientativa calculada con `max(resultado, 0) / ingresos`.
- Progreso acumulado de objetivos activos hasta el final del periodo y cambio producido dentro del intervalo.
- Lecturas deterministas sobre gasto, excesos de presupuesto y patrimonio, sin IA ni recomendaciones personalizadas.
- Cálculo puro y local sobre datos ya sincronizados: no requiere migración de IndexedDB, Sheets ni Apps Script.

### Deliberadamente fuera

- Exportación/importación, copias, recuperación, optimización y auditoría integral de accesibilidad, reservadas para Fase 9.
- Predicciones, asesoramiento de inversión, precios de mercado o analítica de terceros.
- Reconstruir patrimonio histórico sin un cierre real o mezclar gastos fijos con presupuestos variables.

### Criterio de salida

- Lint, typecheck, 116 tests, build, CI y Pages verdes; diff e historial sin secretos.
- En ambos iPhone: periodos, cifras mensuales, categorías, presupuestos, cierres, ahorro, objetivos, modo offline y presentación validados mediante `IPHONE_PHASE8.md`.
- La fase permanecerá pendiente hasta recibir el resultado real de esa guía.

### Validación automatizada y despliegue

- `npm run lint`, `npm run typecheck` y `npm run build`: verdes, sin warnings; app shell y service worker generados con 7 recursos precacheados.
- `npm test`: 22 archivos y 116 tests verdes. Incluyen periodos fijos/personalizados, céntimos exactos, exclusión de transferencias y ajustes, categorías, presupuesto variable, ahorro firmado y tasa no negativa, cierres, objetivos, insights, estados vacíos y accesibilidad básica de la interfaz.
- Revisión visual a 390 × 844 px en modo oscuro: sin desplazamiento horizontal, importes cortados ni errores de consola. Se corrigieron durante la revisión la explicación del ahorro firmado, las barras de valor cero y el contraste de los desplegables.
- Commit `2c48084`: `PWA CI #30` y `Deploy GitHub Pages #30` verdes. La página pública responde HTTP 200 y el bundle activo contiene la pantalla y textos de Fase 8.
- `git diff --check` sin incidencias. El cambio completo y todo el historial no contienen patrones de claves API, tokens de GitHub ni claves privadas.
- No hay migración ni despliegue de Apps Script: el Web App continúa en `7.0.0-phase7` porque Fase 8 solo agrega localmente entidades existentes.
- Validación externa completada: el usuario confirmó el 2026-08-16 que toda la matriz de `IPHONE_PHASE8.md` funciona correctamente en los dos iPhone y autorizó avanzar a Fase 9.

## Fase 9 — Robustez, rendimiento, accesibilidad, exportación/importación y copias

Estado: **en desarrollo — 2026-08-16**.

### Alcance

- Corrección de un bloqueo real de sincronización: el servidor rechaza lotes de más de 100 operaciones y el cliente no troceaba el envío, dejando el outbox atascado para siempre si se superaba ese límite.
- Exportar una copia local en JSON desde Ajustes con todas las entidades del hogar.
- Restaurar esa copia, solo disponible en un dispositivo sin datos locales todavía (recuperación ante desastre), con reconstrucción correcta de cuentas/categorías archivadas, objetivos completados/archivados y cierres mensuales.
- Mejoras de rendimiento con evidencia real: agregación por mes en Análisis y una comparación más barata en la lectura de movimientos.
- Mejoras de accesibilidad con evidencia real: foco visible en botones, objetivos táctiles, `aria-live` en el estado de sincronización, gestión de foco al abrir formularios, cobertura de test que faltaba y smoke tests automáticos con `jest-axe`.

### Deliberadamente fuera

- Copia automática en Google Drive gestionada por Apps Script.
- Restaurar una copia sustituyendo datos ya sincronizados.
- Importación de movimientos bancarios/CSV.
- Auditoría de accesibilidad exhaustiva más allá de los hallazgos concretos de esta fase.

### Criterio de salida

- Lint, typecheck, tests, build, CI y Pages verdes; diff e historial sin secretos.
- En ambos iPhone: exportar/restaurar copia, sincronización sin bloqueo con más de 100 operaciones pendientes, accesibilidad y rendimiento validados mediante `IPHONE_PHASE9.md`.
- La fase permanecerá pendiente hasta recibir el resultado real de esa guía.

### Validación automatizada

- `npm run lint`, `npm run typecheck` y `npm run build`: verdes, sin warnings; app shell y service worker generados con 7 recursos precacheados (sin cambios respecto a Fase 8: la copia de seguridad es cálculo/IO local, no añade activos).
- `npm test`: 26 archivos y 141 tests verdes (fase anterior: 22 archivos, 116 tests). Cobertura nueva: troceo de sincronización en lotes de 100 con progreso duradero por lote; serialización/validación de la copia de seguridad (`backup.ts`); orden de dependencias, reatribución de autoría y reparación de estado archivado/completado/cerrado al restaurar (`localFinanceRepository.ts`); componente `BackupManager` (exportar, ocultar restauración con datos locales, confirmación explícita, fichero inválido); agrupación por mes en Análisis; primeros tests de `MovementsView` (no existían); tres smoke tests de accesibilidad automática con `jest-axe` (Análisis, Movimientos, Copia de seguridad) sin violaciones críticas.
- Revisión manual en navegador a 390 × 844 px, modo oscuro: sin desplazamiento horizontal ni errores de consola en el arranque. La revisión completa del flujo de restauración con datos reales corresponde a `IPHONE_PHASE9.md`, porque requiere una sesión real contra el Web App.
- `git diff --check` sin incidencias. El diff completo y el historial no contienen patrones de claves API, tokens de GitHub, contraseñas ni claves privadas.
- No hay migración ni nuevo despliegue de Apps Script: el Web App continúa en `7.0.0-phase7`. La corrección de troceo de sincronización y la copia de seguridad son enteramente del lado cliente.
- Pendiente exclusivamente de checkpoint: completar `IPHONE_PHASE9.md` en los dispositivos de David y Esther.

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
